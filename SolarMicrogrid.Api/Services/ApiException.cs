/*
 * File: ApiException.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Represents controlled HTTP errors raised by service-layer business rules.
 */
namespace SolarMicrogrid.Api.Services;

public sealed class ApiException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
