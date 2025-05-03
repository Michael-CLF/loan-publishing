import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-delete-account-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delete-account-modal.component.html',
  styleUrls: ['./delete-account-modal.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-in', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('200ms ease-out', style({ opacity: 0 }))]),
    ]),
  ],
})
export class DeleteAccountModalComponent {
  @Input() userType: 'lender' | 'originator' = 'originator';
  @Input() isOpen = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  // Computed property to display user type label
  get userTypeLabel(): string {
    return this.userType === 'lender' ? 'Lender' : 'Originator';
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
