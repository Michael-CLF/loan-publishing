import { Component, LOCALE_ID, Inject, ViewChild, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../modals/role-selection-modal/role-selection-modal.component';

@Component({
  selector: 'app-irr-calc',
  templateUrl: './irr-calculator.component.html',
  styleUrls: ['./irr-calculator.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class IrrCalculatorComponent {
  irrForm: FormGroup;
  irrResult: number | null = null;
  errorMessage: string | null = null;
   @ViewChild(RoleSelectionModalComponent)
   roleModal!: RoleSelectionModalComponent;

   private modalService = inject(ModalService);

  constructor(private fb: FormBuilder) {
    this.irrForm = this.fb.group({
      cashFlows: this.fb.array([
        this.fb.group({
          amount: [0, Validators.required],
          year: [0, [Validators.required, Validators.min(0)]],
        }),
      ]),
    });
  }

   openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  get cashFlows(): FormArray {
    return this.irrForm.get('cashFlows') as FormArray;
  }

  addCashFlow(): void {
    this.cashFlows.push(
      this.fb.group({
        amount: [0, Validators.required],
        year: [this.getNextYear(), [Validators.required, Validators.min(0)]],
      }),
    );
  }

  removeCashFlow(index: number): void {
    if (this.cashFlows.length > 1) {
      this.cashFlows.removeAt(index);
    }
  }

  getNextYear(): number {
    if (this.cashFlows.length === 0) return 0;
    const lastYear =
      this.cashFlows.at(this.cashFlows.length - 1).get('year')?.value || 0;
    return lastYear + 1;
  }

  resetForm(): void {
    this.irrForm.reset();
    this.cashFlows.clear();
    this.cashFlows.push(
      this.fb.group({
        amount: [0, Validators.required],
        year: [0, [Validators.required, Validators.min(0)]],
      }),
    );
    this.irrResult = null;
    this.errorMessage = null;
  }

  calculateIRR(): void {
    if (this.irrForm.invalid) {
      this.errorMessage = 'Please enter valid cash flow values';
      this.irrResult = null;
      return;
    }

    const cashFlowValues = this.cashFlows.value.sort(
      (a: { year: number }, b: { year: number }) => a.year - b.year,
    );

    // Ensure the first cash flow is negative (investment)
    if (cashFlowValues[0].amount >= 0) {
      this.errorMessage =
        'The first cash flow should be negative (representing the initial investment)';
      this.irrResult = null;
      return;
    }

    try {
      this.irrResult = this.computeIRR(cashFlowValues);
      this.errorMessage = null;
    } catch (error) {
      this.errorMessage =
        'Could not calculate IRR. Please check your cash flows.';
      this.irrResult = null;
    }
  }

  private computeIRR(cashFlows: { amount: number; year: number }[]): number {
    // Prepare cash flow array where index is the year
    const maxYear = Math.max(...cashFlows.map((cf) => cf.year));
    const normalizedCashFlows = Array(maxYear + 1).fill(0);

    cashFlows.forEach((cf) => {
      normalizedCashFlows[cf.year] += cf.amount;
    });

    // Newton-Raphson method to find IRR
    let guess = 0.1; // initial guess
    const maxIterations = 1000;
    const tolerance = 0.0000001;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivative = 0;

      for (let j = 0; j < normalizedCashFlows.length; j++) {
        const denominator = Math.pow(1 + guess, j);
        npv += normalizedCashFlows[j] / denominator;
        derivative -= (j * normalizedCashFlows[j]) / Math.pow(1 + guess, j + 1);
      }

      const newGuess = guess - npv / derivative;

      if (Math.abs(newGuess - guess) < tolerance) {
        return newGuess * 100; // Convert to percentage
      }

      guess = newGuess;
    }

    throw new Error('IRR calculation did not converge');
  }
}
