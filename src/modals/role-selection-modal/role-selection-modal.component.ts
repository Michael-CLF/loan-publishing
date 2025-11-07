import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export type UserRole = 'originator' | 'lender';

@Component({
  selector: 'app-role-selection-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './role-selection-modal.component.html',
  styleUrls: ['./role-selection-modal.component.css'],
})
export class RoleSelectionModalComponent {
  @Output() modalClosed = new EventEmitter<void>();
  @Output() roleSelected = new EventEmitter<UserRole>();

  isVisible = false;

  private router = inject(Router);

  open(): void {
    this.isVisible = true;
  }

  close(): void {
    this.isVisible = false;
    this.modalClosed.emit();
  }

  selectRole(role: UserRole): void {
     console.log('selectRole called with:', role); // Add this
    this.close();

    // Navigate to route based on selected role
    if (role === 'originator') {
      console.log('Navigating to user-form'); // Add this
      this.router.navigate(['/user-form']);
    } else if (role === 'lender') {
      console.log('Navigating to lender-registration'); // Add this
      this.router.navigate(['/lender-registration']);
    }
  }
}
