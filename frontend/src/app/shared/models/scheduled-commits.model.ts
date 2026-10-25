import { GitCommit } from './git-commit.model';

export interface ScheduledCommits {
  commits: GitCommit[];
  lastSyncTime: string | null;
}
