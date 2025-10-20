import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../role-selection-modal/role-selection-modal.component';

@Component({
  selector: 'app-loan-payment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './loan-payment.component.html',
  styleUrls: ['./loan-payment.component.css']
})
export class LoanPaymentComponent {
  private modalService = inject(ModalService);
  constructor(private fb: FormBuilder) {}

  openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  form = this.fb.group({
    // Target payment
    targetMonthlyPayment: [2500, [Validators.required, Validators.min(1)]],

    // Financing
    rateAnnualPct: [6.75, [Validators.required, Validators.min(0)]],
    termYears: [30, [Validators.required, Validators.min(1), Validators.max(40)]],

    // Optional non-P&I items to back out of target payment
    includeTaxesInsuranceHoa: [false],
    taxesAnnual: [0, [Validators.min(0)]],
    insuranceAnnual: [0, [Validators.min(0)]],
    hoaMonthly: [0, [Validators.min(0)]],

    // Optional purchase estimate
    downPaymentPct: [20, [Validators.min(0), Validators.max(100)]],
    closingCostsPctOfPrice: [2.0, [Validators.min(0)]], // optional cash to close estimate
  });

  private pmtToPv(rateM: number, n: number, pmt: number): number {
    if (n <= 0) return 0;
    if (rateM === 0) return pmt * n;
    return pmt * (1 - Math.pow(1 + rateM, -n)) / rateM;
  }

  rateM = computed(() => Number(this.form.value.rateAnnualPct || 0) / 100 / 12);
  n = computed(() => Number(this.form.value.termYears || 0) * 12);

  nonPImonthly = computed(() => {
    if (!this.form.value.includeTaxesInsuranceHoa) return 0;
    const taxM = Number(this.form.value.taxesAnnual || 0) / 12;
    const insM = Number(this.form.value.insuranceAnnual || 0) / 12;
    const hoaM = Number(this.form.value.hoaMonthly || 0);
    return taxM + insM + hoaM;
  });

  availableForPI = computed(() => Math.max(0, Number(this.form.value.targetMonthlyPayment || 0) - this.nonPImonthly()));
  loanAmount = computed(() => this.pmtToPv(this.rateM(), this.n(), this.availableForPI()));
  monthlyPI = computed(() => this.availableForPI());

  // Purchase estimate from down payment
  purchasePriceEstimate = computed(() => {
    const dp = Number(this.form.value.downPaymentPct || 0) / 100;
    if (dp >= 100) return 0;
    return dp >= 0 ? (this.loanAmount() / (1 - dp)) : 0;
  });

  cashToCloseEstimate = computed(() => {
    const price = this.purchasePriceEstimate();
    const dpCash = price * (Number(this.form.value.downPaymentPct || 0) / 100);
    const cc = price * (Number(this.form.value.closingCostsPctOfPrice || 0) / 100);
    return dpCash + cc;
  });
}
