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
import { DscrService } from '../../../services/dscr.service'
import { DscrCalculation } from '../../../models/dscr.model';


@Component({
  selector: 'app-dscr-calculator',
  templateUrl: './dscr-calculator.component.html',
  styleUrls: ['./dscr-calculator.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class DscrCalculatorComponent implements OnInit {
   @ViewChild(RoleSelectionModalComponent)
   roleModal!: RoleSelectionModalComponent;
  dscrForm: FormGroup;
  dscrResult: DscrCalculation | null = null;
  isCalculated = false;
  private modalService = inject(ModalService);

  constructor(
    private fb: FormBuilder,
    private dscrService: DscrService,
  ) {
    this.dscrForm = this.fb.group({
      netOperatingIncome: ['', [Validators.required, Validators.min(0)]],
      totalDebtService: ['', [Validators.required, Validators.min(0.01)]],
      propertyValue: ['', Validators.min(0)],
      loanAmount: ['', Validators.min(0)],
    });
  }

   openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}


  ngOnInit(): void {
    // Initialize any additional component setup
  }

  calculateDscr(): void {
    if (this.dscrForm.valid) {
      const formValues = this.dscrForm.value;

      this.dscrResult = this.dscrService.calculateDscr(
        formValues.netOperatingIncome,
        formValues.totalDebtService,
        formValues.propertyValue,
        formValues.loanAmount,
      );

      this.isCalculated = true;
    } else {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.dscrForm.controls).forEach((key) => {
        const control = this.dscrForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  resetCalculator(): void {
    this.dscrForm.reset();
    this.dscrResult = null;
    this.isCalculated = false;
  }

  getDscrRatingClass(): string {
    if (!this.dscrResult) return '';

    if (this.dscrResult.dscrValue >= 1.5) {
      return 'excellent-rating';
    } else if (this.dscrResult.dscrValue >= 1.25) {
      return 'good-rating';
    } else if (this.dscrResult.dscrValue >= 1.0) {
      return 'acceptable-rating';
    } else {
      return 'poor-rating';
    }
  }

  getFormControlError(controlName: string): string {
    const control = this.dscrForm.get(controlName);

    if (control?.hasError('required')) {
      return 'This field is required';
    }

    if (control?.hasError('min')) {
      if (
        controlName === 'totalDebtService' &&
        control.errors?.['min']?.min === 0.01
      ) {
        return 'Value must be greater than zero';
      }
      return 'Value cannot be negative';
    }

    return '';
  }
}
