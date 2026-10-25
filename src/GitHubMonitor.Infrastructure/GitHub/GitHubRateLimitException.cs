using System.Net;

namespace GitHubMonitor.Infrastructure.GitHub;

public sealed class GitHubRateLimitException(HttpStatusCode statusCode)
    : HttpRequestException("GitHub rate limit exceeded.", null, statusCode)
{
}
