using System.ServiceModel;

namespace GitHubMonitor.Api.Clients;

[ServiceContract(
    Namespace = "http://tempuri.org/",
    Name = "IGitHubMonitorService")]
public interface IGitHubMonitorSoapClient
{
    [OperationContract(
        Action = "http://tempuri.org/IGitHubMonitorService/Ping",
        ReplyAction = "*")]
    string Ping();
}