using System.ServiceModel;
using GitHubMonitor.Api.Clients.Models;
using GitHubMonitor.Api.Models;
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
            FaultException<GitHubFault> fault => fault.Detail.Code switch
            {
                "Authentication" => (StatusCodes.Status502BadGateway,
                    "GitHub authentication failed. Check the server-side GitHub credentials."),
                "Timeout" => (StatusCodes.Status504GatewayTimeout,
                    "GitHub request timed out. Please try again."),
                "AccessDenied" => (StatusCodes.Status502BadGateway,
                    "GitHub denied repository access. Check the server-side GitHub permissions."),
                "RepositoryUnavailable" => (StatusCodes.Status502BadGateway,
                    "GitHub repository or branch is unavailable."),
                "RateLimited" => (StatusCodes.Status502BadGateway,
                    "GitHub rate limit exceeded. Please try again later."),
                "UpstreamUnavailable" => (StatusCodes.Status502BadGateway,
                    "GitHub service is temporarily unavailable."),
                _ => (StatusCodes.Status500InternalServerError,
                    "An unexpected error occurred.")
            },

            FaultException => (
                StatusCodes.Status500InternalServerError,
                "An unexpected error occurred."),

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
            new ApiResponse<object?>(
                Success: false,
                Message: message,
                Data: null),
            cancellationToken);

        return true;
    }
}
