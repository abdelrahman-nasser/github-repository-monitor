import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { GITHUB_API_CONFIG } from './core/services/github-api.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    // Kendo Dialog 25.3 requires Angular's legacy animation renderer, even with animation off.
    provideAnimationsAsync('noop'),
    { provide: GITHUB_API_CONFIG, useValue: environment.githubApi },
  ],
};
