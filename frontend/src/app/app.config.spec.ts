import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../environments/environment';
import { environment as developmentEnvironment } from '../environments/environment.development';
import { appConfig } from './app.config';
import { GITHUB_API_CONFIG, GithubApiService } from './core/services/github-api.service';

describe('Application API configuration', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  function configure() {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
  }

  it('selects real API mode for production and mock-success mode for development', () => {
    configure();

    expect(TestBed.inject(GithubApiService).mode).toBe(environment.production ? 'api' : 'mock');
    expect(TestBed.inject(GITHUB_API_CONFIG)).toEqual(
      environment.production ? { mode: 'api' } : { mode: 'mock', mockScenario: 'success' },
    );
  });

  it('uses the selected build configuration for live and scheduled requests', async () => {
    configure();
    vi.useFakeTimers();
    const api = TestBed.inject(GithubApiService);
    const http = TestBed.inject(HttpTestingController);
    const live = firstValueFrom(api.getLiveCommits());
    const scheduled = firstValueFrom(api.getScheduledCommits());

    if (environment.production) {
      http.expectOne('/api/github/live').flush({ success: true, message: '', data: [] });
      http.expectOne('/api/github/scheduled').flush({
        success: true,
        message: '',
        data: { commits: [], lastSyncTime: '2030-01-15T12:00:00Z' },
      });

      expect(await live).toEqual([]);
      expect(await scheduled).toEqual({ commits: [], lastSyncTime: '2030-01-15T12:00:00Z' });
    } else {
      http.expectNone('/api/github/live');
      http.expectNone('/api/github/scheduled');
      await vi.advanceTimersByTimeAsync(600);

      expect((await live).length).toBeGreaterThan(0);
      expect((await scheduled).commits.length).toBeGreaterThan(0);
    }
  });

  it('provides mock success by default in the development environment', async () => {
    configure();
    TestBed.overrideProvider(GITHUB_API_CONFIG, { useValue: developmentEnvironment.githubApi });
    vi.useFakeTimers();

    expect(developmentEnvironment.production).toBe(false);
    expect(developmentEnvironment.githubApi).toEqual({ mode: 'mock', mockScenario: 'success' });
    const result = firstValueFrom(TestBed.inject(GithubApiService).getLiveCommits());
    await vi.advanceTimersByTimeAsync(600);

    expect((await result).length).toBeGreaterThan(0);
    TestBed.inject(HttpTestingController).expectNone('/api/github/live');
  });

  it('propagates real backend failures when development intentionally selects API mode', async () => {
    configure();
    TestBed.overrideProvider(GITHUB_API_CONFIG, { useValue: { mode: 'api' } });
    const result = firstValueFrom(TestBed.inject(GithubApiService).getLiveCommits());
    const rejection = expect(result).rejects.toThrow('HTTP 503');

    TestBed.inject(HttpTestingController)
      .expectOne('/api/github/live')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });

    await rejection;
  });
});
