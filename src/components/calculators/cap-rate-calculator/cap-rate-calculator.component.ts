// cap-rate.component.ts
import { Component, LOCALE_ID, Inject, ViewChild, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../role-selection-modal/role-selection-modal.component';

@Component({
  selector: 'app-cap-rate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './cap-rate-calculator.component.html',
  styleUrls: ['./cap-rate-calculator.component.css'],
})
export class CapRateCalculatorComponent {
   @ViewChild(RoleSelectionModalComponent)
   roleModal!: RoleSelectionModalComponent;
  capRateForm: FormGroup;
  result: number | null = null;
  private modalService = inject(ModalService);


  constructor(private fb: FormBuilder) {
    this.capRateForm = this.fb.group({
      noi: [null, [Validators.required, Validators.min(0)]],
      propertyValue: [null, [Validators.required, Validators.min(1)]],
    });
  }
   openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  calculateCapRate(): void {
    if (this.capRateForm.valid) {
      const noi = this.capRateForm.get('noi')?.value;
      const propertyValue = this.capRateForm.get('propertyValue')?.value;

      if (noi !== null && propertyValue !== null && propertyValue > 0) {
        this.result = (noi / propertyValue) * 100;
      }
    }
  }

  resetForm(): void {
    this.capRateForm.reset();
    this.result = null;
  }

  get formControls() {
    return this.capRateForm.controls;
  }
}
