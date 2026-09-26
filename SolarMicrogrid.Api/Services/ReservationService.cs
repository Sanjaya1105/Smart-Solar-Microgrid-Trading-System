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