import type { GithubApiConfig } from '../app/core/services/github-api.service';

// Production and explicit development API builds use same-origin endpoints.
export const environment = {
  production: true,
  githubApi: { mode: 'api' } satisfies GithubApiConfig,
};
