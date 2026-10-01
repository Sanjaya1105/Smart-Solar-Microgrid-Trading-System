/*
 * File: ClaimsPrincipalExtensions.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Safely reads the authenticated user identifier from JWT claims.
 */
using System.Security.Claims;

namespace SolarMicrogrid.Api.Services;

public static class ClaimsPrincipalExtensions
{
    public static string UserId(this ClaimsPrincipal principal)
    {
        // Require the standard name-identifier claim issued by TokenService.
        return principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new ApiException(StatusCodes.Status401Unauthorized, "Authenticated user identifier is missing.");
    }
}
