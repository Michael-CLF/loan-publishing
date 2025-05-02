// src/app/modals/saved-lender-success-modal/saved-lender-success-modal.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-saved-lender-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './saved-lender-success-modal.component.html',
  styleUrls: ['./saved-lender-success-modal.component.css'],
})
export class SavedLenderSuccessModalComponent {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.visible = false;
    this.closed.emit();
  }
}
