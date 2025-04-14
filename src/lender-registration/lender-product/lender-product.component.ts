import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

interface LenderType {
  value: string;
  name: string;
}

@Component({
  selector: 'app-lender-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-product.component.html',
  styleUrls: ['./lender-product.component.css'],
})
export class LenderProductComponent {
  @Input() parentForm!: FormGroup;
  @Input() lenderTypes: LenderType[] = [];

  get minLoanAmount() {
    return this.parentForm.get('minLoanAmount');
  }

  get maxLoanAmount() {
    return this.parentForm.get('maxLoanAmount');
  }

  get lenderType() {
    return this.parentForm.get('lenderType');
  }

  // Helper method to check if control is invalid and touched/dirty
  isInvalid(controlName: string): boolean {
    const control = this.parentForm.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  // Format currency as user types
  formatCurrency(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Remove non-numeric characters except the first decimal point
    let numericValue = value.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      numericValue = parts[0] + '.' + parts.slice(1).join('');
    }

    // Set the formatted value
    this.parentForm
      .get(controlName)
      ?.setValue(numericValue, { emitEvent: false });
  }
}
