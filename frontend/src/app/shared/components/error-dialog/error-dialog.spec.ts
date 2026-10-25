import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorDialog } from './error-dialog';

describe('ErrorDialog', () => {
  let fixture: ComponentFixture<ErrorDialog>;
  let trigger: HTMLButtonElement;
  let showModal: ReturnType<typeof vi.fn>;
  let closeDialog: ReturnType<typeof vi.fn>;
  const originalShowModal = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    'showModal',
  );
  const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

  beforeEach(async () => {
    // jsdom has no modal top layer; model only its open/close API for unit tests.
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    closeDialog = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: showModal },
      close: { configurable: true, value: closeDialog },
    });

    await TestBed.configureTestingModule({ imports: [ErrorDialog] }).compileComponents();
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
    if (originalShowModal) {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
    }
    if (originalClose) {
      Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
    }
    vi.restoreAllMocks();
  });

  it('renders the required message with accessible modal semantics', () => {
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="alertdialog"]') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toContain(
      'Something went wrong',
    );
    expect(
      document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent,
    ).toContain('GitHub is temporarily unavailable. Please try again.');
    expect(showModal).toHaveBeenCalledOnce();
  });

  it('focuses the close button after opening', () => {
    fixture.detectChanges();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('button'));
  });

  it('keeps Tab and Shift+Tab focused on the sole close control', () => {
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const closeButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    for (const shiftKey of [false, true]) {
      const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      dialog.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(closeButton);
    }
  });

  it('closes and restores focus to the triggering control', () => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.nativeElement.querySelector('button').click();
    expect(closeDialog).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
  });

  it('restores the supplied trigger after focus was lost while its request was in progress', () => {
    trigger.blur();
    expect(document.activeElement).toBe(document.body);
    fixture.componentRef.setInput('returnFocus', trigger);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(document.activeElement).toBe(trigger);
  });

  it('restores the latest error trigger when the message changes while the modal is open', () => {
    fixture.componentRef.setInput('returnFocus', trigger);
    fixture.detectChanges();
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
      expect(showModal).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(fixture.nativeElement.querySelector('button'));

      fixture.nativeElement.querySelector('button').click();

      expect(document.activeElement).toBe(nextTrigger);
    } finally {
      nextTrigger.remove();
    }
  });

  it('falls back to the original trigger when the updated error trigger was removed', () => {
    fixture.componentRef.setInput('returnFocus', trigger);
    fixture.detectChanges();
    const removedTrigger = document.createElement('button');
    fixture.componentRef.setInput('returnFocus', removedTrigger);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(document.activeElement).toBe(trigger);
  });

  it('handles the native cancel event generated by Escape', () => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const cancel = new Event('cancel', { cancelable: true });
    fixture.nativeElement.querySelector('dialog').dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(closed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
  });

  it('emits only once if dismissal is requested more than once', () => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.close();
    fixture.componentInstance.close();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('closes the modal and restores focus when its host is destroyed', () => {
    fixture.detectChanges();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.destroy();
    expect(closeDialog).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    expect(closed).not.toHaveBeenCalled();
  });
});
