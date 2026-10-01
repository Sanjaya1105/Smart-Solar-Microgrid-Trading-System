/*
 * File: JwtSettings.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Strongly typed JWT and QR-signing configuration values.
 */
namespace SolarMicrogrid.Api.Configuration;

public sealed class JwtSettings
{
    public const string SectionName = "Jwt";
    public string Issuer { get; set; } = "SolarMicrogrid.Api";
    public string Audience { get; set; } = "SolarMicrogrid.Clients";
    public string Key { get; set; } = string.Empty;
    public int ExpiryMinutes { get; set; } = 120;
    public string QrSigningKey { get; set; } = string.Empty;
}
