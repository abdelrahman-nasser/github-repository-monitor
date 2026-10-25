using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using GitHubMonitor.Application.Abstractions;
using GitHubMonitor.Domain.Models;
using GitHubMonitor.Infrastructure.GitHub.Models;

namespace GitHubMonitor.Infrastructure.GitHub;

public sealed class GitHubCommitProvider(
    HttpClient httpClient,
    GitHubOptions options) : IGitHubCommitProvider
{
    public async Task<IReadOnlyList<GitCommit>> GetLatestCommitsAsync(
        CancellationToken cancellationToken = default)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(options.RequestTimeout);

        try
        {
            return await FetchCommitsAsync(deadline.Token);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            cancellationToken.ThrowIfCancellationRequested();
            throw;
        }
        catch (OperationCanceledException) when (deadline.IsCancellationRequested)
        {
            throw new TimeoutException("GitHub request timed out.");
        }
    }

    private async Task<IReadOnlyList<GitCommit>> FetchCommitsAsync(
        CancellationToken cancellationToken)
    {
        var owner = Uri.EscapeDataString(options.Owner);
        var repository = Uri.EscapeDataString(options.Repository);

        var url = $"https://api.github.com/repos/{owner}/{repository}/commits?per_page=10";

        if (!string.IsNullOrWhiteSpace(options.Branch))
        {
            url += $"&sha={Uri.EscapeDataString(options.Branch)}";
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, url);

        request.Headers.Authorization =
            new AuthenticationHeaderValue("Bearer", options.Token);

        request.Headers.UserAgent.ParseAdd("IntegrationTaskApp");

        request.Headers.Accept.Add(
            new MediaTypeWithQualityHeaderValue(
                "application/vnd.github+json"));

        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var statusCode = response.StatusCode;

            var isRateLimited =
                statusCode == HttpStatusCode.TooManyRequests ||
                (statusCode == HttpStatusCode.Forbidden &&
                 response.Headers.TryGetValues(
                     "X-RateLimit-Remaining", out var remaining) &&
                 remaining.Contains("0"));

            if (isRateLimited)
            {
                throw new GitHubRateLimitException(statusCode);
            }

            var message = statusCode switch
            {
                HttpStatusCode.Unauthorized =>
                    "GitHub authentication failed.",

                HttpStatusCode.Forbidden =>
                    "GitHub denied repository access.",

                HttpStatusCode.NotFound =>
                    "GitHub repository or branch is unavailable.",

                _ when (int)statusCode >= 500 =>
                    "GitHub service is temporarily unavailable.",

                _ =>
                    $"GitHub request failed: HTTP {(int)statusCode}."
            };

            throw new HttpRequestException(
                message, null, statusCode);
        }

        var commits = await response.Content.ReadFromJsonAsync<
            List<GitHubCommitResponse>>(cancellationToken);

        if (commits is null)
        {
            throw new InvalidOperationException(
                "GitHub returned an invalid commit response.");
        }

        // GitHub returns newest first. Enforce the limit even for an oversized response.
        return commits.Take(10).Select(MapCommit).ToArray();
    }

    private static GitCommit MapCommit(GitHubCommitResponse response)
    {
        var commit = response.Commit
            ?? throw new InvalidOperationException(
                "GitHub commit details are missing.");

        if (string.IsNullOrWhiteSpace(response.Sha) ||
            string.IsNullOrWhiteSpace(commit.Message))
        {
            throw new InvalidOperationException(
                "GitHub returned incomplete commit data.");
        }

        var authorName = !string.IsNullOrWhiteSpace(commit.Author?.Name)
            ? commit.Author.Name
            : commit.Committer?.Name;

        var date = commit.Author?.Date
            ?? commit.Committer?.Date
            ?? throw new InvalidOperationException(
                "GitHub commit date is missing.");

        return new GitCommit(
            Sha: response.Sha,
            Message: commit.Message,
            Author: string.IsNullOrWhiteSpace(authorName)
                ? "Unknown"
                : authorName,
            Date: date);
    }
}
