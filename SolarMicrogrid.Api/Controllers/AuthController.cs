/*
 * File: AuthController.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Public registration and login REST endpoints.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SolarMicrogrid.Api.DTOs;
using SolarMicrogrid.Api.Services;

namespace SolarMicrogrid.Api.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(AuthService service) : ControllerBase
{
    [HttpPost("register-prosumer"), AllowAnonymous]
    public async Task<IActionResult> Register(RegisterProsumerRequest request, CancellationToken cancellationToken)
    {
        // Register a mobile prosumer and return the pending account record.
        var user = await service.RegisterProsumerAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Register), new { id = user.Id }, user);
    }
}