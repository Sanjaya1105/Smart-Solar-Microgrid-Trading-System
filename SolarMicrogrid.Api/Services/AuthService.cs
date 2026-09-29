/*
 * File: AuthService.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Central authentication and prosumer registration business logic.
 */
using MongoDB.Driver;
using SolarMicrogrid.Api.DTOs;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.Services;

public sealed class AuthService(MongoDbContext db, PasswordService passwords, TokenService tokens)
{
    public async Task<AppUser> RegisterProsumerAsync(RegisterProsumerRequest request, CancellationToken cancellationToken)
    {
        // Register a prosumer in Pending state for Backoffice activation.
        var user = new AppUser
        {
            Nic = request.Nic.Trim().ToUpperInvariant(),
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Phone = request.Phone.Trim(),
            Address = request.Address.Trim(),
            PasswordHash = passwords.Hash(request.Password),
            Role = UserRole.Prosumer,
            Status = AccountStatus.Pending
        };
        await db.Users.InsertOneAsync(user, cancellationToken: cancellationToken);
        user.PasswordHash = string.Empty;
        return user;
    }
}
