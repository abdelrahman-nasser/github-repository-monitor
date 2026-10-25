using CoreWCF;
using GitHubMonitor.Wcf.Contracts.Models;

namespace GitHubMonitor.Wcf.Contracts;

[ServiceContract]
public interface IGitHubMonitorService
{
    [OperationContract]
    string Ping();

    [OperationContract(Name = "GetLiveCommits")]
    Task<GitCommitDto[]> GetLiveCommitsAsync();

    [OperationContract(Name = "GetScheduledCommits")]
    Task<ScheduledCommitsDto> GetScheduledCommitsAsync();
}
