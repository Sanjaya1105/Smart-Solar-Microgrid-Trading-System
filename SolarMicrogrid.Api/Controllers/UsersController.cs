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
    [HttpPatch("{id}/status"), Authorize(Roles = "Backoffice")]
    public async Task<IActionResult> ChangeStatus(string id, ChangeAccountStatusRequest request, CancellationToken cancellationToken)
    {
        // Activate, deactivate or otherwise resolve a managed account state.
        return Ok(await service.ChangeStatusAsync(id, request.Status, cancellationToken));
    }
}