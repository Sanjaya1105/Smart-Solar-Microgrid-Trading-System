/*
 * File: ReservationService.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Central reservation rules, approval, QR verification and dashboards.
 */
using MongoDB.Driver;
using SolarMicrogrid.Api.DTOs;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.Services;

public sealed class ReservationService(MongoDbContext db, TokenService tokens)
{
    public async Task<object> GetBookingProsumersAsync(CancellationToken cancellationToken)
    {
        // Return minimal identity information for active prosumers to authorized booking staff.
        return await db.Users.Find(x => x.Role == UserRole.Prosumer && x.Status == AccountStatus.Active)
            .Project(x => new { x.Id, x.FullName, x.Nic }).ToListAsync(cancellationToken);
    }

    public async Task<EnergyReservation> UpdateForStaffAsync(string id, UpdateReservationRequest request, CancellationToken cancellationToken)
    {
        // Resolve ownership internally and reuse the same update rules as the prosumer flow.
        var reservation = await db.Reservations.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Reservation was not found.");
        return await UpdateAsync(id, reservation.ProsumerUserId, request, cancellationToken);
    }

    public async Task<EnergyReservation> CreateAsync(string prosumerId, CreateReservationRequest request, CancellationToken cancellationToken)
    {
        // Create a pending booking only when the user, node and seven-day slot are valid.
        var prosumer = await RequireActiveProsumerAsync(prosumerId, cancellationToken);
        var slot = await ReserveCapacityAsync(request.SlotId, cancellationToken);
        var reservation = new EnergyReservation
        {
            SlotId = slot.Id!, StationId = slot.StationId, ProsumerUserId = prosumer.Id!, ProsumerNic = prosumer.Nic,
            TransactionType = request.TransactionType, EnergyKwh = request.EnergyKwh, Status = ReservationStatus.Pending
        };
        try
        {
            await db.Reservations.InsertOneAsync(reservation, cancellationToken: cancellationToken);
            return reservation;
        }
        catch
        {
            await ReleaseCapacityAsync(slot.Id!, cancellationToken);
            throw;
        }
    }

    public async Task<EnergyReservation> UpdateAsync(string reservationId, string prosumerId, UpdateReservationRequest request, CancellationToken cancellationToken)
    {
        // Modify an owned pending/approved reservation with at least twelve hours' notice.
        var reservation = await GetOwnedAsync(reservationId, prosumerId, cancellationToken);
        var oldSlot = await RequireTwelveHoursAsync(reservation, cancellationToken);
        if (reservation.Status is not (ReservationStatus.Pending or ReservationStatus.Approved))
            throw new ApiException(StatusCodes.Status409Conflict, "Only pending or approved reservations can be updated.");
        if (reservation.SlotId != request.SlotId)
        {
            var newSlot = await ReserveCapacityAsync(request.SlotId, cancellationToken);
            await ReleaseCapacityAsync(oldSlot.Id!, cancellationToken);
            reservation.SlotId = newSlot.Id!;
            reservation.StationId = newSlot.StationId;
        }
        reservation.TransactionType = request.TransactionType;
        reservation.EnergyKwh = request.EnergyKwh;
        reservation.Status = ReservationStatus.Pending;
        reservation.QrTokenHash = null;
        reservation.ApprovedAtUtc = null;
        reservation.UpdatedAtUtc = DateTime.UtcNow;
        await db.Reservations.ReplaceOneAsync(x => x.Id == reservation.Id, reservation, cancellationToken: cancellationToken);
        return reservation;
    }

