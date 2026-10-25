using GitHubMonitor.Application.Abstractions;
using GitHubMonitor.Domain.Models;

namespace GitHubMonitor.Application.UseCases;

public sealed class GetLiveCommitsUseCase(
    IGitHubCommitProvider commitProvider)
{
    public Task<IReadOnlyList<GitCommit>> ExecuteAsync(
        CancellationToken cancellationToken = default)
    {
        return commitProvider.GetLatestCommitsAsync(cancellationToken);
    }
}
