namespace GitHubMonitor.Api.Configuration;

public sealed class WcfOptions
{
    public const string SectionName = "Wcf";

    public required string EndpointUrl { get; init; }
}
