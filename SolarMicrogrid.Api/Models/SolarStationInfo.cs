/*
 * File: SolarStationInfo.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: MongoDB microgrid node document including GPS and capacity details.
 */
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SolarMicrogrid.Api.Models;

public sealed class SolarStationInfo
{
    [BsonId, BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public decimal CapacityKwh { get; set; }
    public int BatteryStorageSlots { get; set; }
    [BsonRepresentation(BsonType.String)]
    public NodeStatus Status { get; set; } = NodeStatus.Active;
    public string? OperatorUserId { get; set; }
    public string OperatingHours { get; set; } = "08:00-18:00";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
