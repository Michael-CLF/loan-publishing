import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-breakeven-calc',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './breakeven-calculator.component.html',
  styleUrls: ['./breakeven-calculator.component.css'],
})
export class BreaKevenCalculatorComponent {
  breakEvenForm: FormGroup;
  breakEvenRatio: number | null = null;

  constructor(private fb: FormBuilder) {
    this.breakEvenForm = this.fb.group({
      debtService: [null, [Validators.required, Validators.min(0)]],
      operatingExpenses: [null, [Validators.required, Validators.min(0)]],
      grossOperatingIncome: [null, [Validators.required, Validators.min(0.01)]],
    });
  }

  calculateBreakEven(): void {
    if (this.breakEvenForm.valid) {
      const debtService = this.breakEvenForm.get('debtService')?.value || 0;
      const operatingExpenses =
        this.breakEvenForm.get('operatingExpenses')?.value || 0;
      const grossOperatingIncome =
        this.breakEvenForm.get('grossOperatingIncome')?.value || 0;

      // Break-Even Ratio = (Debt Service + Operating Expenses) / Gross Operating Income
      this.breakEvenRatio =
        (debtService + operatingExpenses) / grossOperatingIncome;
    } else {
      // Mark all fields as touched to trigger validation errors
      this.breakEvenForm.markAllAsTouched();
      this.breakEvenRatio = null;
    }
  }

  resetForm(): void {
    this.breakEvenForm.reset();
    this.breakEvenRatio = null;
  }

  // Helper method to check if a field is invalid and touched
  isFieldInvalid(fieldName: string): boolean {
    const field = this.breakEvenForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }
}
