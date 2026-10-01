/*
 * File: TokenService.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Issues JWT access tokens and signed reservation QR tokens.
 */
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SolarMicrogrid.Api.Configuration;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.Services;

public sealed class TokenService(IOptions<JwtSettings> options)
{
    private readonly JwtSettings _settings = options.Value;

    public (string Token, DateTime ExpiresAtUtc) CreateAccessToken(AppUser user)
    {
        // Build a signed JWT containing the user identity, NIC and application role.
        var expires = DateTime.UtcNow.AddMinutes(_settings.ExpiryMinutes);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id!),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("nic", user.Nic)
        };
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(_settings.Issuer, _settings.Audience, claims, expires: expires, signingCredentials: credentials);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public string CreateQrToken(string reservationId)
    {
        // Sign a compact reservation payload so clients cannot forge QR values.
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(12));
        var payload = $"{reservationId}:{nonce}";
        return $"{payload}:{Sign(payload)}";
    }

    public bool TryReadQrToken(string token, out string reservationId)
    {
        // Validate the QR signature before returning its reservation identifier.
        reservationId = string.Empty;
        var parts = token.Split(':');
        if (parts.Length != 3) return false;
        var payload = $"{parts[0]}:{parts[1]}";
        var expected = Encoding.UTF8.GetBytes(Sign(payload));
        var supplied = Encoding.UTF8.GetBytes(parts[2]);
        if (!CryptographicOperations.FixedTimeEquals(expected, supplied)) return false;
        reservationId = parts[0];
        return true;
    }

    public string HashQrToken(string token)
    {
        // Store only a SHA-256 digest of the QR token in MongoDB.
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
    }

    private string Sign(string payload)
    {
        // Produce a URL-safe HMAC signature for a QR payload.
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_settings.QrSigningKey));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }
}
