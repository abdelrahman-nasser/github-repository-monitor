export type CommitSource = 'Live' | 'Scheduled';

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  source: CommitSource;
}
