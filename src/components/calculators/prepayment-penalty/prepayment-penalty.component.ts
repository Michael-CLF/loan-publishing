import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../role-selection-modal/role-selection-modal.component';

type Method = 'step_down' | 'months_interest' | 'yield_maint';

@Component({
  selector: 'app-prepayment-penalty',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './prepayment-penalty.component.html',
  styleUrls: ['./prepayment-penalty.component.css']
})
export class PrepaymentPenaltyComponent {
  private modalService = inject(ModalService);
  constructor(private fb: FormBuilder) {}

  openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  form = this.fb.group({
    method: ['step_down' as Method, [Validators.required]],

    // Common
    remainingBalance: [500000, [Validators.required, Validators.min(1)]],
    prepayAmount: [500000, [Validators.required, Validators.min(1)]], // default = full payoff
    noteRateAprPct: [8.5, [Validators.required, Validators.min(0)]],
    monthsRemaining: [24, [Validators.required, Validators.min(1)]],

    // Step-down (years as percents, comma-separated; e.g., 5,4,3,2,1)
    stepDownSchedule: ['5,4,3,2,1', [Validators.required]],

    // Months-of-interest method
    monthsOfInterest: [6, [Validators.min(0)]],

    // Yield-maintenance (approx)
    reinvestmentRateAprPct: [4.0, [Validators.min(0)]], // proxy for matching Treasury
    discountRateAdjPct: [0.0, []], // optional spread to discounting, usually 0
  });

  // Helpers
  private parseSchedule(): number[] {
    const raw = String(this.form.value.stepDownSchedule || '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map(s => Number(s.trim()))
      .filter(v => !Number.isNaN(v) && v >= 0);
  }

  private yearIndexFromMonths(): number {
    const m = Number(this.form.value.monthsRemaining || 0);
    return Math.ceil(m / 12); // 1..N
  }

  // Calculations
  penaltyStepDown = computed(() => {
    if (this.form.value.method !== 'step_down') return 0;
    const bal = Number(this.form.value.remainingBalance || 0);
    const pay = Math.min(Number(this.form.value.prepayAmount || 0), bal);
    const schedule = this.parseSchedule(); // e.g., [5,4,3,2,1]
    if (bal <= 0 || pay <= 0 || schedule.length === 0) return 0;

    const yr = this.yearIndexFromMonths(); // 1-based
    // If beyond schedule, penalty = 0
    const pct = schedule[Math.max(0, Math.min(yr, schedule.length)) - 1] || 0;
    return pay * (pct / 100);
  });

  penaltyMonthsInterest = computed(() => {
    if (this.form.value.method !== 'months_interest') return 0;
    const bal = Number(this.form.value.remainingBalance || 0);
    const pay = Math.min(Number(this.form.value.prepayAmount || 0), bal);
    const r = Number(this.form.value.noteRateAprPct || 0) / 100 / 12;
    const months = Number(this.form.value.monthsOfInterest || 0);
    if (bal <= 0 || pay <= 0 || r < 0 || months <= 0) return 0;
    // Many contracts: penalty = months * monthly interest on amount prepaid
    return pay * r * months;
  });

  penaltyYieldMaintenance = computed(() => {
    if (this.form.value.method !== 'yield_maint') return 0;
    const pay = Math.min(Number(this.form.value.prepayAmount || 0), Number(this.form.value.remainingBalance || 0));
    const noteRateM = Number(this.form.value.noteRateAprPct || 0) / 100 / 12;
    const reinvestM = Number(this.form.value.reinvestmentRateAprPct || 0) / 100 / 12;
    const discAdjM = Number(this.form.value.discountRateAdjPct || 0) / 100 / 12;
    const n = Number(this.form.value.monthsRemaining || 0);

    if (pay <= 0 || n <= 0) return 0;

    // Approximate YM: PV of the spread between note coupon and reinvestment over remaining term, on prepaid amount.
    // YM ≈ Σ_{t=1..n} [ (pay * (noteRateM - reinvestM)) / (1 + reinvestM + discAdjM)^t ]
    const spread = Math.max(0, noteRateM - reinvestM); // floors at 0
    if (spread === 0) return 0;

    const i = reinvestM + discAdjM;
    let pv = 0;
    for (let t = 1; t <= n; t++) {
      pv += (pay * spread) / Math.pow(1 + i, t);
    }
    return pv;
  });

  penaltySelected = computed(() => {
    switch (this.form.value.method as Method) {
      case 'step_down': return this.penaltyStepDown();
      case 'months_interest': return this.penaltyMonthsInterest();
      case 'yield_maint': return this.penaltyYieldMaintenance();
      default: return 0;
    }
  });

  totalPayoff = computed(() => {
    const bal = Number(this.form.value.remainingBalance || 0);
    const pay = Math.min(Number(this.form.value.prepayAmount || 0), bal);
    return pay + this.penaltySelected();
  });
}
