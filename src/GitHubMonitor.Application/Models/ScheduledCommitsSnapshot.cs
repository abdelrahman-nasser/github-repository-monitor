using GitHubMonitor.Domain.Models;

namespace GitHubMonitor.Application.Models;

public sealed record ScheduledCommitsSnapshot(
    IReadOnlyList<GitCommit> Commits,
    DateTimeOffset? LastSyncTime);
