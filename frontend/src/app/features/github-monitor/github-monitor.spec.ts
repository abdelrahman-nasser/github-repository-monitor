import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { GithubApiService } from '../../core/services/github-api.service';
import { GitCommit } from '../../shared/models/git-commit.model';
import { ScheduledCommits } from '../../shared/models/scheduled-commits.model';
import { MOCK_COMMITS, MOCK_LAST_SYNC_TIME } from '../../core/mocks/mock-commits';
import { GithubMonitor } from './github-monitor';

describe('GithubMonitor', () => {
  let fixture: ComponentFixture<GithubMonitor>;
  let liveRequests: Subject<GitCommit[]>[];
  let scheduledRequests: Subject<ScheduledCommits>[];
  let api: {
    mode: string;
    getLiveCommits: ReturnType<typeof vi.fn>;
    getScheduledCommits: ReturnType<typeof vi.fn>;
  };
  const originalShowModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    'showModal',
  );
  const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

  function liveRegion(): HTMLElement {
    return fixture.nativeElement.querySelector('section[aria-labelledby="live-heading"]');
  }

  function scheduledRegion(): HTMLElement {
    return fixture.nativeElement.querySelector('section[aria-labelledby="scheduled-heading"]');
  }

  function respondLive(commits: GitCommit[] = [...MOCK_COMMITS]): void {
    const request = liveRequests[liveRequests.length - 1];
    request.next(commits);
    request.complete();
    fixture.detectChanges();
  }

  function respondScheduled(
    lastSyncTime: string | null = MOCK_LAST_SYNC_TIME,
    commits: GitCommit[] = MOCK_COMMITS.map((commit) => ({ ...commit, source: 'Scheduled' })),
  ): void {
    const request = scheduledRequests[scheduledRequests.length - 1];
    request.next({ commits, lastSyncTime });
    request.complete();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    // Native modal behavior is verified in the browser; jsdom needs only the API surface.
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute('open', '');
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute('open');
        },
      },
    });
    liveRequests = [];
    scheduledRequests = [];
    api = {
      mode: 'mock',
      getLiveCommits: vi.fn(() => {
        const request = new Subject<GitCommit[]>();
        liveRequests.push(request);
        return request;
      }),
      getScheduledCommits: vi.fn(() => {
        const request = new Subject<ScheduledCommits>();
        scheduledRequests.push(request);
        return request;
      }),
    };
    await TestBed.configureTestingModule({
      imports: [GithubMonitor],
      providers: [{ provide: GithubApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(GithubMonitor);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    for (const [key, descriptor] of [
      ['showModal', originalShowModal],
      ['close', originalClose],
    ] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
      else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[key];
    }
  });

  it('creates the dashboard and requests both sources on initialization', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('GitHub Repository Monitor');
    expect(fixture.nativeElement.textContent).toContain('Mock mode');
    expect(api.getLiveCommits).toHaveBeenCalledOnce();
    expect(api.getScheduledCommits).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).not.toContain('Test Error');
  });

  it('announces initial loading and disables refresh until each request completes', () => {
    expect(liveRegion().getAttribute('aria-busy')).toBe('true');
    expect(scheduledRegion().getAttribute('aria-busy')).toBe('true');
    expect(liveRegion().querySelector('[role="status"]')?.textContent).toContain(
      'Loading live commits',
    );
    expect(liveRegion().querySelector('button')?.disabled).toBe(true);
    expect(liveRegion().textContent).not.toContain('No live commits available.');
    respondLive();
    expect(liveRegion().querySelector('button')?.disabled).toBe(false);
    expect(scheduledRegion().querySelector('button')?.disabled).toBe(true);
  });

  it('renders mock commits in semantic tables with the correct sources and full SHA access', () => {
    respondLive();
    respondScheduled();
    expect(liveRegion().querySelector('caption')?.textContent?.trim()).toBe('Live commits');
    expect(liveRegion().querySelectorAll('tbody tr')).toHaveLength(MOCK_COMMITS.length);
    expect(scheduledRegion().querySelectorAll('tbody tr')).toHaveLength(MOCK_COMMITS.length);
    expect(liveRegion().querySelector('tbody tr')?.textContent).toContain(MOCK_COMMITS[0].message);
    expect(liveRegion().querySelector('tbody tr')?.textContent).toContain('Live');
    expect(scheduledRegion().querySelector('tbody tr')?.textContent).toContain('Scheduled');
    expect(liveRegion().querySelector('summary')?.textContent?.trim()).toBe(
      MOCK_COMMITS[0].sha.slice(0, 8),
    );
    expect(liveRegion().querySelector('details code')?.textContent).toBe(MOCK_COMMITS[0].sha);
    expect(scheduledRegion().querySelector('time')?.getAttribute('datetime')).toBe(
      MOCK_LAST_SYNC_TIME,
    );
  });

  it('refreshes live data while retaining previous rows and ignores overlapping refreshes', () => {
    respondLive();
    liveRegion().querySelector('button')!.click();
    fixture.detectChanges();
    fixture.componentInstance.refreshLive();
    expect(api.getLiveCommits).toHaveBeenCalledTimes(2);
    expect(liveRegion().querySelector('button')!.disabled).toBe(true);
    expect(liveRegion().querySelectorAll('tbody tr')).toHaveLength(MOCK_COMMITS.length);
    respondLive([{ ...MOCK_COMMITS[0], message: 'A newly refreshed commit' }]);
    expect(liveRegion().getAttribute('aria-busy')).toBe('false');
    expect(liveRegion().textContent).toContain('A newly refreshed commit');
    expect(liveRegion().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(api.getScheduledCommits).toHaveBeenCalledOnce();
  });

  it('refreshes the scheduled snapshot independently and prevents duplicate requests', () => {
    respondScheduled();
    scheduledRegion().querySelector('button')!.click();
    fixture.detectChanges();
    fixture.componentInstance.refreshScheduled();
    expect(api.getScheduledCommits).toHaveBeenCalledTimes(2);
    respondScheduled('2025-01-15T12:01:00Z', []);
    expect(scheduledRegion().querySelector('time')?.getAttribute('datetime')).toBe(
      '2025-01-15T12:01:00Z',
    );
    expect(scheduledRegion().textContent).toContain('No scheduled commits available yet.');
  });

  it('shows both empty states only after successful empty responses', () => {
    respondLive([]);
    respondScheduled(null, []);
    expect(liveRegion().textContent).toContain('No live commits available.');
    expect(scheduledRegion().textContent).toContain('No scheduled commits available yet.');
    expect(scheduledRegion().textContent).toContain('Not synchronized yet.');
    expect(fixture.componentInstance.liveLoaded()).toBe(true);
    expect(fixture.componentInstance.scheduledLoaded()).toBe(true);
  });

  it('handles commits with no synchronization timestamp', () => {
    respondScheduled(null);
    expect(scheduledRegion().textContent).toContain('Not synchronized yet.');
    expect(scheduledRegion().querySelectorAll('tbody tr')).toHaveLength(MOCK_COMMITS.length);
  });

  it('surfaces live failure, stops loading, closes the error dialog and recovers on retry', () => {
    liveRequests[0].error(new Error('Live service unavailable.'));
    fixture.detectChanges();
    expect(liveRegion().getAttribute('aria-busy')).toBe('false');
    expect(liveRegion().querySelector('button')!.disabled).toBe(false);
    expect(liveRegion().textContent).toContain('Commits unavailable');
    expect(liveRegion().textContent).not.toContain('No live commits available.');
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]').textContent).toContain(
      'Live service unavailable.',
    );
    fixture.nativeElement.querySelector('dialog button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(liveRegion().textContent).toContain('Live request failed.');
    liveRegion().querySelector('button')!.click();
    respondLive();
    expect(fixture.componentInstance.liveError()).toBeNull();
    expect(liveRegion().querySelectorAll('tbody tr')).toHaveLength(MOCK_COMMITS.length);
  });

  it('preserves the last successful snapshot and sync time on scheduled failure', () => {
    respondScheduled();
    scheduledRegion().querySelector('button')!.click();
    scheduledRequests[1].error(new Error('Snapshot service unavailable.'));
    fixture.detectChanges();
    expect(scheduledRegion().getAttribute('aria-busy')).toBe('false');
    expect(scheduledRegion().textContent).toContain('Showing the previous snapshot.');
    expect(scheduledRegion().querySelectorAll('tbody tr')).toHaveLength(MOCK_COMMITS.length);
    expect(fixture.componentInstance.lastSyncTime()).toBe(MOCK_LAST_SYNC_TIME);
    fixture.nativeElement
      .querySelector('dialog')
      .dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  });

  it('handles initial scheduled failure independently from live success', () => {
    respondLive();
    scheduledRequests[0].error(new Error('Snapshot failed.'));
    fixture.detectChanges();
    expect(fixture.componentInstance.loadingScheduled()).toBe(false);
    expect(scheduledRegion().textContent).toContain('Synchronization status unavailable.');
    expect(liveRegion().querySelectorAll('tbody tr')).toHaveLength(MOCK_COMMITS.length);
  });

  it('supports providers that fail synchronously during initialization', () => {
    fixture.destroy();
    api.getLiveCommits.mockReturnValueOnce(throwError(() => new Error('Immediate failure.')));
    fixture = TestBed.createComponent(GithubMonitor);
    fixture.detectChanges();
    expect(fixture.componentInstance.loadingLive()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]').textContent).toContain(
      'Immediate failure.',
    );
  });

  it('unsubscribes pending work on destruction and accepts no subsequent updates', () => {
    const component = fixture.componentInstance;
    const updateLive = vi.spyOn(component.liveCommits, 'set');
    const updateScheduled = vi.spyOn(component.scheduledCommits, 'set');
    const updateLoading = vi.spyOn(component.loadingLive, 'set');
    fixture.destroy();
    expect(liveRequests[0].observed).toBe(false);
    expect(scheduledRequests[0].observed).toBe(false);
    liveRequests[0].next([...MOCK_COMMITS]);
    scheduledRequests[0].next({ commits: [], lastSyncTime: null });
    expect(updateLive).not.toHaveBeenCalled();
    expect(updateScheduled).not.toHaveBeenCalled();
    expect(updateLoading).not.toHaveBeenCalled();
  });
});
