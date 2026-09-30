/*
 * File: UserService.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Backoffice user management and prosumer self-service business logic.
 */
using MongoDB.Driver;
using SolarMicrogrid.Api.DTOs;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.Services;

public sealed class UserService(MongoDbContext db, PasswordService passwords)
{
    public async Task<List<AppUser>> GetAllAsync(UserRole? role, AccountStatus? status, CancellationToken cancellationToken)
    {
        // Return filtered users without exposing password hashes.
        var filter = Builders<AppUser>.Filter.Empty;
        if (role.HasValue) filter &= Builders<AppUser>.Filter.Eq(x => x.Role, role.Value);
        if (status.HasValue) filter &= Builders<AppUser>.Filter.Eq(x => x.Status, status.Value);
        var users = await db.Users.Find(filter).SortBy(x => x.FullName).ToListAsync(cancellationToken);
        users.ForEach(x => x.PasswordHash = string.Empty);
        return users;
    }

    public async Task<AppUser> GetByIdAsync(string id, CancellationToken cancellationToken)
    {
        // Find one user and remove its password hash before returning it.
        var user = await db.Users.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "User was not found.");
        user.PasswordHash = string.Empty;
        return user;
    }

    public async Task<AppUser> CreateStaffAsync(CreateStaffUserRequest request, CancellationToken cancellationToken)
    {
        // Create only supported web staff roles; prosumers register through the mobile endpoint.
        if (request.Role is not (UserRole.Backoffice or UserRole.GridOperator))
            throw new ApiException(StatusCodes.Status400BadRequest, "Staff role must be Backoffice or GridOperator.");
        var user = new AppUser
        {
            Nic = request.Nic.Trim().ToUpperInvariant(), FullName = request.FullName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(), Phone = request.Phone.Trim(), Address = request.Address.Trim(),
            PasswordHash = passwords.Hash(request.Password), Role = request.Role, Status = AccountStatus.Active
        };
        await db.Users.InsertOneAsync(user, cancellationToken: cancellationToken);
        user.PasswordHash = string.Empty;
        return user;
    }

    public async Task<AppUser> UpdateAsync(string id, UpdateUserRequest request, CancellationToken cancellationToken)
    {
        // Update safe profile fields while preserving identity, role and account status.
        var update = Builders<AppUser>.Update
            .Set(x => x.FullName, request.FullName.Trim()).Set(x => x.Email, request.Email.Trim().ToLowerInvariant())
            .Set(x => x.Phone, request.Phone.Trim()).Set(x => x.Address, request.Address.Trim()).Set(x => x.UpdatedAtUtc, DateTime.UtcNow);
        var user = await db.Users.FindOneAndUpdateAsync<AppUser, AppUser>(x => x.Id == id, update, new FindOneAndUpdateOptions<AppUser, AppUser> { ReturnDocument = ReturnDocument.After }, cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "User was not found.");
        user.PasswordHash = string.Empty;
        return user;
    }

    public async Task<AppUser> ChangeStatusAsync(string id, AccountStatus status, CancellationToken cancellationToken)
    {
        // Let Backoffice activate, deactivate or reject pending/deactivation requests.
        var update = Builders<AppUser>.Update.Set(x => x.Status, status).Set(x => x.UpdatedAtUtc, DateTime.UtcNow);
        var user = await db.Users.FindOneAndUpdateAsync<AppUser, AppUser>(x => x.Id == id, update, new FindOneAndUpdateOptions<AppUser, AppUser> { ReturnDocument = ReturnDocument.After }, cancellationToken)
            ?? throw new ApiException(StatusCodes.Status404NotFound, "User was not found.");
        user.PasswordHash = string.Empty;
        return user;
    }

    public async Task<AppUser> UpdateOwnProfileAsync(string userId, UpdateUserRequest request, CancellationToken cancellationToken)
    {
        // Allow an authenticated prosumer to modify only their own profile.
        return await UpdateAsync(userId, request, cancellationToken);
    }

    public async Task RequestOwnDeactivationAsync(string userId, CancellationToken cancellationToken)
    {
        // Record a prosumer deactivation request for Backoffice action.
        var result = await db.Users.UpdateOneAsync(
            x => x.Id == userId && x.Role == UserRole.Prosumer && x.Status == AccountStatus.Active,
            Builders<AppUser>.Update.Set(x => x.Status, AccountStatus.DeactivationRequested).Set(x => x.UpdatedAtUtc, DateTime.UtcNow),
            cancellationToken: cancellationToken);
        if (result.ModifiedCount == 0)
            throw new ApiException(StatusCodes.Status409Conflict, "Only an active prosumer can request deactivation.");
    }
}
