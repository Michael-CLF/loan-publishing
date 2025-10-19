import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-refinance-savings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './refinance-savings.component.html',
  styleUrls: ['./refinance-savings.component.css']
})
export class RefinanceSavingsComponent {
  constructor(private fb: FormBuilder) {}

  form = this.fb.group({
    // Current loan
    currentBalance: [300000, [Validators.required, Validators.min(1)]],
    currentRateAprPct: [6.875, [Validators.required, Validators.min(0)]],
    monthsRemaining: [300, [Validators.required, Validators.min(1), Validators.max(480)]],
    currentMonthlyPmtOverride: [null as number | null, [Validators.min(0)]], // optional

    // New loan
    newRateAprPct: [5.75, [Validators.required, Validators.min(0)]],
    newTermYears: [30, [Validators.required, Validators.min(1), Validators.max(40)]],
    pointsPct: [0.0, [Validators.min(0)]],          // % of base principal (current balance)
    closingCosts: [4500, [Validators.min(0)]],
    financeCosts: [true],                            // roll points+costs into loan?
    prepayHorizonMonths: [84, [Validators.min(1)]],  // user horizon for savings calc

    // Extra comparisons
    makeExtraMonthly: [0, [Validators.min(0)]],      // extra principal on NEW loan
  });

  // --- Helpers ---
  private pmt(rateM: number, nper: number, pv: number): number {
    if (nper <= 0) return 0;
    if (rateM === 0) return pv / nper;
    return (rateM * pv) / (1 - Math.pow(1 + rateM, -nper));
  }

  // Current loan metrics (recreate payment if not supplied)
  currRateM = computed(() => Number(this.form.value.currentRateAprPct || 0) / 100 / 12);
  currN = computed(() => Number(this.form.value.monthsRemaining || 0));
  currBalance = computed(() => Number(this.form.value.currentBalance || 0));

  currMonthly = computed(() => {
    const override = this.form.value.currentMonthlyPmtOverride;
    if (override !== null && override !== undefined && override > 0) return Number(override);
    return this.pmt(this.currRateM(), this.currN(), this.currBalance());
  });

  currTotalPaidRemaining = computed(() => this.currMonthly() * this.currN());
  currInterestRemaining = computed(() => this.currTotalPaidRemaining() - this.currBalance());

  // New loan setup
  newRateM = computed(() => Number(this.form.value.newRateAprPct || 0) / 100 / 12);
  newN = computed(() => Number(this.form.value.newTermYears || 0) * 12);

  pointsCost = computed(() => this.currBalance() * (Number(this.form.value.pointsPct || 0) / 100));
  upFrontCosts = computed(() => this.pointsCost() + Number(this.form.value.closingCosts || 0));

  financedPrincipal = computed(() => {
    const base = this.currBalance();
    const costs = this.upFrontCosts();
    return !!this.form.value.financeCosts ? base + costs : base;
  });

  newMonthlyBase = computed(() => this.pmt(this.newRateM(), this.newN(), this.financedPrincipal()));
  newMonthly = computed(() => this.newMonthlyBase() + Number(this.form.value.makeExtraMonthly || 0));

  // Totals
  newTotalPaidFullTerm = computed(() => this.newMonthlyBase() * this.newN()); // exclude extra prepay for apples-to-apples
  newInterestFullTerm = computed(() => this.newTotalPaidFullTerm() - this.financedPrincipal());

  monthlySavings = computed(() => Math.max(0, this.currMonthly() - this.newMonthlyBase()));
  cashToClose = computed(() => (!!this.form.value.financeCosts ? 0 : this.upFrontCosts()));

  breakEvenMonthsCostsOnly = computed(() => {
    const save = this.monthlySavings();
    if (save <= 0) return Infinity;
    return this.upFrontCosts() / save;
  });

  // Horizon-based savings (includes effect of financing costs in principal if chosen)
  horizonN = computed(() => Number(this.form.value.prepayHorizonMonths || 0));

  // cumulative paid over horizon (current vs new). New uses base payment; extra payments are not counted in savings figure.
  paidCurrentHorizon = computed(() => {
    const n = Math.min(this.currN(), this.horizonN());
    return this.currMonthly() * n;
  });

  paidNewHorizon = computed(() => {
    const n = Math.min(this.newN(), this.horizonN());
    const financed = this.form.value.financeCosts ? this.upFrontCosts() : 0; // if financed, capture as principal financed; effect shows in payment already
    // If costs are paid in cash, include cash-to-close on day 0 for fair comparison.
    const upfrontCash = this.form.value.financeCosts ? 0 : this.upFrontCosts();
    return this.newMonthlyBase() * n + upfrontCash;
  });

  isFiniteBreakEven(): boolean {
  return isFinite(this.breakEvenMonthsCostsOnly());
}

  horizonSavings = computed(() => this.paidCurrentHorizon() - this.paidNewHorizon());

  // Effective APR for the new loan including costs (simple CF: costs at t0 if not financed)
  effectiveAprPct = computed(() => {
    // Simple approximation: add non-financed costs to principal to compute an “all-in” rate proxy.
    const rateM = this.newRateM();
    if (rateM <= 0) return Number(this.form.value.newRateAprPct || 0);
    const n = this.newN();
    const financed = this.financedPrincipal();
    const pmt = this.newMonthlyBase();
    // If costs not financed, approximate by adding them to principal for APR proxy
    const principalForAPR = this.form.value.financeCosts ? financed : financed + this.upFrontCosts();
    if (principalForAPR <= 0 || n <= 0) return 0;
    // Solve for rate would require iteration; provide proxy:
    const totalPaid = pmt * n;
    const totalInterestLike = totalPaid - principalForAPR;
    const years = n / 12;
    const apr = (totalInterestLike / principalForAPR) / years * 100;
    return Math.max(0, apr);
  });
}
