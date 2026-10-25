using System.Runtime.Serialization;

namespace GitHubMonitor.Wcf.Contracts.Models;

[DataContract]
public sealed class GitCommitDto
{
    [DataMember(Order = 1)]
    public string Sha { get; set; } = string.Empty;

    [DataMember(Order = 2)]
    public string Message { get; set; } = string.Empty;

    [DataMember(Order = 3)]
    public string Author { get; set; } = string.Empty;

    [DataMember(Order = 4)]
    public DateTime Date { get; set; }

    [DataMember(Order = 5)]
    public string Source { get; set; } = string.Empty;
}
