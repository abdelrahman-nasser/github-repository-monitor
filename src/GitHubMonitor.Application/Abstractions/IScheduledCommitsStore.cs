using GitHubMonitor.Application.Models;
using GitHubMonitor.Domain.Models;

namespace GitHubMonitor.Application.Abstractions;

public interface IScheduledCommitsStore
{
    ScheduledCommitsSnapshot GetSnapshot();

    void Save(
        IReadOnlyList<GitCommit> commits,
        DateTimeOffset lastSyncTime);
}
