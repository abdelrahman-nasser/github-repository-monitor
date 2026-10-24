namespace GitHubMonitor.Infrastructure.GitHub.Models;

internal sealed class GitHubCommitResponse
{
    public string? Sha { get; init; }

    public GitHubCommitDetails? Commit { get; init; }
}

internal sealed class GitHubCommitDetails
{
    public string? Message { get; init; }

    public GitHubAuthorResponse? Author { get; init; }

    public GitHubAuthorResponse? Committer { get; init; }
}

internal sealed class GitHubAuthorResponse
{
    public string? Name { get; init; }

    public DateTimeOffset? Date { get; init; }
}
