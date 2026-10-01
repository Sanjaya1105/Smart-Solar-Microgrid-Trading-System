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

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        // Verify credentials and allow only active accounts to receive a JWT.
        var key = request.NicOrEmail.Trim();
        var user = await db.Users.Find(x => x.Nic == key.ToUpperInvariant() || x.Email == key.ToLowerInvariant()).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status401Unauthorized, "Invalid login credentials.");
        if (!passwords.Verify(request.Password, user.PasswordHash))
            throw new ApiException(StatusCodes.Status401Unauthorized, "Invalid login credentials.");
        if (user.Status != AccountStatus.Active)
            throw new ApiException(StatusCodes.Status403Forbidden, $"Account is {user.Status}.");
        var (token, expires) = tokens.CreateAccessToken(user);
        return new LoginResponse(token, expires, user.Id!, user.Nic, user.FullName, user.Role.ToString(), user.Status.ToString());
    }
    public async Task ChangePasswordAsync(string userId, ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        // Verify the current password and atomically replace its hash for an active account.
        var user = await db.Users.Find(x => x.Id == userId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status401Unauthorized, "Account was not found.");
        if (user.Status != AccountStatus.Active)
            throw new ApiException(StatusCodes.Status403Forbidden, "Account is not active.");
        if (!passwords.Verify(request.CurrentPassword, user.PasswordHash))
            throw new ApiException(StatusCodes.Status400BadRequest, "Current password is incorrect.");
        if (request.CurrentPassword == request.NewPassword)
            throw new ApiException(StatusCodes.Status400BadRequest, "Choose a different new password.");
        var result = await db.Users.UpdateOneAsync(
            x => x.Id == userId && x.PasswordHash == user.PasswordHash && x.Status == AccountStatus.Active,
            Builders<AppUser>.Update.Set(x => x.PasswordHash, passwords.Hash(request.NewPassword))
                .Set(x => x.UpdatedAtUtc, DateTime.UtcNow), cancellationToken: cancellationToken);
        if (result.ModifiedCount != 1)
            throw new ApiException(StatusCodes.Status409Conflict, "Account changed. Please sign in again and retry.");
    }

    public async Task<object> GetAccountAsync(string userId, CancellationToken cancellationToken)
    {
        // Return safe display fields for the authenticated account.
        var user = await db.Users.Find(x => x.Id == userId).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status401Unauthorized, "Account was not found.");
        return new { user.FullName, user.Email };
    }
}
