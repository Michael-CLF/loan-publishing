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
  selector: 'app-breakeven-calc',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './breakeven-calculator.component.html',
  styleUrls: ['./breakeven-calculator.component.css'],
})
export class BreaKevenCalculatorComponent {
   @ViewChild(RoleSelectionModalComponent)
   roleModal!: RoleSelectionModalComponent;
  breakEvenForm: FormGroup;
  breakEvenRatio: number | null = null;

  private modalService = inject(ModalService);

  constructor(private fb: FormBuilder) {
    
    this.breakEvenForm = this.fb.group({
      debtService: [null, [Validators.required, Validators.min(0)]],
      operatingExpenses: [null, [Validators.required, Validators.min(0)]],
      grossOperatingIncome: [null, [Validators.required, Validators.min(0.01)]],
    });
  }
   openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
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
