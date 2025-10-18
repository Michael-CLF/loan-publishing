import { Component, LOCALE_ID, Inject, ViewChild, inject, OnInit } from '@angular/core';
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
  selector: 'app-fix-flip-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './fix-flip-calculator.component.html',
  styleUrls: ['./fix-flip-calculator.component.css'],
})
export class FixFlipCalculatorComponent implements OnInit {
  calculatorForm!: FormGroup;
  results: any = null;
  
 @ViewChild(RoleSelectionModalComponent)
   roleModal!: RoleSelectionModalComponent;

private modalService = inject(ModalService);

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initForm();
  }
   openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

 private initForm(): void {
  this.calculatorForm = this.fb.group({
    purchasePrice: [null, [Validators.required, Validators.min(0)]],
    estimatedRepairCosts: [null, [Validators.required, Validators.min(0)]],
    afterRepairValue: [null, [Validators.required, Validators.min(0)]],
    holdingCosts: [null, [Validators.required, Validators.min(0)]],
    closingCosts: [null, [Validators.required, Validators.min(0)]],
    realtorFees: [null, [Validators.required, Validators.min(0), Validators.max(100)]],
    additionalCosts: [null, [Validators.required, Validators.min(0)]],
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
