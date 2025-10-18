// balloon-calc.component.ts
import { Component, LOCALE_ID, Inject, ViewChild, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../role-selection-modal/role-selection-modal.component';

@Component({
  selector: 'app-balloon-calc',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './balloon-calculator.component.html',
  styleUrls: ['./balloon-calculator.component.css'],
  providers: [],
})
export class BalloonCalculatorComponent {
  @ViewChild(RoleSelectionModalComponent)
  roleModal!: RoleSelectionModalComponent;
  balloonForm: FormGroup;
  result: {
    regularPayment: number;
    totalInterest: number;
    balloonPayment: number;
    amortizationSchedule: Array<{
      paymentNumber: number;
      paymentAmount: number;
      principalPaid: number;
      interestPaid: number;
      remainingBalance: number;
    }>;
  } | null = null;

  formattedValues = {
    amount: '',
    rate: '',
    loanTerm: '',
    balloonTerm: '',
  };
private modalService = inject(ModalService);


  constructor(
    private fb: FormBuilder,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    this.balloonForm = this.fb.group(
      {
        loanAmount: [null, [Validators.required, Validators.min(1)]],
        interestRate: [null, [Validators.required, Validators.min(0.01)]],
        loanTermYears: [null, [Validators.required, Validators.min(1)]],
        balloonTermYears: [null, [Validators.required, Validators.min(1)]],
      },
      { validators: this.balloonTermValidator },
    );
  }
  openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}
  // Custom validator to ensure balloon term is less than loan term
  balloonTermValidator(form: FormGroup) {
    const loanTerm = form.get('loanTermYears')?.value;
    const balloonTerm = form.get('balloonTermYears')?.value;

    if (balloonTerm >= loanTerm) {
      return { balloonTermTooLong: true };
    }

    return null;
  }

  calculateBalloonPayment() {
    if (this.balloonForm.invalid) {
      this.markFormGroupTouched(this.balloonForm);
      return;
    }

    const loanAmount = this.balloonForm.get('loanAmount')!.value;
    const annualInterestRate =
      this.balloonForm.get('interestRate')!.value / 100;
    const loanTermMonths = this.balloonForm.get('loanTermYears')!.value * 12;
    const balloonTermMonths =
      this.balloonForm.get('balloonTermYears')!.value * 12;

    // Monthly interest rate
    const monthlyRate = annualInterestRate / 12;

    // Calculate regular payment based on full amortization
    const regularPayment = this.calculateMonthlyPayment(
      loanAmount,
      monthlyRate,
      loanTermMonths,
    );

    // Generate amortization schedule up to balloon payment
    const schedule = this.generateAmortizationSchedule(
      loanAmount,
      monthlyRate,
      regularPayment,
      balloonTermMonths,
    );

    // The balloon payment is the remaining balance after all regular payments
    const balloonPayment = schedule[schedule.length - 1].remainingBalance;

    // Calculate total interest paid
    const totalInterest = schedule.reduce(
      (sum, payment) => sum + payment.interestPaid,
      0,
    );

    this.result = {
      regularPayment,
      totalInterest,
      balloonPayment,
      amortizationSchedule: schedule,
    };

    // Update the formatted values for display
    this.formattedValues = {
      amount: this.formatAsCurrency(loanAmount),
      rate: `${this.balloonForm.get('interestRate')!.value}%`,
      loanTerm: `${this.balloonForm.get('loanTermYears')!.value} years`,
      balloonTerm: `${this.balloonForm.get('balloonTermYears')!.value} years`,
    };
  }

  calculateMonthlyPayment(
    principal: number,
    monthlyRate: number,
    termMonths: number,
  ): number {
    if (monthlyRate === 0) {
      return principal / termMonths;
    }

    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1)
    );
  }

  generateAmortizationSchedule(
    principal: number,
    monthlyRate: number,
    monthlyPayment: number,
    numPayments: number,
  ) {
    let remainingBalance = principal;
    const schedule = [];

    for (let i = 1; i <= numPayments; i++) {
      // Calculate interest for this period
      const interestForMonth = remainingBalance * monthlyRate;

      // Calculate principal for this period
      let principalForMonth = monthlyPayment - interestForMonth;

      // Adjust the last payment to account for rounding errors
      if (principalForMonth > remainingBalance) {
        principalForMonth = remainingBalance;
      }

      // Calculate new balance
      remainingBalance -= principalForMonth;

      // Format currency values properly
      schedule.push({
        paymentNumber: i,
        paymentAmount: +monthlyPayment.toFixed(2),
        principalPaid: +principalForMonth.toFixed(2),
        interestPaid: +interestForMonth.toFixed(2),
        remainingBalance: +remainingBalance.toFixed(2),
      });

      // If we've paid off the loan, we're done
      if (remainingBalance <= 0) {
        break;
      }
    }

    return schedule;
  }

  resetCalculator() {
    // Reset everything to null to have blank fields
    this.balloonForm.reset();
    this.result = null;
  }

  // Format number as US currency
  public formatAsCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  // Helper method to mark all controls as touched
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if ((control as any).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }
}
