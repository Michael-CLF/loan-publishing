import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

@Component({
  selector: 'app-fix-flip-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './fix-flip-calculator.component.html',
  styleUrls: ['./fix-flip-calculator.component.css'],
})
export class FixFlipCalculator implements OnInit {
  calculatorForm!: FormGroup;
  results: any = null;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.calculatorForm = this.fb.group({
      purchasePrice: [Validators.required, Validators.min(0)],
      estimatedRepairCosts: [Validators.required, Validators.min(0)],
      afterRepairValue: [Validators.required, Validators.min(0)],
      holdingCosts: [Validators.required, Validators.min(0)],
      closingCosts: [Validators.required, Validators.min(0)],
      realtorFees: [
        Validators.required,
        Validators.min(0),
        Validators.max(100),
      ],
      additionalCosts: [Validators.required, Validators.min(0)],
    });
  }

  calculate(): void {
    if (this.calculatorForm.valid) {
      const formValues = this.calculatorForm.value;

      // Calculate total investment
      const totalInvestment =
        formValues.purchasePrice +
        formValues.estimatedRepairCosts +
        formValues.holdingCosts +
        formValues.closingCosts +
        formValues.additionalCosts;

      // Calculate selling costs
      const realtorFeesAmount =
        (formValues.realtorFees / 100) * formValues.afterRepairValue;
      const totalSellingCosts = realtorFeesAmount + formValues.closingCosts;

      // Calculate profit
      const netSaleProceeds = formValues.afterRepairValue - totalSellingCosts;
      const grossProfit = netSaleProceeds - totalInvestment;
      const roi = (grossProfit / totalInvestment) * 100;

      this.results = {
        totalInvestment: totalInvestment,
        totalSellingCosts: totalSellingCosts,
        netSaleProceeds: netSaleProceeds,
        grossProfit: grossProfit,
        roi: roi,
      };
    }
  }

  resetForm(): void {
    this.initForm();
    this.results = null;
  }
}
