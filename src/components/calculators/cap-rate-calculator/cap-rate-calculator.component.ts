// cap-rate.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';

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
  capRateForm: FormGroup;
  result: number | null = null;

  constructor(private fb: FormBuilder) {
    this.capRateForm = this.fb.group({
      noi: [null, [Validators.required, Validators.min(0)]],
      propertyValue: [null, [Validators.required, Validators.min(1)]],
    });
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
