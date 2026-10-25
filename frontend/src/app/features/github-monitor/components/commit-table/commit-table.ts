import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CellTemplateDirective,
  ColumnComponent,
  GridComponent,
  LoadingTemplateDirective,
  NoRecordsTemplateDirective,
} from '@progress/kendo-angular-grid';

import { GitCommit } from '../../../../shared/models/git-commit.model';

@Component({
  selector: 'app-commit-table',
  imports: [
    DatePipe,
    GridComponent,
    ColumnComponent,
    CellTemplateDirective,
    LoadingTemplateDirective,
    NoRecordsTemplateDirective,
  ],
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

  // Kendo Grid accepts mutable arrays.
  // Preserve the readonly input contract without mutating source data.
  readonly gridData = computed(() => [...this.commits()]);
}
