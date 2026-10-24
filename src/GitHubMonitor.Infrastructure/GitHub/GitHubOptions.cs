namespace GitHubMonitor.Infrastructure.GitHub;

public sealed class GitHubOptions
{
    public const string SectionName = "GitHub";

    public required string Owner { get; init; }

    public required string Repository { get; init; }

    public required string Token { get; init; }

    public string? Branch { get; init; }
}
