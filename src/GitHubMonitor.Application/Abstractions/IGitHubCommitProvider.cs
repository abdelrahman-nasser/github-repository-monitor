using GitHubMonitor.Domain.Models;

namespace GitHubMonitor.Application.Abstractions;

public interface IGitHubCommitProvider
{
    Task<IReadOnlyList<GitCommit>> GetLatestCommitsAsync(
        CancellationToken cancellationToken = default);
}
