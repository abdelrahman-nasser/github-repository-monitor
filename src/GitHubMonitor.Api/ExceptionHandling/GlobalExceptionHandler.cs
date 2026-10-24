using System.ServiceModel;
using Microsoft.AspNetCore.Diagnostics;

namespace GitHubMonitor.Api.ExceptionHandling;

public sealed class GlobalExceptionHandler(
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, message) = exception switch
        {
            EndpointNotFoundException => (
                StatusCodes.Status503ServiceUnavailable,
                "WCF service is unavailable."),

            TimeoutException => (
                StatusCodes.Status504GatewayTimeout,
                "WCF service request timed out."),

            CommunicationException => (
                StatusCodes.Status503ServiceUnavailable,
                "Unable to communicate with WCF service."),

            _ => (
                StatusCodes.Status500InternalServerError,
                "An unexpected error occurred.")
        };

        logger.LogError(
            exception,
            "Request failed. Path: {Path}, Status: {StatusCode}",
            context.Request.Path,
            statusCode);

        context.Response.StatusCode = statusCode;

        await context.Response.WriteAsJsonAsync(
            new
            {
                success = false,
                message,
                data = (object?)null
            },
            cancellationToken);

        return true;
    }
}