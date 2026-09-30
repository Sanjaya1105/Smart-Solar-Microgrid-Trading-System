/*
 * File: EnergyBookingSlot.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: MongoDB station schedule/energy slot document.
 */
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SolarMicrogrid.Api.Models;

public sealed class EnergyBookingSlot
{
    [BsonId, BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    [BsonRepresentation(BsonType.ObjectId)]
    public string StationId { get; set; } = string.Empty;
    public DateTime StartUtc { get; set; }
    public DateTime EndUtc { get; set; }
    public int TotalCapacity { get; set; }
    public int ReservedCapacity { get; set; }
    [BsonRepresentation(BsonType.String)]
    public SlotStatus Status { get; set; } = SlotStatus.Available;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
