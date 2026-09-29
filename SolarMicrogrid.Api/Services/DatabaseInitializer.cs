/*
 * File: DatabaseInitializer.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Creates indexes and optional demonstration data for all required collections.
 */
using MongoDB.Driver;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.Services;

public sealed class DatabaseInitializer(MongoDbContext db, PasswordService passwords, IConfiguration configuration, ILogger<DatabaseInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // Create database indexes and seed a repeatable local demonstration dataset when enabled.
        await db.CreateIndexesAsync(cancellationToken);
        if (!configuration.GetValue("SeedData:Enabled", true)) return;
        await SeedAsync(cancellationToken);
        logger.LogInformation("MongoDB indexes and demonstration data are ready.");
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        // No shutdown action is required because MongoClient manages pooled connections.
        return Task.CompletedTask;
    }

    private async Task SeedAsync(CancellationToken cancellationToken)
    {
        // Insert default role accounts, one station, one slot and one pending reservation only once.
        var password = configuration["SeedData:DefaultPassword"] ?? "ChangeMe123!";
        var backoffice = await EnsureUserAsync("900000001V", "Demo Backoffice", "backoffice@solar.local", UserRole.Backoffice, AccountStatus.Active, password, cancellationToken);
        await EnsureUserAsync("900000002V", "Demo Grid Operator", "operator@solar.local", UserRole.GridOperator, AccountStatus.Active, password, cancellationToken);
        var prosumer = await EnsureUserAsync("900000003V", "Demo Prosumer", "prosumer@solar.local", UserRole.Prosumer, AccountStatus.Active, password, cancellationToken);

        var station = await db.Stations.Find(x => x.Name == "Colombo Solar Hub").FirstOrDefaultAsync(cancellationToken);
        if (station is null)
        {
            station = new SolarStationInfo { Name = "Colombo Solar Hub", Address = "Colombo, Sri Lanka", Latitude = 6.9271, Longitude = 79.8612, CapacityKwh = 250, BatteryStorageSlots = 8, OperatingHours = "08:00-18:00", Status = NodeStatus.Active };
            await db.Stations.InsertOneAsync(station, cancellationToken: cancellationToken);
        }

        var slot = await db.Slots.Find(x => x.StationId == station.Id && x.StartUtc > DateTime.UtcNow).FirstOrDefaultAsync(cancellationToken);
        if (slot is null)
        {
            var start = DateTime.UtcNow.Date.AddDays(3).AddHours(10);
            slot = new EnergyBookingSlot { StationId = station.Id!, StartUtc = start, EndUtc = start.AddHours(1), TotalCapacity = 4, ReservedCapacity = 1 };
            await db.Slots.InsertOneAsync(slot, cancellationToken: cancellationToken);
        }

        var hasReservation = await db.Reservations.Find(x => x.ProsumerUserId == prosumer.Id && x.SlotId == slot.Id).AnyAsync(cancellationToken);
        if (!hasReservation)
        {
            var reservation = new EnergyReservation { SlotId = slot.Id!, StationId = station.Id!, ProsumerUserId = prosumer.Id!, ProsumerNic = prosumer.Nic, TransactionType = EnergyTransactionType.DropOff, EnergyKwh = 5, Status = ReservationStatus.Pending };
            await db.Reservations.InsertOneAsync(reservation, cancellationToken: cancellationToken);
        }
        _ = backoffice;
    }

    private async Task<AppUser> EnsureUserAsync(string nic, string name, string email, UserRole role, AccountStatus status, string password, CancellationToken cancellationToken)
    {
        // Return an existing seeded identity or create it with a secure password hash.
        var existing = await db.Users.Find(x => x.Nic == nic).FirstOrDefaultAsync(cancellationToken);
        if (existing is not null) return existing;
        var user = new AppUser { Nic = nic, FullName = name, Email = email, Phone = "+94770000000", Address = "Sri Lanka", PasswordHash = passwords.Hash(password), Role = role, Status = status };
        await db.Users.InsertOneAsync(user, cancellationToken: cancellationToken);
        return user;
    }
}
