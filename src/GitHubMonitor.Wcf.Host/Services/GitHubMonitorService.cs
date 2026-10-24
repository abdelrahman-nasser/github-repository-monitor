using GitHubMonitor.Wcf.Contracts;

namespace GitHubMonitor.Wcf.Host.Services;

public sealed class GitHubMonitorService : IGitHubMonitorService
{
    public string Ping()
    {
        return "GitHub Monitor WCF is running";
    }
}
