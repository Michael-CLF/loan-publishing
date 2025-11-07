// io-calc.component.ts
import { Component, LOCALE_ID, Inject, ViewChild, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../modals/role-selection-modal/role-selection-modal.component';


@Component({
  selector: 'app-io-calc',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './interest-only-calculator.component.html',
  styleUrls: ['./interest-only-calculator.component.css'],
})
export class InterestOnlyCalculatorComponent {
  @ViewChild(RoleSelectionModalComponent)
   roleModal!: RoleSelectionModalComponent;
  calculatorForm: FormGroup;
  calculationResult: any = null;
  private modalService = inject(ModalService);

  constructor(private fb: FormBuilder) {
    this.calculatorForm = this.fb.group({
      principal: [null, [Validators.required, Validators.min(1)]],
      interestRate: [null, [Validators.required, Validators.min(0.01)]],
      termValue: [null, [Validators.required, Validators.min(1)]],
      termUnit: ['years', Validators.required],
      paymentFrequency: ['monthly', Validators.required],
    });
  }
   openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}


  // Convenience getters for form controls
  get principal() {
    return this.calculatorForm.get('principal');
  }
  get interestRate() {
    return this.calculatorForm.get('interestRate');
  }
  get termValue() {
    return this.calculatorForm.get('termValue');
  }

  calculateInterest() {
    if (this.calculatorForm.invalid) {
      return;
    }

    const formValues = this.calculatorForm.value;

    // Get values from form
    const principal = Number(formValues.principal);
    const annualInterestRate = Number(formValues.interestRate) / 100; // Convert to decimal
    const termValue = Number(formValues.termValue);
    const termUnit = formValues.termUnit;
    const paymentFrequency = formValues.paymentFrequency;

    // Calculate term in months
    const termMonths = termUnit === 'years' ? termValue * 12 : termValue;

    // Determine number of payments per year and frequency display name
    let paymentsPerYear = 12; // Default: monthly
    let frequencyName = 'Monthly';

    switch (paymentFrequency) {
      case 'monthly':
        paymentsPerYear = 12;
        frequencyName = 'Monthly';
        break;
      case 'quarterly':
        paymentsPerYear = 4;
        frequencyName = 'Quarterly';
        break;
      case 'semiannually':
        paymentsPerYear = 2;
        frequencyName = 'Semi-Annual';
        break;
      case 'annually':
        paymentsPerYear = 1;
        frequencyName = 'Annual';
        break;
    }

    // Calculate total number of payments
    const numberOfPayments = Math.ceil((termMonths * paymentsPerYear) / 12);

    // Calculate periodic interest rate
    const periodicRate = annualInterestRate / paymentsPerYear;

    // Calculate interest-only payment
    const payment = principal * periodicRate;

    // Total interest paid
    const totalInterest = payment * numberOfPayments;

    // Final payment includes principal repayment
    const finalPayment = payment + principal;

    this.calculationResult = {
      payment,
      frequency: frequencyName,
      numberOfPayments,
      totalInterest,
      finalPayment,
    };
  }
}
