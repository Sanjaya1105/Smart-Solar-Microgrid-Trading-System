/*
 * File: StationsController.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Microgrid node, maps and schedule-slot REST endpoints.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SolarMicrogrid.Api.DTOs;
using SolarMicrogrid.Api.Services;

namespace SolarMicrogrid.Api.Controllers;

[ApiController, Route("api/stations"), Authorize]
public sealed class StationsController(StationService service, NearbyStationService nearby) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool activeOnly = true, CancellationToken cancellationToken = default)
    {
        // Supply station data to web administration and mobile booking screens.
        return Ok(await service.GetStationsAsync(activeOnly, cancellationToken));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id, CancellationToken cancellationToken)
    {
        // Return full details for a selected map marker or administration page.
        return Ok(await service.GetStationAsync(id, cancellationToken));
    }

    [HttpGet("nearby")]
    public async Task<IActionResult> Nearby([FromQuery] double latitude, [FromQuery] double longitude, [FromQuery] double radiusKm = 25, CancellationToken cancellationToken = default)
    {
        // Return distance-ranked active station markers for Google Maps.
        return Ok(await nearby.GetNearbyAsync(latitude, longitude, radiusKm, cancellationToken));
    }

    [HttpPost, Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> Create(StationRequest request, CancellationToken cancellationToken)
    {
        // Create a new microgrid node through Backoffice administration.
        var station = await service.CreateStationAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = station.Id }, station);
    }

    [HttpPut("{id}"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> Update(string id, StationRequest request, CancellationToken cancellationToken)
    {
        // Update node details, capacity or operating schedule.
        return Ok(await service.UpdateStationAsync(id, request, cancellationToken));
    }

    [HttpPost("{id}/deactivate"), Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> Deactivate(string id, CancellationToken cancellationToken)
    {
        // Deactivate a node only when service-layer reservation checks allow it.
        await service.DeactivateStationAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id}/activate"), Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> Activate(string id, CancellationToken cancellationToken)
    {
        // Reactivate a previously deactivated microgrid node.
        await service.ActivateStationAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpGet("slots")]
    public async Task<IActionResult> GetSlots([FromQuery] string? stationId, [FromQuery] bool availableOnly = true, CancellationToken cancellationToken = default)
    {
        // Supply current station slots to both client applications.
        return Ok(await service.GetSlotsAsync(stationId, availableOnly, cancellationToken));
    }

    [HttpPost("slots"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> CreateSlot(SlotRequest request, CancellationToken cancellationToken)
    {
        // Add a new operational booking slot to an active node.
        return Ok(await service.CreateSlotAsync(request, cancellationToken));
    }

    [HttpPut("slots/{id}"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> UpdateSlot(string id, SlotRequest request, CancellationToken cancellationToken)
    {
        // Update a booking slot while protecting existing reservation capacity.
        return Ok(await service.UpdateSlotAsync(id, request, cancellationToken));
    }

    [HttpDelete("slots/{id}"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> DeleteSlot(string id, CancellationToken cancellationToken)
    {
        // Delete an unused station slot.
        await service.DeleteSlotAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPatch("slots/{id}/status"), Authorize(Roles = "Backoffice,GridOperator")]
    public async Task<IActionResult> ChangeSlotStatus(string id, ChangeSlotStatusRequest request, CancellationToken cancellationToken)
    {
        // Update live battery-slot availability for operations.
        return Ok(await service.ChangeSlotStatusAsync(id, request.Status, cancellationToken));
    }
}
