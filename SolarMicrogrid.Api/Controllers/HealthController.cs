/*
 * File: HealthController.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Lightweight endpoint used to verify IIS/API availability.
 */
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SolarMicrogrid.Api.Services;

namespace SolarMicrogrid.Api.Controllers;

[ApiController, Route("api/health")]
public sealed class HealthController(MongoDbContext db) : ControllerBase
{
    [HttpGet, AllowAnonymous]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        // Verify both the API process and its MongoDB connection for deployment checks.
        await db.PingAsync(cancellationToken);
        return Ok(new { status = "healthy", database = "connected", utc = DateTime.UtcNow });
    }
}
