namespace GitHubMonitor.Api.Clients;

public interface IWcfMonitorClient
{
    Task<string> PingAsync(CancellationToken cancellationToken = default);
}
