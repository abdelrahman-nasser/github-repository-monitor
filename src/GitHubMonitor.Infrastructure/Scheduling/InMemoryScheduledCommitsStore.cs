using GitHubMonitor.Application.Abstractions;
using GitHubMonitor.Application.Models;
using GitHubMonitor.Domain.Models;

namespace GitHubMonitor.Infrastructure.Scheduling;

public sealed class InMemoryScheduledCommitsStore
    : IScheduledCommitsStore
{
    private readonly object _sync = new();

    private ScheduledCommitsSnapshot _snapshot =
        new(Array.Empty<GitCommit>(), null);

    public ScheduledCommitsSnapshot GetSnapshot()
    {
        lock (_sync)
        {
            return _snapshot;
        }
    }

    public void Save(
        IReadOnlyList<GitCommit> commits,
        DateTimeOffset lastSyncTime)
    {
        // Create a defensive, read-only snapshot
        var snapshot = new ScheduledCommitsSnapshot(
            Array.AsReadOnly(commits.Take(10).ToArray()),
            lastSyncTime);

        lock (_sync)
        {
            _snapshot = snapshot;
        }
    }
}
