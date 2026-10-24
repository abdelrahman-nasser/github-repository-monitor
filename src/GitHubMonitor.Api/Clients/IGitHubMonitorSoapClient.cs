using System.ServiceModel;

namespace GitHubMonitor.Api.Clients;

[ServiceContract(
    Namespace = "http://tempuri.org/",
    Name = "IGitHubMonitorService")]
public interface IGitHubMonitorSoapClient
{
    [OperationContract(
        Name = "Ping",
        Action = "http://tempuri.org/IGitHubMonitorService/Ping",
        ReplyAction = "*")]
    Task<string> PingAsync();
}