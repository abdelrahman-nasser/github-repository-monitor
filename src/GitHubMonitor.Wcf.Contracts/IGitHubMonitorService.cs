using CoreWCF;
using GitHubMonitor.Wcf.Contracts.Models;

namespace GitHubMonitor.Wcf.Contracts;

[ServiceContract]
public interface IGitHubMonitorService
{
    [OperationContract]
    string Ping();

    [OperationContract(Name = "GetLiveCommits")]
    [FaultContract(typeof(GitHubFault), Name = "GitHubFault",
        Namespace = "urn:github-monitor:faults", Action = GitHubFault.Action)]
    Task<GitCommitDto[]> GetLiveCommitsAsync();

    [OperationContract(Name = "GetScheduledCommits")]
    Task<ScheduledCommitsDto> GetScheduledCommitsAsync();
}
