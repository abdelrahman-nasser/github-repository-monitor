using GitHubMonitor.Api.Clients;
using GitHubMonitor.Api.Clients.Models;
using GitHubMonitor.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace GitHubMonitor.Api.Controllers;

[ApiController]
[Route("api/github")]
public sealed class GitHubController(
    IWcfMonitorClient wcfClient) : ControllerBase
{
    [HttpGet("live")]
    public async Task<ActionResult<ApiResponse<GitCommitDto[]>>> GetLiveCommits(
        CancellationToken cancellationToken)
    {
        var commits = await wcfClient.GetLiveCommitsAsync(
            cancellationToken);

        return Ok(new ApiResponse<GitCommitDto[]>(
            Success: true,
            Message: "Live commits retrieved successfully.",
            Data: commits));
    }

    [HttpGet("scheduled")]
    public async Task<ActionResult<ApiResponse<ScheduledCommitsDto>>> GetScheduledCommits(
        CancellationToken cancellationToken)
    {
        var snapshot = await wcfClient.GetScheduledCommitsAsync(
            cancellationToken);

        return Ok(new ApiResponse<ScheduledCommitsDto>(
            Success: true,
            Message: "Scheduled commits retrieved successfully.",
            Data: snapshot));
    }
}
