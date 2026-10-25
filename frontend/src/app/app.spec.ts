import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './app';
import { routes } from './app.routes';
import { GithubApiService } from './core/services/github-api.service';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: GithubApiService,
          useValue: {
            mode: 'mock',
            getLiveCommits: () => of([]),
            getScheduledCommits: () => of({ commits: [], lastSyncTime: null }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('initializes the application shell with a router outlet', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(RouterOutlet))).not.toBeNull();
  });

  it('loads the repository dashboard at the default route', async () => {
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(
      'GitHub Repository Monitor',
    );
    expect(
      fixture.debugElement.query(By.directive(RouterOutlet)).injector.get(RouterOutlet).isActivated,
    ).toBe(true);
  });

  it('redirects unknown routes to the dashboard', async () => {
    await router.navigateByUrl('/unknown-page');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(
      'GitHub Repository Monitor',
    );
  });
});
