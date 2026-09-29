/*
 * File: AuthDtos.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Authentication and prosumer registration request/response contracts.
 */
using System.ComponentModel.DataAnnotations;

namespace SolarMicrogrid.Api.DTOs;

public sealed record LoginRequest([Required] string NicOrEmail, [Required] string Password);
public sealed record LoginResponse(string Token, DateTime ExpiresAtUtc, string UserId, string Nic, string FullName, string Role, string Status);
public sealed record RegisterProsumerRequest(
    [Required, StringLength(12, MinimumLength = 9)] string Nic,
    [Required, StringLength(100)] string FullName,
    [Required, EmailAddress] string Email,
    [Required, Phone] string Phone,
    [Required, StringLength(250)] string Address,
    [Required, MinLength(8)] string Password);

public sealed record ChangePasswordRequest([Required] string CurrentPassword, [Required, MinLength(8)] string NewPassword);
