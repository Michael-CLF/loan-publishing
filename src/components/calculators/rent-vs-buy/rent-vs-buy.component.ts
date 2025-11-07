import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../modals/role-selection-modal/role-selection-modal.component';

@Component({
  selector: 'app-rent-vs-buy',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rent-vs-buy.component.html',
  styleUrls: ['./rent-vs-buy.component.css']
})
export class RentVsBuyComponent {
  private modalService = inject(ModalService);
  constructor(private fb: FormBuilder) { }

  form = this.fb.group({
    // Home + financing
    purchasePrice: [500000, [Validators.required, Validators.min(1)]],
    downPaymentPct: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
    rateAnnualPct: [6.75, [Validators.required, Validators.min(0)]],
    termYears: [30, [Validators.required, Validators.min(1), Validators.max(40)]],
    closingCosts: [8000, [Validators.min(0)]],
    pmiAnnualPct: [0.6, [Validators.min(0)]],           // if DP < 20%, as % of loan
    hoaMonthly: [0, [Validators.min(0)]],

    // Ownership carrying costs (year 1)
    propTaxRatePct: [1.2, [Validators.min(0)]],         // % of price per year
    insuranceAnnual: [1500, [Validators.min(0)]],
    maintenancePctOfPrice: [1.0, [Validators.min(0)]],  // % of price per year

    // Growth + horizon
    homeAppreciationPct: [3.0, [Validators.min(0)]],    // annual
    expenseGrowthPct: [3.0, [Validators.min(0)]],       // annual for taxes/maint/ins/HOA
    sellingCostsPct: [6.0, [Validators.min(0)]],        // broker + transfer etc.
    holdYears: [7, [Validators.required, Validators.min(1), Validators.max(40)]],

    // Renting
    rentMonthly: [2500, [Validators.required, Validators.min(0)]],
    rentGrowthPct: [3.0, [Validators.min(0)]],

    // Discount / opportunity cost
    discountRatePct: [5.0, [Validators.min(0)]],        // for NPV and foregone return
  });

  openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}


  // ---- helpers ----
  private pmt(rateM: number, n: number, pv: number): number {
    if (n <= 0) return 0;
    if (rateM === 0) return pv / n;
    return (rateM * pv) / (1 - Math.pow(1 + rateM, -n));
  }

  private remainingBalance(rateM: number, n: number, pv: number, kPaid: number): number {
    if (rateM === 0) return Math.max(0, pv - (pv / n) * kPaid);
    const pmt = this.pmt(rateM, n, pv);
    // Balance after k payments:
    return pv * Math.pow(1 + rateM, kPaid) - pmt * ((Math.pow(1 + rateM, kPaid) - 1) / rateM);
  }

  // ---- derived inputs ----
  price = computed(() => Number(this.form.value.purchasePrice || 0));
  downPct = computed(() => Number(this.form.value.downPaymentPct || 0) / 100);
  loanAmount = computed(() => this.price() * (1 - this.downPct()));
  rateM = computed(() => Number(this.form.value.rateAnnualPct || 0) / 100 / 12);
  nMonths = computed(() => Number(this.form.value.termYears || 0) * 12);
  holdMonths = computed(() => Math.min(this.nMonths(), Math.round(Number(this.form.value.holdYears || 0) * 12)));

  // payments
  monthlyPI = computed(() => this.pmt(this.rateM(), this.nMonths(), this.loanAmount()));
  pmiMonthly = computed(() => {
    const dp = this.downPct();
    if (dp >= 0.20) return 0;
    const pct = Number(this.form.value.pmiAnnualPct || 0) / 100;
    return this.loanAmount() * pct / 12;
  });

  // year-1 owner costs (monthly)
  taxMonthlyY1 = computed(() => this.price() * (Number(this.form.value.propTaxRatePct || 0) / 100) / 12);
  insMonthlyY1 = computed(() => Number(this.form.value.insuranceAnnual || 0) / 12);
  maintMonthlyY1 = computed(() => this.price() * (Number(this.form.value.maintenancePctOfPrice || 0) / 100) / 12);
  hoaMonthly = computed(() => Number(this.form.value.hoaMonthly || 0));

  // growth rates (monthly)
  gHomeM = computed(() => Number(this.form.value.homeAppreciationPct || 0) / 100 / 12);
  gExpM = computed(() => Number(this.form.value.expenseGrowthPct || 0) / 100 / 12);
  gRentM = computed(() => Number(this.form.value.rentGrowthPct || 0) / 100 / 12);
  rDiscM = computed(() => Number(this.form.value.discountRatePct || 0) / 100 / 12);

  // upfront cash and its opportunity cost (foregone return)
  upfrontCash = computed(() => {
    const down = this.price() * this.downPct();
    const close = Number(this.form.value.closingCosts || 0);
    return down + close;
  });

  // cum discounted cost streams
  npvOwn = computed(() => {
    const N = this.holdMonths();
    const r = this.rateM();
    const disc = this.rDiscM();
    const nTot = this.nMonths();

    let npv = this.upfrontCash(); // at t0
    let taxes = this.taxMonthlyY1();
    let ins = this.insMonthlyY1();
    let maint = this.maintMonthlyY1();
    let hoa = this.hoaMonthly();
    const pmi0 = this.pmiMonthly();

    for (let t = 1; t <= N; t++) {
      // grow expenses monthly
      if (t > 1) {
        taxes *= (1 + this.gExpM());
        ins *= (1 + this.gExpM());
        maint *= (1 + this.gExpM());
        hoa *= (1 + this.gExpM());
      }
      const pmi = pmi0; // simple: constant while DP<20%; refinements possible
      const cashOut = this.monthlyPI() + taxes + ins + maint + hoa + pmi;

      npv += cashOut / Math.pow(1 + disc, t);
    }

    // Sale at end of month N: proceeds reduce cost
    const valueAtSale = this.price() * Math.pow(1 + this.gHomeM(), N);
    const sellCosts = valueAtSale * (Number(this.form.value.sellingCostsPct || 0) / 100);
    const remBal = this.remainingBalance(this.rateM(), nTot, this.loanAmount(), N);
    const netProceeds = Math.max(0, valueAtSale - sellCosts - remBal);

    // subtract discounted proceeds
    npv -= netProceeds / Math.pow(1 + disc, N);

    return npv;
  });

  npvRent = computed(() => {
    const N = this.holdMonths();
    const disc = this.rDiscM();
    let rent = Number(this.form.value.rentMonthly || 0);
    let npv = 0;
    for (let t = 1; t <= N; t++) {
      if (t > 1) rent *= (1 + this.gRentM());
      npv += rent / Math.pow(1 + disc, t);
    }
    return npv;
  });

  // Result metrics
  npvDiff = computed(() => this.npvOwn() - this.npvRent()); // <0 => buying cheaper on NPV
  ownCheaper = computed(() => this.npvDiff() < 0);

  // First-year monthly snapshots (not discounted)
  ownerMonthlyYear1 = computed(() =>
    this.monthlyPI() + this.taxMonthlyY1() + this.insMonthlyY1() + this.maintMonthlyY1() + this.hoaMonthly() + this.pmiMonthly()
  );
}
