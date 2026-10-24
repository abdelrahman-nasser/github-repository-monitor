using CoreWCF;

namespace GitHubMonitor.Wcf.Contracts;

[ServiceContract]
public interface IGitHubMonitorService
{
    [OperationContract]
    string Ping();
}