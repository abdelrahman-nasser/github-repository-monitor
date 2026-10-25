using GitHubMonitor.Application.Abstractions;
using GitHubMonitor.Domain.Models;
using GitHubMonitor.Infrastructure.Scheduling;
using GitHubMonitor.Wcf.Host.Jobs;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quartz;

namespace GitHubMonitor.Wcf.Host.Tests.Jobs;

public sealed class SyncGitHubCommitsJobTests
{
    [Fact]
    public async Task Execute_SuccessfulFetch_UpdatesCacheAndTimestamp()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        IReadOnlyList<GitCommit> commits =
        [
            new("abc123", "Test commit", "Test Author", now)
        ];

        var provider = new Mock<IGitHubCommitProvider>();

        provider
            .Setup(x => x.GetLatestCommitsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(commits);

        var store = new InMemoryScheduledCommitsStore();
        var job = CreateJob(provider.Object, store);

        // Act
        var before = DateTimeOffset.UtcNow;

        await job.Execute(CreateContext(CancellationToken.None));

        var after = DateTimeOffset.UtcNow;
        var snapshot = store.GetSnapshot();

        // Assert
        Assert.Single(snapshot.Commits);
        Assert.Equal("abc123", snapshot.Commits[0].Sha);

        Assert.NotNull(snapshot.LastSyncTime);
        Assert.InRange(snapshot.LastSyncTime.Value, before, after);

        provider.Verify(
            x => x.GetLatestCommitsAsync(It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Execute_GitHubFailure_PreservesPreviousSnapshot()
    {
        // Arrange
        var previousTime = DateTimeOffset.UtcNow.AddMinutes(-5);

        var store = new InMemoryScheduledCommitsStore();

        store.Save(
            [new GitCommit("old123", "Previous commit", "Author", previousTime)],
            previousTime);

        var provider = new Mock<IGitHubCommitProvider>();

        provider
            .Setup(x => x.GetLatestCommitsAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("GitHub unavailable"));

        var job = CreateJob(provider.Object, store);

        // Act
        await job.Execute(CreateContext(CancellationToken.None));

        var snapshot = store.GetSnapshot();

        // Assert
        Assert.Single(snapshot.Commits);
        Assert.Equal("old123", snapshot.Commits[0].Sha);
        Assert.Equal(previousTime, snapshot.LastSyncTime);
    }

    [Fact]
    public async Task Execute_Cancellation_PropagatesAndPreservesCache()
    {
        // Arrange
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        var store = new InMemoryScheduledCommitsStore();

        var provider = new Mock<IGitHubCommitProvider>();

        provider
            .Setup(x => x.GetLatestCommitsAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken token) =>
                Task.FromCanceled<IReadOnlyList<GitCommit>>(token));

        var job = CreateJob(provider.Object, store);

        // Act & Assert
        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => job.Execute(CreateContext(cancellation.Token)));

        var snapshot = store.GetSnapshot();

        Assert.Empty(snapshot.Commits);
        Assert.Null(snapshot.LastSyncTime);
    }

    private static SyncGitHubCommitsJob CreateJob(
        IGitHubCommitProvider provider,
        IScheduledCommitsStore store)
    {
        return new SyncGitHubCommitsJob(
            provider,
            store,
            NullLogger<SyncGitHubCommitsJob>.Instance);
    }

    private static IJobExecutionContext CreateContext(
        CancellationToken cancellationToken)
    {
        var context = new Mock<IJobExecutionContext>();

        context
            .SetupGet(x => x.CancellationToken)
            .Returns(cancellationToken);

        return context.Object;
    }
}
