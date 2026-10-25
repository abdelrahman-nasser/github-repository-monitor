import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
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
  function liveRegion(): HTMLElement {
    return fixture.nativeElement.querySelector('section[aria-labelledby="live-heading"]');
  }

  function scheduledRegion(): HTMLElement {
    return fixture.nativeElement.querySelector('section[aria-labelledby="scheduled-heading"]');
  }

  function liveButton(): HTMLButtonElement {
    return liveRegion().querySelector('button[aria-label="Refresh live commits"]')!;
  }

  function scheduledButton(): HTMLButtonElement {
    return scheduledRegion().querySelector('button[aria-label="Refresh scheduled commits"]')!;
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
      providers: [provideNoopAnimations(), { provide: GithubApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(GithubMonitor);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
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
    expect(liveButton().disabled).toBe(true);
    expect(liveRegion().textContent).not.toContain('No live commits available.');
    respondLive();
    expect(liveButton().disabled).toBe(false);
    expect(scheduledButton().disabled).toBe(true);
  });

  it('keeps native refresh button semantics, accessible labels and loading text', () => {
    for (const button of [liveButton(), scheduledButton()]) {
      expect(button).toBeInstanceOf(HTMLButtonElement);
      expect(button.type).toBe('button');
      expect(button.textContent).toContain('Refreshing…');
    }
    expect(liveButton().getAttribute('aria-label')).toBe('Refresh live commits');
    expect(scheduledButton().getAttribute('aria-label')).toBe('Refresh scheduled commits');

    respondLive();
    respondScheduled();

    expect(liveButton().textContent).toContain('Refresh live');
    expect(scheduledButton().textContent).toContain('Refresh snapshot');
    expect(fixture.nativeElement.querySelector('footer').textContent).toContain('Kendo UI');
  });

  it('disables each refresh independently and ignores clicks while its request is pending', () => {
    respondLive();
    respondScheduled();

    liveButton().click();
    fixture.detectChanges();
    expect(liveButton().disabled).toBe(true);
    expect(scheduledButton().disabled).toBe(false);
    liveButton().click();
    expect(api.getLiveCommits).toHaveBeenCalledTimes(2);

    scheduledButton().click();
    fixture.detectChanges();
    expect(scheduledButton().disabled).toBe(true);
    scheduledButton().click();
    expect(api.getScheduledCommits).toHaveBeenCalledTimes(2);

    respondLive();
    expect(liveButton().disabled).toBe(false);
    expect(scheduledButton().disabled).toBe(true);
    respondScheduled();
    expect(scheduledButton().disabled).toBe(false);
  });

  it('renders mock commits in semantic tables with the correct sources and full SHA access', () => {
    respondLive();
    respondScheduled();
    const liveGridContainer = liveRegion().querySelector('.table-container');
    const scheduledGridContainer = scheduledRegion().querySelector('.table-container');

    expect(liveGridContainer).not.toBeNull();
    expect(scheduledGridContainer).not.toBeNull();

    expect(liveGridContainer?.getAttribute('aria-label')).toContain('Live commits');
    expect(scheduledGridContainer?.getAttribute('aria-label')).toContain('Scheduled commits');
    expect(liveGridContainer?.querySelector('kendo-grid')).not.toBeNull();
    expect(scheduledGridContainer?.querySelector('kendo-grid')).not.toBeNull();
    expect(liveRegion().querySelectorAll('kendo-grid .k-grid-content tbody tr')).toHaveLength(
      MOCK_COMMITS.length,
    );
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
    liveButton().click();
    fixture.detectChanges();
    fixture.componentInstance.refreshLive();
    expect(api.getLiveCommits).toHaveBeenCalledTimes(2);
    expect(liveButton().disabled).toBe(true);
    expect(liveRegion().querySelectorAll('kendo-grid .k-grid-content tbody tr')).toHaveLength(
      MOCK_COMMITS.length,
    );
    respondLive([{ ...MOCK_COMMITS[0], message: 'A newly refreshed commit' }]);
    expect(liveRegion().getAttribute('aria-busy')).toBe('false');
    expect(liveRegion().textContent).toContain('A newly refreshed commit');
    expect(liveRegion().querySelectorAll('kendo-grid .k-grid-content tbody tr')).toHaveLength(1);
    expect(api.getScheduledCommits).toHaveBeenCalledOnce();
  });

  it('refreshes the scheduled snapshot independently and prevents duplicate requests', () => {
    respondScheduled();
    scheduledButton().click();
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
    expect(liveButton().disabled).toBe(false);
    expect(liveRegion().textContent).toContain('Commits unavailable');
    expect(liveRegion().textContent).not.toContain('No live commits available.');
    expect(fixture.nativeElement.querySelector('[role="dialog"]').textContent).toContain(
      'Live service unavailable.',
    );
    fixture.nativeElement.querySelector('app-error-dialog .close-button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(liveButton());
    expect(liveRegion().textContent).toContain('Live request failed.');
    liveButton().click();
    respondLive();
    expect(fixture.componentInstance.liveError()).toBeNull();
    expect(liveRegion().querySelectorAll('kendo-grid .k-grid-content tbody tr')).toHaveLength(
      MOCK_COMMITS.length,
    );
  });

  it('preserves the last successful snapshot and sync time on scheduled failure', () => {
    respondScheduled();
    scheduledButton().click();
    scheduledRequests[1].error(new Error('Snapshot service unavailable.'));
    fixture.detectChanges();
    expect(scheduledRegion().getAttribute('aria-busy')).toBe('false');
    expect(scheduledRegion().textContent).toContain('Showing the previous snapshot.');
    expect(scheduledRegion().querySelectorAll('tbody tr')).toHaveLength(MOCK_COMMITS.length);
    expect(fixture.componentInstance.lastSyncTime()).toBe(MOCK_LAST_SYNC_TIME);
    fixture.nativeElement
      .querySelector('app-error-dialog .close-button')
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
      );
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(scheduledButton());
  });

  it('handles initial scheduled failure independently from live success', () => {
    respondLive();
    scheduledRequests[0].error(new Error('Snapshot failed.'));
    fixture.detectChanges();
    expect(fixture.componentInstance.loadingScheduled()).toBe(false);
    expect(scheduledRegion().textContent).toContain('Synchronization status unavailable.');
    expect(liveRegion().querySelectorAll('kendo-grid .k-grid-content tbody tr')).toHaveLength(
      MOCK_COMMITS.length,
    );
  });

  it('restores the latest refresh trigger when a second failure updates the open dialog', () => {
    respondLive();
    respondScheduled();
    liveButton().click();
    scheduledButton().click();

    liveRequests[1].error(new Error('Live request failed.'));
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    scheduledRequests[1].error(new Error('Scheduled request failed.'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBe(dialog);
    expect(dialog.textContent).toContain('Scheduled request failed.');
    fixture.nativeElement.querySelector('app-error-dialog .close-button').click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(scheduledButton());
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('supports providers that fail synchronously during initialization', () => {
    fixture.destroy();
    api.getLiveCommits.mockReturnValueOnce(throwError(() => new Error('Immediate failure.')));
    fixture = TestBed.createComponent(GithubMonitor);
    fixture.detectChanges();
    expect(fixture.componentInstance.loadingLive()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="dialog"]').textContent).toContain(
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
