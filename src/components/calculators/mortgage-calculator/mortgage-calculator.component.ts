import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MortgageService } from '../../../services/mortgage.service';
import { MortgageResult } from '../../../models/mortgage.model';
import { MortgageResultsComponent } from '../mortgage-results/mortgage-results.component';


@Component({
  selector: 'app-mortgage-calc',
  templateUrl: './mortgage-calculator.component.html',
  styleUrls: ['./mortgage-calculator.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MortgageResultsComponent,
  ],
})
export class MortgageCalculatorComponent implements OnInit {
  mortgageForm!: FormGroup;
  calculationResults!: MortgageResult;
  calculationComplete = false;

  constructor(
    private fb: FormBuilder,
    private mortgageService: MortgageService,
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.mortgageForm = this.fb.group({
      loanAmount: [null, [Validators.required, Validators.min(1)]],
      interestRate: [
        null,
        [Validators.required, Validators.min(0.1), Validators.max(99.99)],
      ],
      loanTerm: [30, Validators.required],
      propertyTax: [0],
      insurance: [0],
      downPayment: [0],
    });
  }

  calculateMortgage(): void {
    if (this.mortgageForm.valid) {
      const formValues = this.mortgageForm.value;

      // Calculate final loan amount after down payment
      const finalLoanAmount =
        formValues.loanAmount - (formValues.downPayment || 0);

      this.calculationResults = this.mortgageService.calculateMortgage({
        loanAmount: finalLoanAmount,
        interestRate: formValues.interestRate,
        loanTerm: formValues.loanTerm,
        propertyTax: formValues.propertyTax || 0,
        insurance: formValues.insurance || 0,
      });

      this.calculationComplete = true;
    }
  }
}
