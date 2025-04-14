import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, NgClass, NgIf, NgFor } from '@angular/common';

@Component({
  selector: 'app-lender-contact',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, NgIf, NgFor, CommonModule],
  templateUrl: './lender-contact.component.html',
  styleUrl: './lender-contact.component.css',
})
export class LenderContactComponent {
  @Input() parentForm!: FormGroup;
  @Output() next = new EventEmitter<void>();

  get firstName() {
    return this.parentForm.get('firstName');
  }

  get lastName() {
    return this.parentForm.get('lastName');
  }

  get contactPhone() {
    return this.parentForm.get('contactPhone');
  }

  get contactEmail() {
    return this.parentForm.get('contactEmail');
  }

  get city() {
    return this.parentForm.get('city');
  }

  get state() {
    return this.parentForm.get('state');
  }

  // Add this method if it's missing
  isInvalid(controlName: string): boolean {
    const control = this.parentForm.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  // Format phone number on blur
  formatPhoneNumber(): void {
    const phoneControl = this.parentForm.get('contactPhone');
    if (phoneControl?.value) {
      let phoneNumber = phoneControl.value.replace(/\D/g, '');
      if (phoneNumber.length === 10) {
        const formattedNumber = `(${phoneNumber.substring(
          0,
          3
        )}) ${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6)}`;
        phoneControl.setValue(formattedNumber, { emitEvent: false });
      }
    }
  }
}
