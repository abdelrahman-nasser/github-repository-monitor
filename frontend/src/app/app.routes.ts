import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/github-monitor/github-monitor').then((m) => m.GithubMonitor),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
