namespace GitHubMonitor.Api.Models;

public sealed record ApiResponse<T>(
    bool Success,
    string Message,
    T? Data);
