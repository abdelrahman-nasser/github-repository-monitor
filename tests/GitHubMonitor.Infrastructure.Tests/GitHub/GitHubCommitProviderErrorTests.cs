using System.Net;
using System.Text;
using GitHubMonitor.Infrastructure.GitHub;

namespace GitHubMonitor.Infrastructure.Tests.GitHub;

public sealed class GitHubCommitProviderErrorTests
{
    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, "GitHub authentication failed.")]
    [InlineData(HttpStatusCode.Forbidden, "GitHub denied repository access.")]
    [InlineData(HttpStatusCode.NotFound, "GitHub repository or branch is unavailable.")]
    [InlineData(HttpStatusCode.TooManyRequests, "GitHub rate limit exceeded.")]
    [InlineData(HttpStatusCode.InternalServerError, "GitHub service is temporarily unavailable.")]
    public async Task GetLatestCommitsAsync_HttpError_ThrowsMeaningfulException(
        HttpStatusCode statusCode,
        string expectedMessage)
    {
        // Arrange
        using var httpClient = CreateClient(
            () => new HttpResponseMessage(statusCode));

        var provider = CreateProvider(httpClient);

        // Act
        var exception = await Assert.ThrowsAsync<HttpRequestException>(
            () => provider.GetLatestCommitsAsync());

        // Assert
        Assert.Equal(statusCode, exception.StatusCode);
        Assert.Equal(expectedMessage, exception.Message);
    }

    [Fact]
    public async Task GetLatestCommitsAsync_RateLimitedForbidden_ThrowsRateLimitException()
    {
        // Arrange
        using var httpClient = CreateClient(() =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.Forbidden);
            response.Headers.Add("X-RateLimit-Remaining", "0");
            return response;
        });

        var provider = CreateProvider(httpClient);

        // Act
        var exception = await Assert.ThrowsAsync<HttpRequestException>(
            () => provider.GetLatestCommitsAsync());

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, exception.StatusCode);
        Assert.Equal("GitHub rate limit exceeded.", exception.Message);
    }

    [Theory]
    [InlineData(
        """[{"sha":"abc123","commit":null}]""",
        "GitHub commit details are missing.")]
    [InlineData(
        """[{"sha":"abc123","commit":{"message":"Commit"}}]""",
        "GitHub commit date is missing.")]
    [InlineData(
        """[{"sha":"","commit":{"message":"Commit"}}]""",
        "GitHub returned incomplete commit data.")]
    [InlineData(
        "null",
        "GitHub returned an invalid commit response.")]
    public async Task GetLatestCommitsAsync_InvalidData_ThrowsValidationException(
        string json,
        string expectedMessage)
    {
        // Arrange
        using var httpClient = CreateClient(() =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    json,
                    Encoding.UTF8,
                    "application/json")
            });

        var provider = CreateProvider(httpClient);

        // Act
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => provider.GetLatestCommitsAsync());

        // Assert
        Assert.Equal(expectedMessage, exception.Message);
    }

    private static GitHubCommitProvider CreateProvider(HttpClient httpClient)
    {
        var options = new GitHubOptions
        {
            Owner = "test-owner",
            Repository = "test-repository",
            Branch = "develop",
            Token = "fake-test-token"
        };

        return new GitHubCommitProvider(httpClient, options);
    }

    private static HttpClient CreateClient(
        Func<HttpResponseMessage> responder)
    {
        return new HttpClient(new FakeHttpMessageHandler(responder));
    }

    private sealed class FakeHttpMessageHandler(
        Func<HttpResponseMessage> responder) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(responder());
        }
    }
}
