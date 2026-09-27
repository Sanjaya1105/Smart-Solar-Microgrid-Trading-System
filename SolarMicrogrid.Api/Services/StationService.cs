/*
 * File: StationService.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Microgrid node, schedule and battery-slot business logic.
 */
using MongoDB.Driver;
using SolarMicrogrid.Api.DTOs;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.Services;

public sealed class StationService(MongoDbContext db)
{
    public async Task<List<SolarStationInfo>> GetStationsAsync(bool activeOnly, CancellationToken cancellationToken)
    {
        // Return all stations or only active locations for maps and booking screens.
        var filter = activeOnly ? Builders<SolarStationInfo>.Filter.Eq(x => x.Status, NodeStatus.Active) : Builders<SolarStationInfo>.Filter.Empty;
        return await db.Stations.Find(filter).SortBy(x => x.Name).ToListAsync(cancellationToken);
    }

    public async Task<SolarStationInfo> GetStationAsync(string id, CancellationToken cancellationToken)
    {
        // Find a single station by its MongoDB identifier.
        return await db.Stations.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Microgrid node was not found.");
    }

    public async Task<SolarStationInfo> CreateStationAsync(StationRequest request, CancellationToken cancellationToken)
    {
        // Create an active microgrid node with GPS, capacity and operating details.
        var station = MapStation(request);
        await db.Stations.InsertOneAsync(station, cancellationToken: cancellationToken);
        return station;
    }

    public async Task<SolarStationInfo> UpdateStationAsync(string id, StationRequest request, CancellationToken cancellationToken)
    {
        // Replace editable station details while preserving status and creation date.
        var existing = await GetStationAsync(id, cancellationToken);
        var station = MapStation(request);
        station.Id = existing.Id; station.Status = existing.Status; station.CreatedAtUtc = existing.CreatedAtUtc; station.UpdatedAtUtc = DateTime.UtcNow;
        await db.Stations.ReplaceOneAsync(x => x.Id == id, station, cancellationToken: cancellationToken);
        return station;
    }

    public async Task DeactivateStationAsync(string id, CancellationToken cancellationToken)
    {
        // Block node deactivation while a pending or approved future reservation exists.
        var slotIds = await db.Slots.Find(x => x.StationId == id && x.EndUtc > DateTime.UtcNow).Project(x => x.Id!).ToListAsync(cancellationToken);
        var activeCount = await db.Reservations.CountDocumentsAsync(
            x => slotIds.Contains(x.SlotId) && (x.Status == ReservationStatus.Pending || x.Status == ReservationStatus.Approved),
            cancellationToken: cancellationToken);
        if (activeCount > 0)
            throw new ApiException(StatusCodes.Status409Conflict, "Node cannot be deactivated while active reservations exist.");
        var result = await db.Stations.UpdateOneAsync(x => x.Id == id,
            Builders<SolarStationInfo>.Update.Set(x => x.Status, NodeStatus.Inactive).Set(x => x.UpdatedAtUtc, DateTime.UtcNow),
            cancellationToken: cancellationToken);
        if (result.MatchedCount == 0) throw new ApiException(StatusCodes.Status404NotFound, "Microgrid node was not found.");
    }

    public async Task ActivateStationAsync(string id, CancellationToken cancellationToken)
    {
        // Reactivate a node through the Backoffice-only workflow.
        var result = await db.Stations.UpdateOneAsync(x => x.Id == id,
            Builders<SolarStationInfo>.Update.Set(x => x.Status, NodeStatus.Active).Set(x => x.UpdatedAtUtc, DateTime.UtcNow),
            cancellationToken: cancellationToken);
        if (result.MatchedCount == 0) throw new ApiException(StatusCodes.Status404NotFound, "Microgrid node was not found.");
    }

    public async Task<List<EnergyBookingSlot>> GetSlotsAsync(string? stationId, bool availableOnly, CancellationToken cancellationToken)
    {
        // Return schedule slots filtered for a station and/or future availability.
        var filter = Builders<EnergyBookingSlot>.Filter.Empty;
        if (!string.IsNullOrWhiteSpace(stationId)) filter &= Builders<EnergyBookingSlot>.Filter.Eq(x => x.StationId, stationId);
        if (availableOnly) filter &= Builders<EnergyBookingSlot>.Filter.Eq(x => x.Status, SlotStatus.Available) & Builders<EnergyBookingSlot>.Filter.Gt(x => x.StartUtc, DateTime.UtcNow);
        return await db.Slots.Find(filter).SortBy(x => x.StartUtc).ToListAsync(cancellationToken);
    }

    public async Task<EnergyBookingSlot> CreateSlotAsync(SlotRequest request, CancellationToken cancellationToken)
    {
        // Validate a station schedule and create a new reservable energy slot.
        await ValidateSlotAsync(request, null, cancellationToken);
        var slot = new EnergyBookingSlot { StationId = request.StationId, StartUtc = request.StartUtc.ToUniversalTime(), EndUtc = request.EndUtc.ToUniversalTime(), TotalCapacity = request.TotalCapacity };
        await db.Slots.InsertOneAsync(slot, cancellationToken: cancellationToken);
        return slot;
    }

