using GitHubMonitor.Api.Clients.Models;

namespace GitHubMonitor.Api.Clients;

public interface IWcfMonitorClient
{
    Task<string> PingAsync(
        CancellationToken cancellationToken = default);

    Task<GitCommitDto[]> GetLiveCommitsAsync(
        CancellationToken cancellationToken = default);
}
