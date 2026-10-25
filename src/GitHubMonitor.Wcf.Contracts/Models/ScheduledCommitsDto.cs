using System.Runtime.Serialization;

namespace GitHubMonitor.Wcf.Contracts.Models;

[DataContract]
public sealed class ScheduledCommitsDto
{
    [DataMember(Order = 1)]
    public GitCommitDto[] Commits { get; set; } = [];

    [DataMember(Order = 2)]
    public DateTime? LastSyncTime { get; set; }
}
