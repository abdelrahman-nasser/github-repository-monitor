import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDialog } from './error-dialog';

describe('ErrorDialog', () => {
  let fixture: ComponentFixture<ErrorDialog>;
  let trigger: HTMLButtonElement;

  function modal(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="dialog"]');
  }

  function closeButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.close-button');
  }

  function titleClose(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('kendo-dialog-titlebar button');
  }

  function pressKey(target: HTMLElement, key: string, shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      code: key,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorDialog],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    trigger = document.createElement('button');
    trigger.textContent = 'Refresh live commits';
    document.body.appendChild(trigger);
    trigger.focus();

    fixture = TestBed.createComponent(ErrorDialog);
    fixture.componentRef.setInput(
      'message',
      'GitHub is temporarily unavailable. Please try again.',
    );
  });

  afterEach(() => {
    fixture?.destroy();
    trigger?.remove();
    vi.restoreAllMocks();
  });

  it('renders the required message with accessible modal semantics', () => {
    fixture.detectChanges();
    const dialog = modal()!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toContain(
      'Something went wrong',
    );
    expect(
      document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent,
    ).toContain('GitHub is temporarily unavailable. Please try again.');
  });

  it('focuses the close button after opening in zoneless Angular', () => {
    fixture.detectChanges();
    expect(document.activeElement).toBe(closeButton());
  });

  it('contains Tab and Shift+Tab within the dialog using Kendo keyboard handling', () => {
    fixture.detectChanges();
    const close = closeButton();
    const titleButton = titleClose();

    expect(pressKey(close, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(titleButton);
    expect(pressKey(titleButton, 'Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
  });

  it('closes and restores focus to the triggering control', () => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    closeButton().click();
    fixture.detectChanges();
    expect(modal()).toBeNull();
    expect(closed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
  });

  it('restores the supplied trigger after focus was lost while its request was in progress', () => {
    trigger.blur();
    expect(document.activeElement).toBe(document.body);
    fixture.componentRef.setInput('returnFocus', trigger);
    fixture.detectChanges();

    closeButton().click();

    expect(document.activeElement).toBe(trigger);
  });

  it('restores the latest error trigger when the message changes while the modal is open', () => {
    fixture.componentRef.setInput('returnFocus', trigger);
    fixture.detectChanges();
    const originalModal = modal();
    const nextTrigger = document.createElement('button');
    nextTrigger.textContent = 'Refresh scheduled commits';
    document.body.appendChild(nextTrigger);

    try {
      fixture.componentRef.setInput('message', 'The scheduled request failed. Please try again.');
      fixture.componentRef.setInput('returnFocus', nextTrigger);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('p').textContent).toContain(
        'The scheduled request failed.',
      );
      expect(modal()).toBe(originalModal);
      expect(document.activeElement).toBe(closeButton());

      closeButton().click();

      expect(document.activeElement).toBe(nextTrigger);
    } finally {
      nextTrigger.remove();
    }
  });

  it('falls back to the original trigger when the updated error trigger was removed', () => {
    fixture.componentRef.setInput('returnFocus', trigger);
    fixture.detectChanges();
    fixture.componentRef.setInput('returnFocus', document.createElement('button'));
    fixture.detectChanges();

    closeButton().click();

    expect(document.activeElement).toBe(trigger);
  });

  it.each(['action', 'titlebar', 'wrapper'])('dismisses with Escape from the %s', (target) => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const control =
      target === 'action'
        ? closeButton()
        : target === 'titlebar'
          ? titleClose()
          : fixture.nativeElement.querySelector('kendo-dialog');
    control.focus();
    pressKey(control, 'Escape');
    fixture.detectChanges();

    expect(modal()).toBeNull();
    expect(closed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
  });

  it('dismisses from the accessible titlebar Close control', () => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    expect(titleClose().getAttribute('aria-label')).toBe('Close');
    titleClose().click();
    fixture.detectChanges();

    expect(modal()).toBeNull();
    expect(closed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
  });

  it('emits only once if Escape, click and close request dismissal repeatedly', () => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const button = closeButton();
    pressKey(button, 'Escape');
    button.click();
    fixture.componentInstance.close();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('restores focus without emitting when its host is destroyed', () => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.destroy();
    expect(document.activeElement).toBe(trigger);
    expect(closed).not.toHaveBeenCalled();
  });

  it('restores the latest connected trigger on destruction', () => {
    fixture.detectChanges();
    const nextTrigger = document.createElement('button');
    document.body.appendChild(nextTrigger);
    try {
      fixture.componentRef.setInput('returnFocus', nextTrigger);
      fixture.detectChanges();
      fixture.destroy();
      expect(document.activeElement).toBe(nextTrigger);
    } finally {
      nextTrigger.remove();
    }
  });

  it('safely destroys a dialog whose focus target has been disconnected', () => {
    fixture.detectChanges();
    trigger.remove();
    const focus = vi.spyOn(trigger, 'focus');
    expect(() => fixture.destroy()).not.toThrow();
    expect(focus).not.toHaveBeenCalled();
  });

  it('does not steal focus again when destroyed after explicit dismissal', () => {
    fixture.detectChanges();
    fixture.componentInstance.close();
    const focus = vi.spyOn(trigger, 'focus');
    fixture.destroy();
    expect(focus).not.toHaveBeenCalled();
  });

  it('can be destroyed before rendering without querying a missing view', () => {
    fixture.componentRef.setInput('returnFocus', trigger);
    expect(() => fixture.destroy()).not.toThrow();
    expect(document.activeElement).toBe(trigger);
  });
});
