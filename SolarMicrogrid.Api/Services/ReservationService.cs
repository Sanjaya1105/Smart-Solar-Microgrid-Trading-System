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

