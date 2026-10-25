using System.Runtime.Serialization;

namespace GitHubMonitor.Api.Clients.Models;

[DataContract(Name = "GitHubFault", Namespace = "urn:github-monitor:faults")]
public sealed class GitHubFault
{
    public const string Action = "http://tempuri.org/IGitHubMonitorService/GetLiveCommits/GitHubFault";

    [DataMember(Order = 1)]
    public string Code { get; set; } = string.Empty;
}
