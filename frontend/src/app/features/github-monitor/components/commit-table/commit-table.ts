import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { GitCommit } from '../../../../shared/models/git-commit.model';

@Component({
  selector: 'app-commit-table',
  imports: [DatePipe],
  templateUrl: './commit-table.html',
  styleUrl: './commit-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitTable {
  readonly label = input.required<string>();
  readonly commits = input.required<readonly GitCommit[]>();
  readonly emptyMessage = input.required<string>();
  readonly loading = input(false);
  readonly failed = input(false);
}
