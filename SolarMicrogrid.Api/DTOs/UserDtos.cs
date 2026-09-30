/*
 * File: UserDtos.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: User administration and self-service contracts.
 */
using System.ComponentModel.DataAnnotations;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.DTOs;

public sealed record CreateStaffUserRequest(
    [Required] string Nic, [Required] string FullName, [Required, EmailAddress] string Email,
    [Required, Phone] string Phone, [Required] string Address, [Required, MinLength(8)] string Password,
    UserRole Role);
public sealed record UpdateUserRequest([Required] string FullName, [Required, EmailAddress] string Email, [Required, Phone] string Phone, [Required] string Address);
public sealed record ChangeAccountStatusRequest(AccountStatus Status);
