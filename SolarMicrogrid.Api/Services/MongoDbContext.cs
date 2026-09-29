/*
 * File: MongoDbContext.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Central MongoDB connection and access to the four required collections.
 */
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using SolarMicrogrid.Api.Configuration;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.Services;

public sealed class MongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(IOptions<MongoDbSettings> settings)
    {
        // Create one reusable Mongo client/database connection for dependency injection.
        var client = new MongoClient(settings.Value.ConnectionString);
        _database = client.GetDatabase(settings.Value.DatabaseName);
    }

    public IMongoCollection<AppUser> Users => _database.GetCollection<AppUser>("Users");
    public IMongoCollection<SolarStationInfo> Stations => _database.GetCollection<SolarStationInfo>("SolarStationInfo");
    public IMongoCollection<EnergyBookingSlot> Slots => _database.GetCollection<EnergyBookingSlot>("EnergyBookingSlots");
    public IMongoCollection<EnergyReservation> Reservations => _database.GetCollection<EnergyReservation>("EnergyReservations");

    public async Task PingAsync(CancellationToken cancellationToken)
    {
        // Verify that the configured MongoDB server is reachable.
        await _database.RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1), cancellationToken: cancellationToken);
    }

    public async Task CreateIndexesAsync(CancellationToken cancellationToken)
    {
        // Enforce unique identities and add indexes used by common filters.
        await Users.Indexes.CreateManyAsync(new[]
        {
            new CreateIndexModel<AppUser>(Builders<AppUser>.IndexKeys.Ascending(x => x.Nic), new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<AppUser>(Builders<AppUser>.IndexKeys.Ascending(x => x.Email), new CreateIndexOptions { Unique = true })
        }, cancellationToken: cancellationToken);
        await Slots.Indexes.CreateOneAsync(new CreateIndexModel<EnergyBookingSlot>(Builders<EnergyBookingSlot>.IndexKeys.Ascending(x => x.StationId).Ascending(x => x.StartUtc)), cancellationToken: cancellationToken);
        await Reservations.Indexes.CreateOneAsync(new CreateIndexModel<EnergyReservation>(Builders<EnergyReservation>.IndexKeys.Ascending(x => x.ProsumerUserId).Descending(x => x.CreatedAtUtc)), cancellationToken: cancellationToken);
    }
}