    public async Task<EnergyBookingSlot> UpdateSlotAsync(string id, SlotRequest request, CancellationToken cancellationToken)
    {
        // Update a schedule while ensuring capacity is not below existing reservations.
        await ValidateSlotAsync(request, id, cancellationToken);
        var existing = await db.Slots.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Booking slot was not found.");
        if (request.TotalCapacity < existing.ReservedCapacity)
            throw new ApiException(StatusCodes.Status409Conflict, "Capacity cannot be lower than existing reservations.");
        var hasReservations = await db.Reservations.Find(x => x.SlotId == id).AnyAsync(cancellationToken);
        if (hasReservations && (existing.StationId != request.StationId || existing.StartUtc != request.StartUtc.ToUniversalTime() || existing.EndUtc != request.EndUtc.ToUniversalTime()))
            throw new ApiException(StatusCodes.Status409Conflict, "A slot with reservation history cannot be moved. Create a new slot and update bookings instead.");
        existing.StationId = request.StationId; existing.StartUtc = request.StartUtc.ToUniversalTime(); existing.EndUtc = request.EndUtc.ToUniversalTime();
        existing.TotalCapacity = request.TotalCapacity; existing.Status = existing.Status == SlotStatus.Unavailable ? SlotStatus.Unavailable : CalculateSlotStatus(existing); existing.UpdatedAtUtc = DateTime.UtcNow;
        await db.Slots.ReplaceOneAsync(x => x.Id == id, existing, cancellationToken: cancellationToken);
        return existing;
    }

    public async Task DeleteSlotAsync(string id, CancellationToken cancellationToken)
    {
        // Delete only an unused slot so reservation references remain consistent.
        var count = await db.Reservations.CountDocumentsAsync(x => x.SlotId == id, cancellationToken: cancellationToken);
        if (count > 0) throw new ApiException(StatusCodes.Status409Conflict, "A slot with reservations cannot be deleted.");
        var result = await db.Slots.DeleteOneAsync(x => x.Id == id, cancellationToken);
        if (result.DeletedCount == 0) throw new ApiException(StatusCodes.Status404NotFound, "Booking slot was not found.");
    }

    public async Task<EnergyBookingSlot> ChangeSlotStatusAsync(string id, SlotStatus status, CancellationToken cancellationToken)
    {
        // Let operations mark battery-slot availability while preventing an invalid full-slot reopening.
        var slot = await db.Slots.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "Booking slot was not found.");
        if (status == SlotStatus.Available && slot.ReservedCapacity >= slot.TotalCapacity)
            throw new ApiException(StatusCodes.Status409Conflict, "A full slot cannot be marked available.");
        slot.Status = status;
        slot.UpdatedAtUtc = DateTime.UtcNow;
        await db.Slots.ReplaceOneAsync(x => x.Id == id, slot, cancellationToken: cancellationToken);
        return slot;
    }

    private async Task ValidateSlotAsync(SlotRequest request, string? currentId, CancellationToken cancellationToken)
    {
        // Validate station existence, times and overlapping schedules.
        if (request.StartUtc.ToUniversalTime() <= DateTime.UtcNow || request.EndUtc.ToUniversalTime() <= request.StartUtc.ToUniversalTime())
            throw new ApiException(StatusCodes.Status400BadRequest, "Slot must have valid future start and end times.");
        var station = await db.Stations.Find(x => x.Id == request.StationId && x.Status == NodeStatus.Active).AnyAsync(cancellationToken);
        if (!station) throw new ApiException(StatusCodes.Status404NotFound, "Active microgrid node was not found.");
        var overlap = await db.Slots.Find(x => x.StationId == request.StationId && x.Id != currentId && x.StartUtc < request.EndUtc.ToUniversalTime() && x.EndUtc > request.StartUtc.ToUniversalTime()).AnyAsync(cancellationToken);
        if (overlap) throw new ApiException(StatusCodes.Status409Conflict, "The station already has an overlapping slot.");
    }

    private static SolarStationInfo MapStation(StationRequest request)
    {
        // Convert the station request into a normalized MongoDB document.
        return new SolarStationInfo { Name = request.Name.Trim(), Address = request.Address.Trim(), Latitude = request.Latitude, Longitude = request.Longitude, CapacityKwh = request.CapacityKwh, BatteryStorageSlots = request.BatteryStorageSlots, OperatorUserId = request.OperatorUserId, OperatingHours = request.OperatingHours.Trim() };
    }

    private static SlotStatus CalculateSlotStatus(EnergyBookingSlot slot)
    {
        // Derive slot availability from its reserved and total capacity.
        return slot.ReservedCapacity >= slot.TotalCapacity ? SlotStatus.FullyBooked : SlotStatus.Available;
    }
}
