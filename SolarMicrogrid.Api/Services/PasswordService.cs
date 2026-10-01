/*
 * File: PasswordService.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Password hashing and verification using PBKDF2 with a random salt.
 */
using System.Security.Cryptography;

namespace SolarMicrogrid.Api.Services;

public sealed class PasswordService
{
    public string Hash(string password)
    {
        // Generate a unique salt and derive a slow password hash.
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public bool Verify(string password, string storedHash)
    {
        // Recreate the derived hash and compare it without timing leaks.
        var parts = storedHash.Split('.', 2);
        if (parts.Length != 2) return false;
        try
        {
            var salt = Convert.FromBase64String(parts[0]);
            var expected = Convert.FromBase64String(parts[1]);
            var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
