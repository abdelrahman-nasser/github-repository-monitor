using System.Net;
using System.Text;
using System.Text.Json;
using GitHubMonitor.Infrastructure.GitHub;

namespace GitHubMonitor.Infrastructure.Tests.GitHub;

public sealed class GitHubCommitProviderTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(3, 3)]
    [InlineData(15, 10)]
    public async Task GetLatestCommitsAsync_ReturnsAvailableLatestTen(int upstreamCount, int expectedCount)
    {
        var json = JsonSerializer.Serialize(Enumerable.Range(1, upstreamCount).Select(index => new
        {
            sha = $"sha-{index}",
            commit = new
            {
                message = $"Commit {index}",
                author = new { name = "Author", date = "2026-10-24T13:45:23Z" }
            }
        }));
        using var client = new HttpClient(new FakeHttpMessageHandler(request =>
        {
            Assert.Equal("/repos/test-owner/test-repository/commits", request.RequestUri!.AbsolutePath);
            Assert.Contains("per_page=10", request.RequestUri.Query);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        }));
        var provider = new GitHubCommitProvider(client, new GitHubOptions
        {
            Owner = "test-owner",
            Repository = "test-repository",
            Token = "fake-test-token"
        });

        var commits = await provider.GetLatestCommitsAsync();

        Assert.Equal(expectedCount, commits.Count);
        Assert.Equal(Enumerable.Range(1, expectedCount).Select(index => $"sha-{index}"), commits.Select(commit => commit.Sha));
    }

    [Fact]
    public async Task GetLatestCommitsAsync_ValidResponse_ReturnsMappedCommits()
    {
        // Arrange
        const string json = """
            [
              {
                "sha": "abc123",
                "commit": {
                  "message": "Initial commit",
                  "author": {
                    "name": "Test Author",
                    "date": "2026-10-24T13:45:23Z"
                  }
                }
              }
            ]
            """;

        using var httpClient = new HttpClient(
            new FakeHttpMessageHandler(request =>
            {
                Assert.Equal(HttpMethod.Get, request.Method);

                Assert.Equal(
                    "Bearer",
                    request.Headers.Authorization?.Scheme);

                Assert.Equal(
                    "fake-test-token",
                    request.Headers.Authorization?.Parameter);

                Assert.Equal(
                    "IntegrationTaskApp",
                    request.Headers.UserAgent.ToString());

                Assert.Contains(
                    "sha=develop",
                    request.RequestUri!.Query);

                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(
                        json,
                        Encoding.UTF8,
                        "application/json")
                };
            }));

        var options = new GitHubOptions
        {
            Owner = "test-owner",
            Repository = "test-repository",
            Branch = "develop",
            Token = "fake-test-token"
        };

        var provider = new GitHubCommitProvider(
            httpClient,
            options);

        // Act
        var commits = await provider.GetLatestCommitsAsync();

        // Assert
        var commit = Assert.Single(commits);

        Assert.Equal("abc123", commit.Sha);
        Assert.Equal("Initial commit", commit.Message);
        Assert.Equal("Test Author", commit.Author);

        Assert.Equal(
            DateTimeOffset.Parse("2026-10-24T13:45:23Z"),
            commit.Date);
    }

    private sealed class FakeHttpMessageHandler(
        Func<HttpRequestMessage, HttpResponseMessage> responder)
        : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(responder(request));
        }
    }
}
