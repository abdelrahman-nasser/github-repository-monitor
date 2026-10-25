import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';

let nextDialogId = 0;

@Component({
  selector: 'app-error-dialog',
  templateUrl: './error-dialog.html',
  styleUrl: './error-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorDialog implements AfterViewInit, OnDestroy {
  readonly message = input.required<string>();
  readonly returnFocus = input<HTMLElement | null>(null);
  readonly closed = output<void>();
  readonly titleId = `error-dialog-title-${nextDialogId++}`;
  readonly descriptionId = `${this.titleId}-description`;

  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private previousFocus: HTMLElement | null = null;
  private dismissed = false;

  ngAfterViewInit(): void {
    const activeElement = this.document.activeElement;
    this.previousFocus =
      this.returnFocus() ?? (activeElement instanceof HTMLElement ? activeElement : null);
    // The browser's modal top layer makes the rest of the document inert and contains focus.
    this.dialog().nativeElement.showModal();
    this.closeButton().nativeElement.focus({ preventScroll: true });
  }

  onCancel(event: Event): void {
    // Native dialogs dispatch cancel when Escape is pressed.
    event.preventDefault();
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    // This dialog has one interactive control; keep both Tab directions on it.
    event.preventDefault();
    this.closeButton().nativeElement.focus({ preventScroll: true });
  }

  close(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.closeAndRestoreFocus();
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.closeAndRestoreFocus();
  }

  private closeAndRestoreFocus(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
    // A second request can replace the displayed error without recreating the dialog.
    const latestTrigger = this.returnFocus();
    const restoreTarget = latestTrigger?.isConnected ? latestTrigger : this.previousFocus;
    if (restoreTarget?.isConnected) {
      restoreTarget.focus({ preventScroll: true });
    }
  }
}
