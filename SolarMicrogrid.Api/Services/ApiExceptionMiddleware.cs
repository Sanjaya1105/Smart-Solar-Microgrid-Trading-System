/*
 * File: ApiExceptionMiddleware.cs
 * Project: Smart Solar Microgrid Trading System
 * Purpose: Converts controlled and unexpected exceptions to consistent JSON errors.
 */
using System.Net;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace SolarMicrogrid.Api.Services;

public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        // Run the request and map exceptions to safe RFC 7807 problem responses.
        try
        {
            await next(context);
        }
        catch (ApiException ex)
        {
            await WriteProblemAsync(context, ex.StatusCode, ex.Message);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            await WriteProblemAsync(context, StatusCodes.Status409Conflict, "NIC or email already exists.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled API error");
            await WriteProblemAsync(context, StatusCodes.Status500InternalServerError, "An unexpected server error occurred.");
        }
    }

    private static async Task WriteProblemAsync(HttpContext context, int status, string detail)
    {
        // Write one consistent JSON error shape for web and Android clients.
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(new ProblemDetails { Status = status, Title = ((HttpStatusCode)status).ToString(), Detail = detail });
    }
}
