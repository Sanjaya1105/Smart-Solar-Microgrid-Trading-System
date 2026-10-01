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

    [HttpPost("login"), AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        // Authenticate any active application role and return a role-bearing JWT.
        return Ok(await service.LoginAsync(request, cancellationToken));
    }
    [HttpGet("account"), Authorize]
    public async Task<IActionResult> Account(CancellationToken cancellationToken)
    {
        // Read only the authenticated account name and email.
        return Ok(await service.GetAccountAsync(User.UserId(), cancellationToken));
    }

    [HttpPost("change-password"), Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        // Change the authenticated account password after verifying the current password.
        await service.ChangePasswordAsync(User.UserId(), request, cancellationToken);
        return NoContent();
    }
}
