import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../modals/role-selection-modal/role-selection-modal.component';

@Component({
  selector: 'app-bridge-loan',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './bridge-loan.component.html',
  styleUrls: ['./bridge-loan.component.css']
})
export class BridgeLoanComponent {
  private modalService = inject(ModalService);
  constructor(private fb: FormBuilder) {}

  openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  form = this.fb.group({
    loanAmount: [500000, [Validators.required, Validators.min(1)]],
    rateAnnualPct: [10, [Validators.required, Validators.min(0)]],
    termMonths: [12, [Validators.required, Validators.min(1), Validators.max(60)]],
    interestOnly: [true],
    originationPointsPct: [2, [Validators.min(0)]],       // percent of loan amount
    brokerPointsPct: [0, [Validators.min(0)]],            // optional
    exitFeePct: [1, [Validators.min(0)]],                 // percent of loan amount at payoff
    otherFixedFees: [2500, [Validators.min(0)]],          // appraisal/underwriting/closing lump sum
    prepaidInterestMonths: [0, [Validators.min(0)]],      // interest reserve months
  });

  // results
  monthlyInterest = signal<number>(0);
  totalInterest = signal<number>(0);
  pointsCost = signal<number>(0);
  brokerCost = signal<number>(0);
  exitFee = signal<number>(0);
  otherFees = signal<number>(0);
  reserveAmount = signal<number>(0);
  totalFees = signal<number>(0);
  totalCost = signal<number>(0);
  effectiveAPR = signal<number>(0); // annualized cost as %
  netProceeds = signal<number>(0);  // funds disbursed to borrower at close
  payoffAtExit = signal<number>(0); // principal + exit fee (IO assumes interest paid monthly or via reserve)

  calculate(): void {
    if (this.form.invalid) return;

    const L = Number(this.form.value.loanAmount);
    const aprPct = Number(this.form.value.rateAnnualPct);
    const m = Number(this.form.value.termMonths);
    const r = aprPct / 100 / 12;

    const monthly = Number(this.form.value.interestOnly) ? L * r : this.pmt(r, m, L) * -1;
    const totalInt = monthly * m;

    const points = L * (Number(this.form.value.originationPointsPct) / 100);
    const broker = L * (Number(this.form.value.brokerPointsPct) / 100);
    const exit = L * (Number(this.form.value.exitFeePct) / 100);
    const other = Number(this.form.value.otherFixedFees) || 0;

    const reserveMonths = Number(this.form.value.prepaidInterestMonths) || 0;
    const reserve = monthly * Math.min(reserveMonths, m);

    const fees = points + broker + exit + other + reserve;
    const total = totalInt + points + broker + exit + other; // reserve is just prepay of interest, not extra cost
    const effApr = total / L / (m / 12) * 100;

    const proceeds = L - (points + broker + other + reserve);
    const payoff = L + exit; // assuming interest paid monthly or via reserve

    this.monthlyInterest.set(monthly);
    this.totalInterest.set(totalInt);
    this.pointsCost.set(points);
    this.brokerCost.set(broker);
    this.exitFee.set(exit);
    this.otherFees.set(other);
    this.reserveAmount.set(reserve);
    this.totalFees.set(fees);
    this.totalCost.set(total);
    this.effectiveAPR.set(effApr);
    this.netProceeds.set(proceeds);
    this.payoffAtExit.set(payoff);
  }

  reset(): void {
    this.monthlyInterest.set(0);
    this.totalInterest.set(0);
    this.pointsCost.set(0);
    this.brokerCost.set(0);
    this.exitFee.set(0);
    this.otherFees.set(0);
    this.reserveAmount.set(0);
    this.totalFees.set(0);
    this.totalCost.set(0);
    this.effectiveAPR.set(0);
    this.netProceeds.set(0);
    this.payoffAtExit.set(0);
  }

  private pmt(rate: number, nper: number, pv: number, fv = 0, type = 0): number {
    // Monthly payment for fully-amortizing case (rare for bridge, but supported)
    if (rate === 0) return -(pv + fv) / nper;
    const pvif = Math.pow(1 + rate, nper);
    let pmt = rate / (pvif - 1) * -(pv * pvif + fv);
    if (type === 1) pmt /= (1 + rate);
    return pmt;
  }
}
