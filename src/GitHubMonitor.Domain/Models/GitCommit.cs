namespace GitHubMonitor.Domain.Models;

public sealed record GitCommit(
    string Sha,
    string Message,
    string Author,
    DateTimeOffset Date);
