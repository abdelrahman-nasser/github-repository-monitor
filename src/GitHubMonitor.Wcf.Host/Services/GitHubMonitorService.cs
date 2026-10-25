using GitHubMonitor.Application.UseCases;
using GitHubMonitor.Wcf.Contracts;
using GitHubMonitor.Wcf.Contracts.Models;

namespace GitHubMonitor.Wcf.Host.Services;

public sealed class GitHubMonitorService(
    GetLiveCommitsUseCase getLiveCommits) : IGitHubMonitorService
{
    public string Ping()
    {
        return "GitHub Monitor WCF is running";
    }

    public async Task<GitCommitDto[]> GetLiveCommitsAsync()
    {
        var commits = await getLiveCommits.ExecuteAsync();

        return commits.Select(commit => new GitCommitDto
        {
            Sha = commit.Sha,
            Message = commit.Message,
            Author = commit.Author,
            Date = commit.Date.UtcDateTime,
            Source = "Live"
        }).ToArray();
    }
}
