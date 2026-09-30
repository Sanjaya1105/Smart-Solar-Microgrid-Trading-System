/*
 * File: StationDtos.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Microgrid station and booking-slot request contracts.
 */
using System.ComponentModel.DataAnnotations;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.DTOs;

public sealed record StationRequest(
    [Required] string Name, [Required] string Address,
    [Range(-90, 90)] double Latitude, [Range(-180, 180)] double Longitude,
    [Range(0.01, double.MaxValue)] decimal CapacityKwh,
    [Range(1, int.MaxValue)] int BatteryStorageSlots,
    string? OperatorUserId, [Required] string OperatingHours);
public sealed record SlotRequest(
    [Required] string StationId, DateTime StartUtc, DateTime EndUtc,
    [Range(1, int.MaxValue)] int TotalCapacity);
public sealed record ChangeSlotStatusRequest(SlotStatus Status);
