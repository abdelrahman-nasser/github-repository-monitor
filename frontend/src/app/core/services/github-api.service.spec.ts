import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';

import { MOCK_COMMITS, MOCK_LAST_SYNC_TIME } from '../mocks/mock-commits';
import { GITHUB_API_CONFIG, GithubApiConfig, GithubApiService } from './github-api.service';

describe('GithubApiService', () => {
  let http: HttpTestingController;

  function configure(config?: GithubApiConfig): GithubApiService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ...(config ? [{ provide: GITHUB_API_CONFIG, useValue: config }] : []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(GithubApiService);
  }

  afterEach(() => {
    http?.verify();
    vi.useRealTimers();
  });

  it('defaults to real API requests without an application configuration override', async () => {
    const service = configure();
    const live = firstValueFrom(service.getLiveCommits());
    const scheduled = firstValueFrom(service.getScheduledCommits());

    expect(service.mode).toBe('api');
    http.expectOne('/api/github/live').flush({ success: true, message: 'Retrieved.', data: [] });
    http.expectOne('/api/github/scheduled').flush({
      success: true,
      message: 'Retrieved.',
      data: { commits: [], lastSyncTime: null },
    });
    expect(await live).toEqual([]);
    expect(await scheduled).toEqual({ commits: [], lastSyncTime: null });
  });

  it('returns delayed mock success responses without making HTTP requests', async () => {
    vi.useFakeTimers();
    const service = configure({ mode: 'mock', mockScenario: 'success' });
    const live = firstValueFrom(service.getLiveCommits());
    const scheduled = firstValueFrom(service.getScheduledCommits());

    expect(service.mode).toBe('mock');
    http.expectNone('/api/github/live');
    http.expectNone('/api/github/scheduled');
    await vi.advanceTimersByTimeAsync(600);

    const liveData = await live;
    expect(liveData).toEqual(MOCK_COMMITS);
    expect(liveData[0]).not.toBe(MOCK_COMMITS[0]);
    expect(await scheduled).toEqual({
      commits: MOCK_COMMITS.map((commit) => ({ ...commit, source: 'Scheduled' })),
      lastSyncTime: MOCK_LAST_SYNC_TIME,
    });
  });

  it('supports an empty repository synchronized successfully with zero commits', async () => {
    vi.useFakeTimers();
    const service = configure({ mode: 'mock', mockScenario: 'empty', mockDelayMs: 1 });
    const live = firstValueFrom(service.getLiveCommits());
    const scheduled = firstValueFrom(service.getScheduledCommits());
    await vi.advanceTimersByTimeAsync(1);
    expect(await live).toEqual([]);
    expect(await scheduled).toEqual({ commits: [], lastSyncTime: MOCK_LAST_SYNC_TIME });
  });

  it('supports an unsynchronized cache while live commits are available', async () => {
    vi.useFakeTimers();
    const service = configure({ mode: 'mock', mockScenario: 'unsynced', mockDelayMs: 1 });
    const live = firstValueFrom(service.getLiveCommits());
    const scheduled = firstValueFrom(service.getScheduledCommits());
    await vi.advanceTimersByTimeAsync(1);
    expect(await live).toHaveLength(MOCK_COMMITS.length);
    expect(await scheduled).toEqual({ commits: [], lastSyncTime: null });
  });

  it.each(['getLiveCommits', 'getScheduledCommits'] as const)(
    'can simulate an HTTP failure for %s',
    async (method) => {
      vi.useFakeTimers();
      const service = configure({ mode: 'mock', mockScenario: 'failure', mockDelayMs: 1 });
      const result = expect(firstValueFrom<unknown>(service[method]())).rejects.toThrow(
        'Simulated HTTP failure',
      );
      await vi.advanceTimersByTimeAsync(1);
      await result;
    },
  );

  it.each(['getLiveCommits', 'getScheduledCommits'] as const)(
    'can simulate an unavailable service for %s',
    async (method) => {
      vi.useFakeTimers();
      const service = configure({ mode: 'mock', mockScenario: 'unavailable', mockDelayMs: 1 });
      const result = expect(firstValueFrom<unknown>(service[method]())).rejects.toThrow(
        'Unable to reach the repository service',
      );
      await vi.advanceTimersByTimeAsync(1);
      await result;
    },
  );

  it.each(['getLiveCommits', 'getScheduledCommits'] as const)(
    'times out a stalled mock request for %s without making HTTP requests',
    async (method) => {
      vi.useFakeTimers();
      const service = configure({ mode: 'mock', mockScenario: 'timeout' });
      const next = vi.fn();
      const error = vi.fn();
      const request: Observable<unknown> = service[method]();
      request.subscribe({ next, error });
      await vi.advanceTimersByTimeAsync(24_999);
      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('took too long to respond') }),
      );
      expect(next).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('cancels a pending mock timeout when the consumer unsubscribes', async () => {
    vi.useFakeTimers();
    const service = configure({ mode: 'mock', mockScenario: 'timeout' });
    const received = vi.fn();
    const subscription = service.getScheduledCommits().subscribe({
      next: received,
      error: received,
    });
    subscription.unsubscribe();
    await vi.advanceTimersByTimeAsync(25_000);
    expect(received).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels pending mock work when the consumer unsubscribes', async () => {
    vi.useFakeTimers();
    const service = configure({ mode: 'mock', mockDelayMs: 600 });
    const received = vi.fn();
    const subscription = service.getLiveCommits().subscribe(received);
    subscription.unsubscribe();
    await vi.advanceTimersByTimeAsync(600);
    expect(received).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('maps the live REST envelope to typed commits', async () => {
    const service = configure({ mode: 'api' });
    const result = firstValueFrom(service.getLiveCommits());
    const request = http.expectOne('/api/github/live');
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, message: 'Retrieved.', data: [MOCK_COMMITS[0]] });
    expect(await result).toEqual([MOCK_COMMITS[0]]);
  });

  it('maps the scheduled REST envelope and nullable synchronization time', async () => {
    const service = configure({ mode: 'api' });
    const result = firstValueFrom(service.getScheduledCommits());
    const commit = { ...MOCK_COMMITS[0], source: 'Scheduled' };
    http.expectOne('/api/github/scheduled').flush({
      success: true,
      message: 'Retrieved.',
      data: { commits: [commit], lastSyncTime: MOCK_LAST_SYNC_TIME },
    });
    expect(await result).toEqual({ commits: [commit], lastSyncTime: MOCK_LAST_SYNC_TIME });

    const empty = firstValueFrom(service.getScheduledCommits());
    http.expectOne('/api/github/scheduled').flush({
      success: true,
      message: 'Retrieved.',
      data: { commits: [], lastSyncTime: null },
    });
    expect(await empty).toEqual({ commits: [], lastSyncTime: null });
  });

  it('surfaces unsuccessful API envelopes', async () => {
    const service = configure({ mode: 'api' });
    const result = expect(firstValueFrom(service.getLiveCommits())).rejects.toThrow(
      'Repository is unavailable.',
    );
    http.expectOne('/api/github/live').flush({
      success: false,
      message: 'Repository is unavailable.',
      data: null,
    });
    await result;
  });

  it.each([
    null,
    { data: [] },
    { success: true, message: 'Retrieved.', data: null },
    { success: true, message: 'Retrieved.', data: [{ ...MOCK_COMMITS[0], date: 'invalid' }] },
    { success: true, message: 'Retrieved.', data: [{ ...MOCK_COMMITS[0], source: 'Unknown' }] },
  ])('rejects malformed live responses: %j', async (response) => {
    const service = configure({ mode: 'api' });
    const result = expect(firstValueFrom(service.getLiveCommits())).rejects.toThrow(
      'invalid response',
    );
    http.expectOne('/api/github/live').flush(response);
    await result;
  });

  it('rejects invalid scheduled synchronization timestamps', async () => {
    const service = configure({ mode: 'api' });
    const result = expect(firstValueFrom(service.getScheduledCommits())).rejects.toThrow(
      'invalid response',
    );
    http.expectOne('/api/github/scheduled').flush({
      success: true,
      message: 'Retrieved.',
      data: { commits: [], lastSyncTime: 'invalid' },
    });
    await result;
  });

  it('reports HTTP failure messages without falling back to mock data', async () => {
    const service = configure({ mode: 'api' });
    const result = expect(firstValueFrom(service.getLiveCommits())).rejects.toThrow(
      'The upstream service is unavailable.',
    );
    http
      .expectOne('/api/github/live')
      .flush(
        { success: false, message: 'The upstream service is unavailable.', data: null },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await result;
  });

  it.each([
    [502, 'GitHub authentication failed. Check the server-side GitHub credentials.'],
    [504, 'GitHub request timed out. Please try again.'],
  ] as const)(
    'preserves the safe upstream HTTP %s message without mock success',
    async (status, message) => {
      const service = configure({ mode: 'api' });
      const next = vi.fn();
      const error = vi.fn();
      service.getLiveCommits().subscribe({ next, error });
      http
        .expectOne('/api/github/live')
        .flush({ success: false, message, data: null }, { status, statusText: 'Upstream Failure' });

      expect(next).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message }));
    },
  );

  it('reports connectivity failures clearly', async () => {
    const service = configure({ mode: 'api' });
    const result = expect(firstValueFrom(service.getScheduledCommits())).rejects.toThrow(
      'Unable to reach the repository service',
    );
    http.expectOne('/api/github/scheduled').error(new ProgressEvent('error'));
    await result;
  });

  it('times out and cancels stalled HTTP requests', async () => {
    vi.useFakeTimers();
    const service = configure({ mode: 'api' });
    const result = expect(firstValueFrom(service.getLiveCommits())).rejects.toThrow(
      'took too long to respond',
    );
    const request = http.expectOne('/api/github/live');
    await vi.advanceTimersByTimeAsync(25_000);
    await result;
    expect(request.cancelled).toBe(true);
  });
});
