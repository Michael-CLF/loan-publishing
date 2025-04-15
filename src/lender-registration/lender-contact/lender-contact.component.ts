import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, NgClass, NgIf, NgFor } from '@angular/common';

interface StateOption {
  value: string;
  name: string;
}

@Component({
  selector: 'app-lender-contact',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, NgIf, NgFor, CommonModule],
  templateUrl: './lender-contact.component.html',
  styleUrl: './lender-contact.component.css',
})
export class LenderContactComponent {
  @Input() parentForm!: FormGroup;
  @Input() states: StateOption[] = [];

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
