import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { catchError, map, NEVER, Observable, throwError, timeout, TimeoutError, timer } from 'rxjs';

import { MOCK_COMMITS, MOCK_LAST_SYNC_TIME } from '../mocks/mock-commits';
import { ApiResponse } from '../../shared/models/api-response.model';
import { GitCommit } from '../../shared/models/git-commit.model';
import { ScheduledCommits } from '../../shared/models/scheduled-commits.model';

export interface GithubApiConfig {
  readonly mode: 'mock' | 'api';
  readonly mockScenario?: 'success' | 'empty' | 'unsynced' | 'failure' | 'timeout' | 'unavailable';
  readonly mockDelayMs?: number;
}

/** App configuration explicitly enables development mocks; the fallback always uses HTTP. */
export const GITHUB_API_CONFIG = new InjectionToken<GithubApiConfig>('GITHUB_API_CONFIG', {
  providedIn: 'root',
  factory: () => ({ mode: 'api' }),
});

const INVALID_RESPONSE = 'The repository service returned an invalid response. Please try again.';
const REQUEST_TIMEOUT_MS = 25_000;

@Injectable({ providedIn: 'root' })
export class GithubApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(GITHUB_API_CONFIG);
  readonly mode = this.config.mode;

  getLiveCommits(): Observable<GitCommit[]> {
    if (this.mode === 'mock') {
      return this.mockRequest(() =>
        this.config.mockScenario === 'empty' ? [] : MOCK_COMMITS.map((commit) => ({ ...commit })),
      );
    }

    return this.request<GitCommit[]>('/api/github/live', parseCommits);
  }

  getScheduledCommits(): Observable<ScheduledCommits> {
    if (this.mode === 'mock') {
      return this.mockRequest(() => {
        const empty = ['empty', 'unsynced'].includes(this.config.mockScenario ?? 'success');
        return {
          commits: empty
            ? []
            : MOCK_COMMITS.map((commit) => ({ ...commit, source: 'Scheduled' as const })),
          lastSyncTime: this.config.mockScenario === 'unsynced' ? null : MOCK_LAST_SYNC_TIME,
        };
      });
    }

    return this.request<ScheduledCommits>('/api/github/scheduled', (data) => {
      if (
        !isRecord(data) ||
        !(data['lastSyncTime'] === null || isDateString(data['lastSyncTime']))
      ) {
        throw new Error(INVALID_RESPONSE);
      }
      return {
        commits: parseCommits(data['commits']),
        lastSyncTime: data['lastSyncTime'] as string | null,
      };
    });
  }

  private mockRequest<T>(createData: () => T): Observable<T> {
    if (this.config.mockScenario === 'timeout') {
      return NEVER.pipe(
        timeout(REQUEST_TIMEOUT_MS),
        catchError((error: unknown) => throwError(() => toServiceError(error))),
      );
    }

    // RxJS timers are cancelled when consumers unsubscribe, including on dashboard destruction.
    return timer(this.config.mockDelayMs ?? 600).pipe(
      map(() => {
        if (this.config.mockScenario === 'failure') {
          throw new HttpErrorResponse({
            status: 503,
            statusText: 'Service Unavailable',
            error: {
              message: 'Simulated HTTP failure. Switch the mock scenario to retry successfully.',
            },
          });
        }
        if (this.config.mockScenario === 'unavailable') {
          throw new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
        }
        return createData();
      }),
      catchError((error: unknown) => throwError(() => toServiceError(error))),
    );
  }

  private request<T>(url: string, parse: (data: unknown) => T): Observable<T> {
    return this.http.get<ApiResponse<unknown>>(url).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((response) => {
        if (
          !isRecord(response) ||
          typeof response['success'] !== 'boolean' ||
          typeof response['message'] !== 'string'
        ) {
          throw new Error(INVALID_RESPONSE);
        }
        if (!response['success']) {
          throw new Error(response['message'].trim() || 'Unable to retrieve repository commits.');
        }
        return parse(response['data']);
      }),
      catchError((error: unknown) => throwError(() => toServiceError(error))),
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));
}

function parseCommits(data: unknown): GitCommit[] {
  if (!Array.isArray(data)) {
    throw new Error(INVALID_RESPONSE);
  }
  return data.map((commit: unknown) => {
    if (
      !isRecord(commit) ||
      typeof commit['sha'] !== 'string' ||
      !commit['sha'].trim() ||
      typeof commit['message'] !== 'string' ||
      typeof commit['author'] !== 'string' ||
      !isDateString(commit['date']) ||
      (commit['source'] !== 'Live' && commit['source'] !== 'Scheduled')
    ) {
      throw new Error(INVALID_RESPONSE);
    }
    return {
      sha: commit['sha'],
      message: commit['message'],
      author: commit['author'],
      date: commit['date'],
      source: commit['source'],
    };
  });
}

function toServiceError(error: unknown): Error {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new Error(
        'Unable to reach the repository service. Check your connection and try again.',
      );
    }
    const body: unknown = error.error;
    if (isRecord(body) && typeof body['message'] === 'string' && body['message'].trim()) {
      return new Error(body['message']);
    }
    return new Error(
      `The repository service could not complete the request (HTTP ${error.status}).`,
    );
  }
  if (error instanceof TimeoutError) {
    return new Error('The repository service took too long to respond. Please try again.');
  }
  return error instanceof Error ? error : new Error('Unable to retrieve repository commits.');
}
