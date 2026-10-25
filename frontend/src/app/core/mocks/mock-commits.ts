import { GitCommit } from '../../shared/models/git-commit.model';

// Entirely fictional demonstration data; no values come from repository history.
export const MOCK_COMMITS: readonly GitCommit[] = [
  {
    sha: '1111111111111111111111111111111111111111',
    message: '[Demo] Add welcome page',
    author: 'Demo Developer A',
    date: '2025-01-15T11:45:00Z',
    source: 'Live',
  },
  {
    sha: '2222222222222222222222222222222222222222',
    message:
      '[Demo] Improve the sample activity summary with clearer descriptions for new contributors and a longer message to demonstrate table wrapping',
    author: 'Demo Developer B',
    date: '2025-01-15T10:30:00Z',
    source: 'Live',
  },
  {
    sha: '3333333333333333333333333333333333333333',
    message: '[Demo] Update sample guide\n\nAdd fictional setup steps and example screenshots.',
    author: 'Demo Developer C',
    date: '2025-01-15T09:15:00Z',
    source: 'Live',
  },
  {
    sha: '4444444444444444444444444444444444444444',
    message: '[Demo] Fix typo',
    author: 'Demo Developer A',
    date: '2025-01-14T16:20:00Z',
    source: 'Live',
  },
  {
    sha: '5555555555555555555555555555555555555555',
    message: '[Demo] Add example empty-state copy',
    author: 'Demo Developer B',
    date: '2025-01-14T14:05:00Z',
    source: 'Live',
  },
  {
    sha: '6666666666666666666666666666666666666666',
    message: '[Demo] Refresh fictional project notes',
    author: 'Demo Developer C',
    date: '2025-01-13T12:10:00Z',
    source: 'Live',
  },
  {
    sha: '7777777777777777777777777777777777777777',
    message: '[Demo] Create sample workspace',
    author: 'Demo Developer A',
    date: '2025-01-12T08:00:00Z',
    source: 'Live',
  },
];

export const MOCK_LAST_SYNC_TIME = '2025-01-15T12:00:00Z';
