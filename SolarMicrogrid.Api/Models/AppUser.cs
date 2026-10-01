/*
 * File: AppUser.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: MongoDB user/prosumer document; NIC is the unique business identifier.
 */
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;

namespace SolarMicrogrid.Api.Models;

public sealed class AppUser
{
    [BsonId, BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }
    [BsonElement("nic")]
    public string Nic { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    [JsonIgnore]
    public string PasswordHash { get; set; } = string.Empty;
    [BsonRepresentation(BsonType.String)]
    public UserRole Role { get; set; }
    [BsonRepresentation(BsonType.String)]
    public AccountStatus Status { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
