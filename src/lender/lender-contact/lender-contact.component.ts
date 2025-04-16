import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

interface StateOption {
  value: string;
  name: string;
}

@Component({
  selector: 'app-lender-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-contact.component.html',
  styleUrls: ['./lender-contact.component.css'],
})
export class LenderContactComponent {
  @Input() lenderForm!: FormGroup;
  @Input() states: StateOption[] = [];

  // Format phone number as the user types
  formatPhoneNumberOnInput(event: any): void {
    const input = event.target.value.replace(/\D/g, '');
    const phoneControl = this.lenderForm.get('contactPhone');

    if (input.length <= 10) {
      let formattedNumber = input;

      if (input.length > 3) {
        formattedNumber = `(${input.substring(0, 3)}) ${input.substring(3)}`;
      }

      if (input.length > 6) {
        formattedNumber = `(${input.substring(0, 3)}) ${input.substring(
          3,
          6
        )}-${input.substring(6)}`;
      }

      // Update the value without marking as touched to prevent premature validation
      phoneControl?.setValue(formattedNumber, { emitEvent: false });

      // Update validity manually
      if (input.length === 10) {
        phoneControl?.setErrors(null);
      } else if (input.length > 0) {
        phoneControl?.setErrors({ invalidLength: true });
      }
    }
  }

  // Keep the blur handler for cases where the user pastes a number
  formatPhoneNumber(): void {
    const phoneControl = this.lenderForm.get('contactPhone');
    if (phoneControl?.value) {
      let phoneNumber = phoneControl.value.replace(/\D/g, '');
      if (phoneNumber.length === 10) {
        const formattedNumber = `(${phoneNumber.substring(
          0,
          3
        )}) ${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6)}`;
        phoneControl.setValue(formattedNumber, { emitEvent: false });
        phoneControl.setErrors(null);
      } else if (phoneNumber.length > 0) {
        phoneControl.setErrors({ invalidLength: true });
      }
    }
  }
}