    public async Task<EnergyReservation> CancelAsync(string reservationId, string actorId, bool staffOverride, CancellationToken cancellationToken)
    {
        // Cancel a booking with twelve hours' notice; staff may act for the prosumer but cannot bypass the rule.
        var reservation = await db.Reservations.Find(x => x.Id == reservationId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Reservation was not found.");
        if (!staffOverride && reservation.ProsumerUserId != actorId)
            throw new ApiException(StatusCodes.Status403Forbidden, "You cannot cancel another prosumer's reservation.");
        await RequireTwelveHoursAsync(reservation, cancellationToken);
        if (reservation.Status is not (ReservationStatus.Pending or ReservationStatus.Approved))
            throw new ApiException(StatusCodes.Status409Conflict, "Only pending or approved reservations can be cancelled.");
        reservation.Status = ReservationStatus.Cancelled;
        reservation.CancelledAtUtc = DateTime.UtcNow;
        reservation.UpdatedAtUtc = DateTime.UtcNow;
        reservation.QrTokenHash = null;
        await db.Reservations.ReplaceOneAsync(x => x.Id == reservation.Id, reservation, cancellationToken: cancellationToken);
        await ReleaseCapacityAsync(reservation.SlotId, cancellationToken);
        return reservation;
    }

    public async Task<object> ApproveAsync(string reservationId, bool approve, CancellationToken cancellationToken)
    {
        // Approve a pending request and issue a signed QR, or reject it and free its capacity.
        var reservation = await db.Reservations.Find(x => x.Id == reservationId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Reservation was not found.");
        if (reservation.Status != ReservationStatus.Pending)
            throw new ApiException(StatusCodes.Status409Conflict, "Only pending reservations can be approved or rejected.");
        if (!approve)
        {
            reservation.Status = ReservationStatus.Rejected;
            reservation.UpdatedAtUtc = DateTime.UtcNow;
            await db.Reservations.ReplaceOneAsync(x => x.Id == reservation.Id, reservation, cancellationToken: cancellationToken);
            await ReleaseCapacityAsync(reservation.SlotId, cancellationToken);
            return new { reservation, qrToken = (string?)null };
        }
        var qrToken = tokens.CreateQrToken(reservation.Id!);
        reservation.Status = ReservationStatus.Approved;
        reservation.ApprovedAtUtc = DateTime.UtcNow;
        reservation.UpdatedAtUtc = DateTime.UtcNow;
        reservation.QrTokenHash = tokens.HashQrToken(qrToken);
        await db.Reservations.ReplaceOneAsync(x => x.Id == reservation.Id, reservation, cancellationToken: cancellationToken);
        return new { reservation, qrToken };
    }

    public async Task<object> RegenerateQrAsync(string reservationId, string prosumerId, CancellationToken cancellationToken)
    {
        // Issue a fresh QR for the owner of an approved future reservation.
        var reservation = await GetOwnedAsync(reservationId, prosumerId, cancellationToken);
        if (reservation.Status != ReservationStatus.Approved)
            throw new ApiException(StatusCodes.Status409Conflict, "A QR code is available only for an approved reservation.");
        var slot = await db.Slots.Find(x => x.Id == reservation.SlotId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Booking slot was not found.");
        if (slot.EndUtc <= DateTime.UtcNow) throw new ApiException(StatusCodes.Status409Conflict, "The reservation slot has expired.");
        var qrToken = tokens.CreateQrToken(reservation.Id!);
        reservation.QrTokenHash = tokens.HashQrToken(qrToken);
        reservation.UpdatedAtUtc = DateTime.UtcNow;
        await db.Reservations.ReplaceOneAsync(x => x.Id == reservation.Id, reservation, cancellationToken: cancellationToken);
        return new { reservationId = reservation.Id, qrToken };
    }

    public async Task<EnergyReservation> CompleteByQrAsync(string operatorId, string qrToken, CancellationToken cancellationToken)
    {
        // Validate the signed QR against server data and finalize the energy transfer once.
        if (!tokens.TryReadQrToken(qrToken, out var reservationId))
            throw new ApiException(StatusCodes.Status400BadRequest, "QR code signature is invalid.");
        var reservation = await db.Reservations.Find(x => x.Id == reservationId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Reservation was not found.");
        if (reservation.Status != ReservationStatus.Approved || reservation.QrTokenHash != tokens.HashQrToken(qrToken))
            throw new ApiException(StatusCodes.Status409Conflict, "QR code is expired, replaced or already used.");
        var slot = await db.Slots.Find(x => x.Id == reservation.SlotId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Booking slot was not found.");
        if (slot.EndUtc <= DateTime.UtcNow)
            throw new ApiException(StatusCodes.Status409Conflict, "The reservation slot has expired.");
        var now = DateTime.UtcNow;
        var completed = await db.Reservations.FindOneAndUpdateAsync<EnergyReservation, EnergyReservation>(
            x => x.Id == reservation.Id && x.Status == ReservationStatus.Approved && x.QrTokenHash == reservation.QrTokenHash,
            Builders<EnergyReservation>.Update.Set(x => x.Status, ReservationStatus.Completed)
                .Set(x => x.CompletedAtUtc, now).Set(x => x.CompletedByOperatorId, operatorId)
                .Set(x => x.QrTokenHash, null).Set(x => x.UpdatedAtUtc, now),
            new FindOneAndUpdateOptions<EnergyReservation> { ReturnDocument = ReturnDocument.After }, cancellationToken);
        return completed ?? throw new ApiException(StatusCodes.Status409Conflict, "QR code is expired, replaced or already used.");
    }

    public async Task<List<EnergyReservation>> GetMineAsync(string prosumerId, ReservationQuery query, CancellationToken cancellationToken)
    {
        // Return the prosumer's current, pending or historical bookings with search/date filters.
        var filter = Builders<EnergyReservation>.Filter.Eq(x => x.ProsumerUserId, prosumerId);
        filter &= BuildQueryFilter(query);
        return await db.Reservations.Find(filter).SortByDescending(x => x.CreatedAtUtc).ToListAsync(cancellationToken);
    }

    public async Task<List<EnergyReservation>> GetOperationalAsync(ReservationQuery query, CancellationToken cancellationToken)
    {
        // Return live reservation data for Backoffice and Grid Operator dashboards.
        return await db.Reservations.Find(BuildQueryFilter(query)).SortByDescending(x => x.CreatedAtUtc).ToListAsync(cancellationToken);
    }

    public async Task<DashboardResponse> GetDashboardAsync(CancellationToken cancellationToken)
    {
        // Calculate dashboard counters live from MongoDB rather than hard-coding values.
        var now = DateTime.UtcNow;
        var futureSlotIds = await db.Slots.Find(x => x.StartUtc > now).Project(x => x.Id!).ToListAsync(cancellationToken);
        var pendingTask = db.Reservations.CountDocumentsAsync(x => x.Status == ReservationStatus.Pending, cancellationToken: cancellationToken);
        var approvedTask = db.Reservations.CountDocumentsAsync(x => x.Status == ReservationStatus.Approved && futureSlotIds.Contains(x.SlotId), cancellationToken: cancellationToken);
        var completedTask = db.Reservations.CountDocumentsAsync(x => x.Status == ReservationStatus.Completed, cancellationToken: cancellationToken);
        var stationsTask = db.Stations.CountDocumentsAsync(x => x.Status == NodeStatus.Active, cancellationToken: cancellationToken);
        await Task.WhenAll(pendingTask, approvedTask, completedTask, stationsTask);
        return new DashboardResponse(pendingTask.Result, approvedTask.Result, completedTask.Result, stationsTask.Result);
    }

    private async Task<AppUser> RequireActiveProsumerAsync(string id, CancellationToken cancellationToken)
    {
        // Require an active prosumer account for new mobile bookings.
        return await db.Users.Find(x => x.Id == id && x.Role == UserRole.Prosumer && x.Status == AccountStatus.Active).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status403Forbidden, "An active prosumer account is required.");
    }

    private async Task<EnergyBookingSlot> ReserveCapacityAsync(string slotId, CancellationToken cancellationToken)
    {
        // Atomically claim one place in an available slot scheduled within seven days.
        var now = DateTime.UtcNow;
        var latest = now.AddDays(7);
        var filter = Builders<EnergyBookingSlot>.Filter.Where(x => x.Id == slotId && x.Status == SlotStatus.Available && x.StartUtc > now && x.StartUtc <= latest && x.ReservedCapacity < x.TotalCapacity);
        var update = Builders<EnergyBookingSlot>.Update.Inc(x => x.ReservedCapacity, 1).Set(x => x.UpdatedAtUtc, now);
        var slot = await db.Slots.FindOneAndUpdateAsync(filter, update, new FindOneAndUpdateOptions<EnergyBookingSlot> { ReturnDocument = ReturnDocument.After }, cancellationToken)
            ?? throw new ApiException(StatusCodes.Status409Conflict, "Slot is unavailable, full, or outside the next seven days.");
        var stationActive = await db.Stations.Find(x => x.Id == slot.StationId && x.Status == NodeStatus.Active).AnyAsync(cancellationToken);
        if (!stationActive)
        {
            await ReleaseCapacityAsync(slot.Id!, cancellationToken);
            throw new ApiException(StatusCodes.Status409Conflict, "The microgrid node is inactive.");
        }
        if (slot.ReservedCapacity >= slot.TotalCapacity)
            await db.Slots.UpdateOneAsync(x => x.Id == slot.Id, Builders<EnergyBookingSlot>.Update.Set(x => x.Status, SlotStatus.FullyBooked), cancellationToken: cancellationToken);
        return slot;
    }

    private async Task ReleaseCapacityAsync(string slotId, CancellationToken cancellationToken)
    {
        // Atomically release one reservation place and reopen a full slot.
        await db.Slots.UpdateOneAsync(x => x.Id == slotId && x.ReservedCapacity > 0,
            Builders<EnergyBookingSlot>.Update.Inc(x => x.ReservedCapacity, -1).Set(x => x.UpdatedAtUtc, DateTime.UtcNow),
            cancellationToken: cancellationToken);
        await db.Slots.UpdateOneAsync(x => x.Id == slotId && x.Status == SlotStatus.FullyBooked && x.ReservedCapacity < x.TotalCapacity,
            Builders<EnergyBookingSlot>.Update.Set(x => x.Status, SlotStatus.Available), cancellationToken: cancellationToken);
    }

    private async Task<EnergyReservation> GetOwnedAsync(string id, string prosumerId, CancellationToken cancellationToken)
    {
        // Require a reservation belonging to the authenticated prosumer.
        return await db.Reservations.Find(x => x.Id == id && x.ProsumerUserId == prosumerId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Owned reservation was not found.");
    }

    private async Task<EnergyBookingSlot> RequireTwelveHoursAsync(EnergyReservation reservation, CancellationToken cancellationToken)
    {
        // Enforce the assignment's twelve-hour update and cancellation notice rule.
        var slot = await db.Slots.Find(x => x.Id == reservation.SlotId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Booking slot was not found.");
        if (slot.StartUtc - DateTime.UtcNow < TimeSpan.FromHours(12))
            throw new ApiException(StatusCodes.Status409Conflict, "Updates and cancellations require at least 12 hours' notice.");
        return slot;
    }

    private static FilterDefinition<EnergyReservation> BuildQueryFilter(ReservationQuery query)
    {
        // Build reusable status, date and text search filters for booking views.
        var filter = Builders<EnergyReservation>.Filter.Empty;
        if (query.Status.HasValue) filter &= Builders<EnergyReservation>.Filter.Eq(x => x.Status, query.Status.Value);
        if (query.FromUtc.HasValue) filter &= Builders<EnergyReservation>.Filter.Gte(x => x.CreatedAtUtc, query.FromUtc.Value.ToUniversalTime());
        if (query.ToUtc.HasValue) filter &= Builders<EnergyReservation>.Filter.Lte(x => x.CreatedAtUtc, query.ToUtc.Value.ToUniversalTime());
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var escaped = System.Text.RegularExpressions.Regex.Escape(query.Search.Trim());
            filter &= Builders<EnergyReservation>.Filter.Or(
                Builders<EnergyReservation>.Filter.Regex(x => x.ProsumerNic, new MongoDB.Bson.BsonRegularExpression(escaped, "i")),
                Builders<EnergyReservation>.Filter.Regex(x => x.Id, new MongoDB.Bson.BsonRegularExpression(escaped, "i")));
        }
        return filter;
    }
}
