import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonDirective } from '@progress/kendo-angular-buttons';
import {
  DialogActionsComponent,
  DialogComponent,
  DialogTitleBarComponent,
} from '@progress/kendo-angular-dialog';

let nextDialogId = 0;

@Component({
  selector: 'app-error-dialog',
  imports: [ButtonDirective, DialogComponent, DialogTitleBarComponent, DialogActionsComponent],
  templateUrl: './error-dialog.html',
  styleUrl: './error-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorDialog implements OnInit, OnDestroy {
  readonly message = input.required<string>();
  readonly returnFocus = input<HTMLElement | null>(null);
  readonly closed = output<void>();
  readonly titleId = `error-dialog-title-${nextDialogId++}`;
  readonly descriptionId = `${this.titleId}-description`;
  protected readonly isOpen = signal(true);

  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly dialog = viewChild<unknown, ElementRef<HTMLElement>>('dialog', {
    read: ElementRef,
  });
  private readonly closeButton = viewChild<unknown, ElementRef<HTMLButtonElement>>('closeButton', {
    read: ElementRef,
  });
  private previousFocus: HTMLElement | null = null;
  private dismissed = false;

  constructor() {
    afterNextRender(() => {
      if (this.dismissed) return;
      // Kendo 25.3 waits for NgZone.onStable to label and focus its dialog.
      // Angular 22 is zoneless, so complete these steps after rendering instead.
      const modal = this.dialog()?.nativeElement.querySelector('[role="dialog"]');
      if (modal) {
        this.renderer.setAttribute(modal, 'aria-labelledby', this.titleId);
        this.renderer.setAttribute(modal, 'aria-describedby', this.descriptionId);
      }
      this.closeButton()?.nativeElement.focus({ preventScroll: true });
    });
  }

  ngOnInit(): void {
    const activeElement = this.document.activeElement;
    const trigger = this.returnFocus();
    this.previousFocus = trigger?.isConnected
      ? trigger
      : activeElement instanceof HTMLElement
        ? activeElement
        : null;
  }

  close(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.isOpen.set(false);
    this.restoreFocus();
    this.closed.emit();
  }

  ngOnDestroy(): void {
    if (!this.dismissed) this.restoreFocus();
  }

  private restoreFocus(): void {
    // A second request can replace the displayed error without recreating the dialog.
    const latestTrigger = this.returnFocus();
    const restoreTarget = latestTrigger?.isConnected ? latestTrigger : this.previousFocus;
    if (restoreTarget?.isConnected) {
      restoreTarget.focus({ preventScroll: true });
    }
  }
}
