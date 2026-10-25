import type { GithubApiConfig } from '../app/core/services/github-api.service';

export const environment = {
  production: false,
  githubApi: { mode: 'mock', mockScenario: 'success' } satisfies GithubApiConfig,
};
