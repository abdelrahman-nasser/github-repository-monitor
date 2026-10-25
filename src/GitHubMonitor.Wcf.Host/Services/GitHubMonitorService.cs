using System.Net;
using CoreWCF;
using GitHubMonitor.Application.Abstractions;
using GitHubMonitor.Application.UseCases;
using GitHubMonitor.Infrastructure.GitHub;
using GitHubMonitor.Wcf.Contracts;
using GitHubMonitor.Wcf.Contracts.Models;

namespace GitHubMonitor.Wcf.Host.Services;

public sealed class GitHubMonitorService(
    GetLiveCommitsUseCase getLiveCommits,
    IScheduledCommitsStore scheduledStore) : IGitHubMonitorService
{
    public string Ping()
    {
        return "GitHub Monitor WCF is running";
    }

    public async Task<GitCommitDto[]> GetLiveCommitsAsync()
    {
        try
        {
            var commits = await getLiveCommits.ExecuteAsync();

            return commits.Select(commit => new GitCommitDto
            {
                Sha = commit.Sha,
                Message = commit.Message,
                Author = commit.Author,
                Date = commit.Date.UtcDateTime,
                Source = "Live"
            }).ToArray();
        }
        catch (TimeoutException)
        {
            throw CreateFault("Timeout");
        }
        catch (GitHubRateLimitException)
        {
            throw CreateFault("RateLimited");
        }
        catch (HttpRequestException exception)
        {
            var code = exception.StatusCode switch
            {
                HttpStatusCode.Unauthorized => "Authentication",
                HttpStatusCode.Forbidden => "AccessDenied",
                HttpStatusCode.NotFound => "RepositoryUnavailable",
                HttpStatusCode.TooManyRequests => "RateLimited",
                _ => "UpstreamUnavailable"
            };

            throw CreateFault(code);
        }
    }

    private static FaultException<GitHubFault> CreateFault(string code)
    {
        // Only an allowlisted classification crosses SOAP; no exception/body/credentials.
        return new FaultException<GitHubFault>(
            new GitHubFault { Code = code },
            new FaultReason("GitHub request could not be completed."),
            new FaultCode("Receiver"),
            GitHubFault.Action);
    }

    public Task<ScheduledCommitsDto> GetScheduledCommitsAsync()
    {
        // Read cached data without calling GitHub
        var snapshot = scheduledStore.GetSnapshot();

        var result = new ScheduledCommitsDto
        {
            Commits = snapshot.Commits.Select(commit => new GitCommitDto
            {
                Sha = commit.Sha,
                Message = commit.Message,
                Author = commit.Author,
                Date = commit.Date.UtcDateTime,
                Source = "Scheduled"
            }).ToArray(),

            LastSyncTime = snapshot.LastSyncTime?.UtcDateTime
        };

        return Task.FromResult(result);
    }
}
