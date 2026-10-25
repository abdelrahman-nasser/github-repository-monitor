using GitHubMonitor.Domain.Models;
using GitHubMonitor.Infrastructure.Scheduling;

namespace GitHubMonitor.Infrastructure.Tests.Scheduling;

public sealed class InMemoryScheduledCommitsStoreTests
{
    [Fact]
    public void GetSnapshot_BeforeFirstSync_ReturnsEmptySnapshot()
    {
        var store = new InMemoryScheduledCommitsStore();

        var snapshot = store.GetSnapshot();

        Assert.Empty(snapshot.Commits);
        Assert.Null(snapshot.LastSyncTime);
    }

    [Fact]
    public void Save_ValidCommits_StoresCommitsAndTimestamp()
    {
        var store = new InMemoryScheduledCommitsStore();
        var now = DateTimeOffset.UtcNow;

        var commits = new List<GitCommit>
        {
            new("abc123", "Test commit", "Test Author", now)
        };

        store.Save(commits, now);

        var snapshot = store.GetSnapshot();

        Assert.Single(snapshot.Commits);
        Assert.Equal("abc123", snapshot.Commits[0].Sha);
        Assert.Equal(now, snapshot.LastSyncTime);
    }

    [Fact]
    public void Save_MoreThanTenCommits_StoresMaximumTen()
    {
        var store = new InMemoryScheduledCommitsStore();
        var now = DateTimeOffset.UtcNow;

        var commits = Enumerable.Range(1, 15)
            .Select(i => new GitCommit(
                $"sha-{i}",
                $"Commit {i}",
                "Test Author",
                now))
            .ToArray();

        store.Save(commits, now);

        var snapshot = store.GetSnapshot();

        Assert.Equal(10, snapshot.Commits.Count);
        Assert.Equal("sha-1", snapshot.Commits[0].Sha);
        Assert.Equal("sha-10", snapshot.Commits[9].Sha);
    }

    [Fact]
    public void Save_ModifiedInput_DoesNotChangeStoredSnapshot()
    {
        var store = new InMemoryScheduledCommitsStore();
        var now = DateTimeOffset.UtcNow;

        var commits = new List<GitCommit>
        {
            new("original", "Original commit", "Author", now)
        };

        store.Save(commits, now);

        // Modify the source collection after saving
        commits.Clear();

        var snapshot = store.GetSnapshot();

        Assert.Single(snapshot.Commits);
        Assert.Equal("original", snapshot.Commits[0].Sha);
    }
}
