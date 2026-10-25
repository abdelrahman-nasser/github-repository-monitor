import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../environments/environment';
import { appConfig } from './app.config';
import { GithubApiService } from './core/services/github-api.service';

// Run with `npm test -- --watch=false --configuration production`.
describe('Production application API configuration', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('defaults to the real API in a production build', () => {
    expect(environment.production).toBe(true);
    expect(TestBed.inject(GithubApiService).mode).toBe('api');
  });

  it('surfaces production HTTP failures without returning demonstration commits', async () => {
    const result = firstValueFrom(TestBed.inject(GithubApiService).getLiveCommits());
    const rejection = expect(result).rejects.toThrow('HTTP 503');

    TestBed.inject(HttpTestingController)
      .expectOne('/api/github/live')
      .flush(null, { status: 503, statusText: 'Service Unavailable' });

    await rejection;
  });
});
