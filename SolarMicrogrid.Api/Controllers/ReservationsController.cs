 
 /*
 * File: ReservationsController.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Prosumer booking, operator approval/QR and dashboard endpoints.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SolarMicrogrid.Api.DTOs;
using SolarMicrogrid.Api.Models;
using SolarMicrogrid.Api.Services;

namespace SolarMicrogrid.Api.Controllers;

[ApiController, Route("api/reservations"), Authorize]
public sealed class ReservationsController(ReservationService service) : ControllerBase
{
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

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(string id, CancellationToken cancellationToken)
    {
        // Cancel an owned booking or allow authorized staff assistance.
        var staff = User.IsInRole(UserRole.Backoffice.ToString()) || User.IsInRole(UserRole.GridOperator.ToString());
        return Ok(await service.CancelAsync(id, User.UserId(), staff, cancellationToken));
    }
}
