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
  selector: 'app-noi-calc',
  templateUrl: './noi-calculator.component.html',
  styleUrls: ['./noi-calculator.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class NoiCalculatorComponent {
  noiForm: FormGroup;
  results: {
    grossIncome: number;
    operatingExpenses: number;
    netOperatingIncome: number;
    capRate?: number;
  } | null = null;
   @ViewChild(RoleSelectionModalComponent)
   roleModal!: RoleSelectionModalComponent;

private modalService = inject(ModalService);

  constructor(private fb: FormBuilder) {
    this.noiForm = this.fb.group({
      // Income fields
      rentalIncome: [0, [Validators.required, Validators.min(0)]],
      otherIncome: [0, [Validators.min(0)]],

      // Expense fields
      propertyTax: [0, [Validators.min(0)]],
      insurance: [0, [Validators.min(0)]],
      utilities: [0, [Validators.min(0)]],
      maintenance: [0, [Validators.min(0)]],
      propertyManagement: [0, [Validators.min(0)]],
      vacancyLoss: [0, [Validators.min(0)]],
      otherExpenses: [0, [Validators.min(0)]],

      // Optional property value for cap rate calculation
      propertyValue: [null, [Validators.min(0)]],
    });
  }
   openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  calculateNOI(): void {
    if (this.noiForm.valid) {
      const values = this.noiForm.value;

      // Calculate Gross Income
      const grossIncome = values.rentalIncome + values.otherIncome;

      // Calculate Operating Expenses
      const operatingExpenses =
        values.propertyTax +
        values.insurance +
        values.utilities +
        values.maintenance +
        values.propertyManagement +
        values.vacancyLoss +
        values.otherExpenses;

      // Calculate NOI
      const netOperatingIncome = grossIncome - operatingExpenses;

      // Calculate Cap Rate if property value is provided
      let capRate = undefined;
      if (values.propertyValue && values.propertyValue > 0) {
        capRate = (netOperatingIncome / values.propertyValue) * 100;
      }

      this.results = {
        grossIncome,
        operatingExpenses,
        netOperatingIncome,
        capRate,
      };
    }
  }

  resetForm(): void {
    this.noiForm.reset({
      rentalIncome: 0,
      otherIncome: 0,
      propertyTax: 0,
      insurance: 0,
      utilities: 0,
      maintenance: 0,
      propertyManagement: 0,
      vacancyLoss: 0,
      otherExpenses: 0,
      propertyValue: null,
    });
    this.results = null;
  }
}
