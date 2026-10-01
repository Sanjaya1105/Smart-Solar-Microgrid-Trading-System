/*
 * File: UsersController.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Backoffice user administration and prosumer self-service endpoints.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SolarMicrogrid.Api.DTOs;
using SolarMicrogrid.Api.Models;
using SolarMicrogrid.Api.Services;

namespace SolarMicrogrid.Api.Controllers;

[ApiController, Route("api/users"), Authorize]
public sealed class UsersController(UserService service, AuthService auth) : ControllerBase
{
    [HttpGet, Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> GetAll([FromQuery] UserRole? role, [FromQuery] AccountStatus? status, CancellationToken cancellationToken)
    {
        // Return Backoffice-filtered users including pending activation requests.
        return Ok(await service.GetAllAsync(role, status, cancellationToken));
    }

    [HttpGet("{id}"), Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> GetById(string id, CancellationToken cancellationToken)
    {
        // Return one selected account for Backoffice management.
        return Ok(await service.GetByIdAsync(id, cancellationToken));
    }

    [HttpPost("prosumers"), Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> CreateProsumer(RegisterProsumerRequest request, CancellationToken cancellationToken)
    {
        // Let Backoffice register a pending prosumer using the shared account validation.
        var user = await auth.RegisterProsumerAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, user);
    }

    [HttpPost("staff"), Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> CreateStaff(CreateStaffUserRequest request, CancellationToken cancellationToken)
    {
        // Create a Backoffice or Grid Operator web user.
        var user = await service.CreateStaffAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, user);
    }

    [HttpPut("{id}"), Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> Update(string id, UpdateUserRequest request, CancellationToken cancellationToken)
    {
        // Update a selected user's profile through the central service.
        return Ok(await service.UpdateAsync(id, request, cancellationToken));
    }

    [HttpPatch("{id}/status"), Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> ChangeStatus(string id, ChangeAccountStatusRequest request, CancellationToken cancellationToken)
    {
        // Activate, deactivate or otherwise resolve a managed account state.
        return Ok(await service.ChangeStatusAsync(id, request.Status, cancellationToken));
    }

    [HttpGet("me"), Authorize(Roles = "Prosumer")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        // Return the authenticated prosumer profile.
        return Ok(await service.GetByIdAsync(User.UserId(), cancellationToken));
    }

    [HttpPut("me"), Authorize(Roles = "Prosumer")]
    public async Task<IActionResult> UpdateMe(UpdateUserRequest request, CancellationToken cancellationToken)
    {
        // Update only the authenticated prosumer's profile.
        return Ok(await service.UpdateOwnProfileAsync(User.UserId(), request, cancellationToken));
    }

    [HttpPost("me/request-deactivation"), Authorize(Roles = "Prosumer")]
    public async Task<IActionResult> RequestDeactivation(CancellationToken cancellationToken)
    {
        // Submit an account-deactivation request for Backoffice action.
        await service.RequestOwnDeactivationAsync(User.UserId(), cancellationToken);
        return NoContent();
    }
}
