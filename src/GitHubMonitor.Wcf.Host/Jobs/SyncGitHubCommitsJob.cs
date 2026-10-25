using GitHubMonitor.Application.Abstractions;
using Quartz;

namespace GitHubMonitor.Wcf.Host.Jobs;

[DisallowConcurrentExecution]
public sealed class SyncGitHubCommitsJob(
    IGitHubCommitProvider commitProvider,
    IScheduledCommitsStore store,
    ILogger<SyncGitHubCommitsJob> logger) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        try
        {
            var commits = await commitProvider.GetLatestCommitsAsync(
                context.CancellationToken);

            var lastSyncTime = DateTimeOffset.UtcNow;

            store.Save(commits, lastSyncTime);

            logger.LogInformation(
                "GitHub scheduled sync completed. Commits: {Count}, LastSyncTime: {LastSyncTime}",
                commits.Count,
                lastSyncTime);
        }
        catch (OperationCanceledException)
            when (context.CancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            // Preserve the previous successful snapshot
            logger.LogError(
                exception,
                "GitHub scheduled sync failed. Existing cache preserved.");
        }
    }
}
