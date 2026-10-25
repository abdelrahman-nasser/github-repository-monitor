using System.Net;
using GitHubMonitor.Infrastructure.GitHub;

namespace GitHubMonitor.Infrastructure.Tests.GitHub;

public sealed class GitHubCommitProviderDeadlineTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task GetLatestCommitsAsync_DeadlineCoversHeadersAndBody(bool headersReceived)
    {
        using var handler = new StallingHandler(headersReceived);
        using var client = new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan };
        var provider = CreateProvider(client, TimeSpan.FromMilliseconds(100));

        var operation = provider.GetLatestCommitsAsync();
        await handler.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));

        var exception = await Assert.ThrowsAsync<TimeoutException>(
            () => operation.WaitAsync(TimeSpan.FromSeconds(5)));

        Assert.Equal("GitHub request timed out.", exception.Message);
        Assert.Equal(headersReceived, handler.Body.ReadStarted);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task GetLatestCommitsAsync_CallerCancellationIsPreserved(bool headersReceived)
    {
        using var handler = new StallingHandler(headersReceived);
        using var client = new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan };
        var provider = CreateProvider(client, TimeSpan.FromSeconds(10));
        using var cancellation = new CancellationTokenSource();

        var operation = provider.GetLatestCommitsAsync(cancellation.Token);
        await handler.Started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        cancellation.Cancel();

        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => operation.WaitAsync(TimeSpan.FromSeconds(5)));

        Assert.Equal(cancellation.Token, exception.CancellationToken);
    }

    private static GitHubCommitProvider CreateProvider(HttpClient client, TimeSpan timeout)
    {
        return new GitHubCommitProvider(client, new GitHubOptions
        {
            Owner = "test-owner",
            Repository = "test-repository",
            Token = "fake-test-token",
            RequestTimeout = timeout
        });
    }

    private sealed class StallingHandler(bool headersReceived) : HttpMessageHandler
    {
        public TaskCompletionSource Started { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public StallingStream Body { get; } = new();

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (headersReceived)
            {
                var response = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StreamContent(Body)
                };
                Started.TrySetResult();
                return response;
            }

            Started.TrySetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            throw new InvalidOperationException("Unreachable.");
        }
    }

    private sealed class StallingStream : Stream
    {
        public bool ReadStarted { get; private set; }
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            ReadStarted = true;
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            return 0;
        }

        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
