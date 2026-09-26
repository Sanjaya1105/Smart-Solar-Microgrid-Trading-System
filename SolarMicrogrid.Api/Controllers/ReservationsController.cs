 public async Task<IActionResult> Create(CreateReservationRequest request, CancellationToken cancellationToken)
    {
        // Create a pending reservation owned by the authenticated prosumer.
        var reservation = await service.CreateAsync(User.UserId(), request, cancellationToken);
        return CreatedAtAction(nameof(GetMine), new { id = reservation.Id }, reservation);
    }

[HttpPost("complete-by-qr"), Authorize(Roles = "GridOperator")]
    public async Task<IActionResult> CompleteByQr(CompleteReservationRequest request, CancellationToken cancellationToken)
    {
        // Verify the scanned QR against server state and finalize the transfer.
        return Ok(await service.CompleteByQrAsync(User.UserId(), request.QrToken, cancellationToken));
    }

