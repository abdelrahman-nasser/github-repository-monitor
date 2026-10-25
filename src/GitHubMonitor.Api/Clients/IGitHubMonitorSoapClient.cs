using System.ServiceModel;
using GitHubMonitor.Api.Clients.Models;

namespace GitHubMonitor.Api.Clients;

[ServiceContract(
    Namespace = "http://tempuri.org/",
    Name = "IGitHubMonitorService")]
public interface IGitHubMonitorSoapClient
{
    [OperationContract(
        Name = "Ping",
        Action = "http://tempuri.org/IGitHubMonitorService/Ping",
        ReplyAction = "*")]
    Task<string> PingAsync();

    [OperationContract(
        Name = "GetLiveCommits",
        Action = "http://tempuri.org/IGitHubMonitorService/GetLiveCommits",
        ReplyAction = "*")]
    Task<GitCommitDto[]> GetLiveCommitsAsync();

    [OperationContract(
        Name = "GetScheduledCommits",
        Action = "http://tempuri.org/IGitHubMonitorService/GetScheduledCommits",
        ReplyAction = "*")]
    Task<ScheduledCommitsDto> GetScheduledCommitsAsync();
}
