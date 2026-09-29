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
    [HttpGet("prosumers"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> BookingProsumers(CancellationToken cancellationToken)
    {
        // Expose only the active prosumer identity fields needed for staff-assisted bookings.
        return Ok(await service.GetBookingProsumersAsync(cancellationToken));
    }

    [HttpPost("staff"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> CreateForProsumer(StaffReservationRequest request, CancellationToken cancellationToken)
    {
        // Staff assistance uses the same active-account, seven-day and capacity rules.
        return Ok(await service.CreateAsync(request.ProsumerUserId, new CreateReservationRequest(request.SlotId, request.TransactionType, request.EnergyKwh), cancellationToken));
    }

    [HttpPut("{id}/staff"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> UpdateForProsumer(string id, UpdateReservationRequest request, CancellationToken cancellationToken)
    {
        // Staff may help edit an existing reservation without changing its owner or bypassing notice rules.
        return Ok(await service.UpdateForStaffAsync(id, request, cancellationToken));
    }

    [HttpPost, Authorize(Roles = "Prosumer")]
    public async Task<IActionResult> Create(CreateReservationRequest request, CancellationToken cancellationToken)
    {
        // Create a pending reservation owned by the authenticated prosumer.
        var reservation = await service.CreateAsync(User.UserId(), request, cancellationToken);
        return CreatedAtAction(nameof(GetMine), new { id = reservation.Id }, reservation);
    }

    [HttpPut("{id}"), Authorize(Roles = "Prosumer")]
    public async Task<IActionResult> Update(string id, UpdateReservationRequest request, CancellationToken cancellationToken)
    {
        // Modify an owned reservation subject to the twelve-hour rule.
        return Ok(await service.UpdateAsync(id, User.UserId(), request, cancellationToken));
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(string id, CancellationToken cancellationToken)
    {
        // Cancel an owned booking or allow authorized staff assistance.
        var staff = User.IsInRole(UserRole.Backoffice.ToString()) || User.IsInRole(UserRole.GridOperator.ToString());
        return Ok(await service.CancelAsync(id, User.UserId(), staff, cancellationToken));
    }

    [HttpGet("mine"), Authorize(Roles = "Prosumer")]
    public async Task<IActionResult> GetMine([FromQuery] string? search, [FromQuery] ReservationStatus? status, [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken cancellationToken)
    {
        // Return current, pending and historical reservations for the signed-in prosumer.
        return Ok(await service.GetMineAsync(User.UserId(), new ReservationQuery(search, status, fromUtc, toUtc), cancellationToken));
    }

    [HttpGet("operations"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> GetOperations([FromQuery] string? search, [FromQuery] ReservationStatus? status, [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken cancellationToken)
    {
        // Supply searchable reservation monitoring data to operational clients.
        return Ok(await service.GetOperationalAsync(new ReservationQuery(search, status, fromUtc, toUtc), cancellationToken));
    }

    [HttpPost("{id}/decision"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> Decision(string id, [FromQuery] bool approve, CancellationToken cancellationToken)
    {
        // Approve and issue a QR token or reject and release capacity.
        return Ok(await service.ApproveAsync(id, approve, cancellationToken));
    }

    [HttpPost("{id}/qr"), Authorize(Roles = "Prosumer")]
    public async Task<IActionResult> RegenerateQr(string id, CancellationToken cancellationToken)
    {
        // Return a fresh signed QR payload for an approved owned booking.
        return Ok(await service.RegenerateQrAsync(id, User.UserId(), cancellationToken));
    }

    [HttpPost("complete-by-qr"), Authorize(Roles = "GridOperator")]
    public async Task<IActionResult> CompleteByQr(CompleteReservationRequest request, CancellationToken cancellationToken)
    {
        // Verify the scanned QR against server state and finalize the transfer.
        return Ok(await service.CompleteByQrAsync(User.UserId(), request.QrToken, cancellationToken));
    }

    [HttpGet("dashboard"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> Dashboard(CancellationToken cancellationToken)
    {
        // Return live pending, approved-future, completed and station counters.
        return Ok(await service.GetDashboardAsync(cancellationToken));
    }
}
