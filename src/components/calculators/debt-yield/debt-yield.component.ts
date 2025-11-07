import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../modals/role-selection-modal/role-selection-modal.component';

@Component({
  selector: 'app-debt-yield',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './debt-yield.component.html',
  styleUrls: ['./debt-yield.component.css']
})
export class DebtYieldComponent {
  private modalService = inject(ModalService);
  constructor(private fb: FormBuilder) {}

  openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  // --- FORM (keep everything INSIDE this fb.group({...})) ---
  form = this.fb.group({
    // Core DY inputs
    noiAnnual: [150000, [Validators.required, Validators.min(0)]],
    loanAmount: [1500000, [Validators.required, Validators.min(1)]],
    targetDebtYieldPct: [10, [Validators.required, Validators.min(0.01)]],

    // Optional DS/constant insight
    rateAnnualPct: [7.5, [Validators.required, Validators.min(0)]],
    termYears: [30, [Validators.required, Validators.min(1), Validators.max(40)]],
    interestOnly: [false],

    // Toggle: compute NOI from income/expenses below
    calcNoiFromInputs: [false],

    // Income (monthly) when calcNoiFromInputs = true
    rentMonthly: [15000, [Validators.min(0)]],
    otherIncomeMonthly: [0, [Validators.min(0)]],
    vacancyPct: [5, [Validators.min(0), Validators.max(100)]],

    // Expenses (when calcNoiFromInputs = true)
    taxesAnnual: [36000, [Validators.min(0)]],
    insuranceAnnual: [12000, [Validators.min(0)]],
    repairsPctEGI: [5, [Validators.min(0), Validators.max(100)]],
    managementPctEGI: [4, [Validators.min(0), Validators.max(100)]],
    utilitiesMonthly: [0, [Validators.min(0)]],
    hoaMonthly: [0, [Validators.min(0)]],
  });
  // --- END FORM ---

  // Helpers for computed NOI from inputs
  private egiMonthly = computed(() => {
    const rent = Number(this.form.value.rentMonthly || 0);
    const other = Number(this.form.value.otherIncomeMonthly || 0);
    const vac = Number(this.form.value.vacancyPct || 0) / 100;
    return (rent + other) * (1 - vac);
  });

  private opexMonthly = computed(() => {
    const taxesM = Number(this.form.value.taxesAnnual || 0) / 12;
    const insM = Number(this.form.value.insuranceAnnual || 0) / 12;
    const utils = Number(this.form.value.utilitiesMonthly || 0);
    const hoa = Number(this.form.value.hoaMonthly || 0);
    const egi = this.egiMonthly();
    const repairs = egi * (Number(this.form.value.repairsPctEGI || 0) / 100);
    const mgmt = egi * (Number(this.form.value.managementPctEGI || 0) / 100);
    return taxesM + insM + utils + hoa + repairs + mgmt;
  });

  noiAnnualComputed(): number {
    if (!!this.form.value.calcNoiFromInputs) {
      return Math.max(0, (this.egiMonthly() - this.opexMonthly()) * 12);
    }
    return Number(this.form.value.noiAnnual || 0);
  }

  // Debt Yield
  debtYieldPct = computed(() => {
    const loan = Number(this.form.value.loanAmount || 0);
    if (loan <= 0) return 0;
    return (this.noiAnnualComputed() / loan) * 100;
  });

  // Max loan that meets target DY
  maxLoanByTarget = computed(() => {
    const tgt = Number(this.form.value.targetDebtYieldPct || 0) / 100;
    if (tgt <= 0) return 0;
    return this.noiAnnualComputed() / tgt;
  });

  // NOI needed for current loan at target DY
  requiredNOIForTarget = computed(() => {
    const loan = Number(this.form.value.loanAmount || 0);
    const tgt = Number(this.form.value.targetDebtYieldPct || 0) / 100;
    return loan * tgt;
  });

  // Loan constant and DSCR (context only)
  monthlyRate = computed(() => Number(this.form.value.rateAnnualPct || 0) / 100 / 12);
  loanConstantAnnual = computed(() => {
    const L = Number(this.form.value.loanAmount || 0);
    const r = this.monthlyRate();
    const n = Number(this.form.value.termYears || 0) * 12;
    const io = !!this.form.value.interestOnly;

    if (L <= 0) return 0;
    if (io) return Number(this.form.value.rateAnnualPct || 0) / 100;

    if (r === 0) return (L / n) * 12 / L;
    const mPmt = (r / (1 - Math.pow(1 + r, -n))) * L;
    return (mPmt * 12) / L;
  });

  annualDebtService = computed(() => {
    const L = Number(this.form.value.loanAmount || 0);
    return L * this.loanConstantAnnual();
  });

  dscr = computed(() => {
    const ads = this.annualDebtService();
    if (ads === 0) return 0;
    return this.noiAnnualComputed() / ads;
  });
}
