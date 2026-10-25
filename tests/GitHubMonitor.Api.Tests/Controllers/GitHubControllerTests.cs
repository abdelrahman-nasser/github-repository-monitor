using GitHubMonitor.Api.Clients;
using GitHubMonitor.Api.Clients.Models;
using GitHubMonitor.Api.Controllers;
using GitHubMonitor.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace GitHubMonitor.Api.Tests.Controllers;

public sealed class GitHubControllerTests
{
    [Fact]
    public async Task GetLiveCommits_ReturnsTypedSuccessResponse()
    {
        var client = new FakeWcfMonitorClient
        {
            LiveCommits =
            [
                new GitCommitDto
                {
                    Sha = "abc123",
                    Message = "Test commit",
                    Author = "Test Author",
                    Source = "Live",
                    Date = DateTime.UtcNow
                }
            ]
        };

        var controller = new GitHubController(client);

        var result = await controller.GetLiveCommits(
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<GitCommitDto[]>>(
            ok.Value);

        Assert.True(response.Success);
        Assert.Single(response.Data!);
        Assert.Equal("abc123", response.Data![0].Sha);
    }

    [Fact]
    public async Task GetScheduledCommits_ReturnsSnapshot()
    {
        var lastSync = DateTime.UtcNow;

        var client = new FakeWcfMonitorClient
        {
            ScheduledCommits = new ScheduledCommitsDto
            {
                LastSyncTime = lastSync,
                Commits =
                [
                    new GitCommitDto
                    {
                        Sha = "scheduled123",
                        Source = "Scheduled"
                    }
                ]
            }
        };

        var controller = new GitHubController(client);

        var result = await controller.GetScheduledCommits(
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<ScheduledCommitsDto>>(
            ok.Value);

        Assert.True(response.Success);
        Assert.Equal(lastSync, response.Data!.LastSyncTime);
        Assert.Single(response.Data.Commits);
    }

    [Fact]
    public async Task GetLiveCommits_EmptyRepository_ReturnsEmptyArray()
    {
        var controller = new GitHubController(
            new FakeWcfMonitorClient());

        var result = await controller.GetLiveCommits(
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse<GitCommitDto[]>>(
            ok.Value);

        Assert.True(response.Success);
        Assert.Empty(response.Data!);
    }

    [Fact]
    public async Task GetLiveCommits_ForwardsCancellationToken()
    {
        using var cancellation = new CancellationTokenSource();
        var client = new FakeWcfMonitorClient();
        var controller = new GitHubController(client);

        await controller.GetLiveCommits(cancellation.Token);

        Assert.Equal(
            cancellation.Token,
            client.LastCancellationToken);
    }

    private sealed class FakeWcfMonitorClient : IWcfMonitorClient
    {
        public GitCommitDto[] LiveCommits { get; init; } = [];

        public ScheduledCommitsDto ScheduledCommits { get; init; }
            = new();

        public CancellationToken LastCancellationToken { get; private set; }

        public Task<string> PingAsync(
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult("pong");
        }

        public Task<GitCommitDto[]> GetLiveCommitsAsync(
            CancellationToken cancellationToken = default)
        {
            LastCancellationToken = cancellationToken;
            return Task.FromResult(LiveCommits);
        }

        public Task<ScheduledCommitsDto> GetScheduledCommitsAsync(
            CancellationToken cancellationToken = default)
        {
            LastCancellationToken = cancellationToken;
            return Task.FromResult(ScheduledCommits);
        }
    }
}
