/*
 * File: EnergyReservation.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: MongoDB energy trading reservation and QR verification document.
 */
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace SolarMicrogrid.Api.Models;

public sealed class EnergyReservation
{
    [BsonId, BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    [BsonRepresentation(BsonType.ObjectId)]
    public string SlotId { get; set; } = string.Empty;
    [BsonRepresentation(BsonType.ObjectId)]
    public string StationId { get; set; } = string.Empty;
    [BsonRepresentation(BsonType.ObjectId)]
    public string ProsumerUserId { get; set; } = string.Empty;
    public string ProsumerNic { get; set; } = string.Empty;
    [BsonRepresentation(BsonType.String)]
    public EnergyTransactionType TransactionType { get; set; }
    public decimal EnergyKwh { get; set; }
    [BsonRepresentation(BsonType.String)]
    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    public string? QrTokenHash { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public DateTime? CancelledAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public string? CompletedByOperatorId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
