import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ltv-calc',
  templateUrl: './ltv-calculator.component.html',
  styleUrls: ['./ltv-calculator.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class LtvCalculatorComponent {
  ltvForm!: FormGroup;
  ltvResult: {
    ltvRatio: number;
    ltvPercentage: number;
    maxLoanAmount?: number;
    additionalEquityNeeded?: number;
  } | null = null;
  calculationMode: 'calculate' | 'reverse' = 'calculate';

  constructor(private fb: FormBuilder) {
    this.initializeForm();
  }

  initializeForm(): void {
    this.ltvForm = this.fb.group({
      // Standard LTV calculation fields
      propertyValue: [300000, [Validators.required, Validators.min(1)]],
      loanAmount: [240000, [Validators.required, Validators.min(0)]],

      // Reverse calculation (max loan) fields
      targetLtv: [
        80,
        [Validators.required, Validators.min(1), Validators.max(100)],
      ],
      propertyValueReverse: [300000, [Validators.required, Validators.min(1)]],
    });
  }

  switchCalculationMode(mode: 'calculate' | 'reverse'): void {
    this.calculationMode = mode;
    this.ltvResult = null;
  }

  calculateLTV(): void {
    if (this.ltvForm.invalid) {
      this.markFormGroupTouched(this.ltvForm);
      return;
    }

    if (this.calculationMode === 'calculate') {
      this.performLtvCalculation();
    } else {
      this.performReverseLtvCalculation();
    }
  }

  private performLtvCalculation(): void {
    const propertyValue = this.ltvForm.get('propertyValue')?.value;
    const loanAmount = this.ltvForm.get('loanAmount')?.value;

    if (propertyValue <= 0) {
      return; // Avoid division by zero
    }

    const ltvRatio = loanAmount / propertyValue;
    const ltvPercentage = ltvRatio * 100;

    // Common threshold LTV percentages
    const commonThresholds = [80, 85, 90, 95];
    let additionalEquityNeeded: number | undefined = undefined;

    // Find the nearest threshold below current LTV
    for (const threshold of commonThresholds) {
      if (ltvPercentage > threshold) {
        const targetLoanAmount = (threshold / 100) * propertyValue;
        additionalEquityNeeded = loanAmount - targetLoanAmount;
        break;
      }
    }

    this.ltvResult = {
      ltvRatio: ltvRatio,
      ltvPercentage: ltvPercentage,
      additionalEquityNeeded: additionalEquityNeeded,
    };
  }

  private performReverseLtvCalculation(): void {
    const propertyValue = this.ltvForm.get('propertyValueReverse')?.value;
    const targetLtv = this.ltvForm.get('targetLtv')?.value;

    if (propertyValue <= 0 || targetLtv <= 0) {
      return; // Avoid invalid calculations
    }

    const maxLoanAmount = (targetLtv / 100) * propertyValue;

    this.ltvResult = {
      ltvRatio: targetLtv / 100,
      ltvPercentage: targetLtv,
      maxLoanAmount: maxLoanAmount,
    };
  }

  resetForm(): void {
    this.ltvForm.reset({
      propertyValue: 300000,
      loanAmount: 240000,
      targetLtv: 80,
      propertyValueReverse: 300000,
    });
    this.ltvResult = null;
  }

  // Helper method to mark all form controls as touched
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
