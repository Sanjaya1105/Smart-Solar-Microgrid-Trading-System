/*
 * File: ReservationDtos.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Reservation workflow, QR and dashboard contracts.
 */
using System.ComponentModel.DataAnnotations;
using SolarMicrogrid.Api.Models;

namespace SolarMicrogrid.Api.DTOs;

public sealed record CreateReservationRequest([Required] string SlotId, EnergyTransactionType TransactionType, [Range(0.01, double.MaxValue)] decimal EnergyKwh);
public sealed record UpdateReservationRequest([Required] string SlotId, EnergyTransactionType TransactionType, [Range(0.01, double.MaxValue)] decimal EnergyKwh);
public sealed record CompleteReservationRequest([Required] string QrToken);
public sealed record ReservationQuery(string? Search, ReservationStatus? Status, DateTime? FromUtc, DateTime? ToUtc);
public sealed record DashboardResponse(long PendingReservations, long ApprovedFutureReservations, long CompletedReservations, long ActiveStations);

public sealed record StaffReservationRequest([Required] string ProsumerUserId, [Required] string SlotId, EnergyTransactionType TransactionType, [Range(0.01, double.MaxValue)] decimal EnergyKwh);
