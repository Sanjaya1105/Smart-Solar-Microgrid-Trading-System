 public async Task<IActionResult> Create(CreateReservationRequest request, CancellationToken cancellationToken)
    {
        // Create a pending reservation owned by the authenticated prosumer.
        var reservation = await service.CreateAsync(User.UserId(), request, cancellationToken);
        return CreatedAtAction(nameof(GetMine), new { id = reservation.Id }, reservation);
    }

