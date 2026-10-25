import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { GithubApiService } from '../../core/services/github-api.service';
import { GitCommit } from '../../shared/models/git-commit.model';
import { ErrorDialog } from '../../shared/components/error-dialog/error-dialog';
import { CommitTable } from './components/commit-table/commit-table';

@Component({
  selector: 'app-github-monitor',
  imports: [DatePipe, ErrorDialog, CommitTable],
  templateUrl: './github-monitor.html',
  styleUrl: './github-monitor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GithubMonitor implements OnInit {
  private readonly api = inject(GithubApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly liveRefresh = viewChild<ElementRef<HTMLButtonElement>>('liveRefresh');
  private readonly scheduledRefresh = viewChild<ElementRef<HTMLButtonElement>>('scheduledRefresh');
  readonly isMock = this.api.mode === 'mock';
  readonly liveCommits = signal<GitCommit[]>([]);
  readonly scheduledCommits = signal<GitCommit[]>([]);
  readonly lastSyncTime = signal<string | null>(null);
  readonly loadingLive = signal(false);
  readonly loadingScheduled = signal(false);
  readonly liveLoaded = signal(false);
  readonly scheduledLoaded = signal(false);
  readonly liveError = signal<string | null>(null);
  readonly scheduledError = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly errorReturnFocus = signal<HTMLElement | null>(null);

  ngOnInit(): void {
    this.refreshLive();
    this.refreshScheduled();
  }

  refreshLive(): void {
    if (this.loadingLive()) return;
    this.loadingLive.set(true);
    this.liveError.set(null);
    this.api
      .getLiveCommits()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!this.destroyRef.destroyed) this.loadingLive.set(false);
        }),
      )
      .subscribe({
        next: (commits) => {
          this.liveCommits.set(commits);
          this.liveLoaded.set(true);
        },
        error: (error: Error) => {
          this.liveError.set(error.message);
          this.errorReturnFocus.set(this.liveRefresh()?.nativeElement ?? null);
          this.errorMessage.set(error.message);
        },
      });
  }

  refreshScheduled(): void {
    if (this.loadingScheduled()) return;
    this.loadingScheduled.set(true);
    this.scheduledError.set(null);
    this.api
      .getScheduledCommits()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!this.destroyRef.destroyed) this.loadingScheduled.set(false);
        }),
      )
      .subscribe({
        next: (snapshot) => {
          this.scheduledCommits.set(snapshot.commits);
          this.lastSyncTime.set(snapshot.lastSyncTime);
          this.scheduledLoaded.set(true);
        },
        error: (error: Error) => {
          this.scheduledError.set(error.message);
          this.errorReturnFocus.set(this.scheduledRefresh()?.nativeElement ?? null);
          this.errorMessage.set(error.message);
        },
      });
  }

  closeError(): void {
    this.errorMessage.set(null);
  }
}
