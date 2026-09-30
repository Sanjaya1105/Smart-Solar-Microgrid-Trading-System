/*
 * File: DomainEnums.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Shared role, status and reservation type values.
 */
namespace SolarMicrogrid.Api.Models;

public enum UserRole { Backoffice, GridOperator, Prosumer }
public enum AccountStatus { Pending, Active, DeactivationRequested, Inactive }
public enum NodeStatus { Active, Inactive }
public enum SlotStatus { Available, Unavailable, FullyBooked }
public enum ReservationStatus { Pending, Approved, Cancelled, Completed, Rejected }
public enum EnergyTransactionType { DropOff, Charging }
