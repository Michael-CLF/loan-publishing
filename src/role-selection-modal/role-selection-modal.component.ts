import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type UserRole = 'originator' | 'lender';

@Component({
  selector: 'app-role-selection-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selection-modal.component.html',
  styleUrls: ['./role-selection-modal.component.css'],
})
export class RoleSelectionModalComponent {
  @Output() roleSelected = new EventEmitter<UserRole>();
  @Output() modalClosed = new EventEmitter<void>();

  isVisible = false;

  open(): void {
    this.isVisible = true;
  }

  close(): void {
    this.isVisible = false;
    this.modalClosed.emit();
  }

  selectRole(role: UserRole): void {
    this.roleSelected.emit(role);
    this.close();
  }
}
