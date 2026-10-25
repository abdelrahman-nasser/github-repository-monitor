using System.Runtime.Serialization;

namespace GitHubMonitor.Api.Clients.Models;

[DataContract(
    Name = "ScheduledCommitsDto",
    Namespace = "http://schemas.datacontract.org/2004/07/GitHubMonitor.Wcf.Contracts.Models")]
public sealed class ScheduledCommitsDto
{
    [DataMember(Order = 1)]
    public GitCommitDto[] Commits { get; set; } = [];

    [DataMember(Order = 2)]
    public DateTime? LastSyncTime { get; set; }
}
