import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../role-selection-modal/role-selection-modal.component';

@Component({
  selector: 'app-cash-on-cash',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cash-on-cash.component.html',
  styleUrls: ['./cash-on-cash.component.css']
})
export class CashOnCashComponent {
  private modalService = inject(ModalService);
  constructor(private fb: FormBuilder) {}

  openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  form = this.fb.group({
    // Purchase & financing
    purchasePrice: [400000, [Validators.required, Validators.min(1)]],
    downPaymentPct: [25, [Validators.required, Validators.min(0), Validators.max(100)]],
    rateAnnualPct: [8.5, [Validators.required, Validators.min(0)]],
    termYears: [30, [Validators.required, Validators.min(1), Validators.max(40)]],
    interestOnly: [false],
    originationPointsPct: [2, [Validators.min(0)]],
    closingCosts: [6000, [Validators.min(0)]],
    rehabCosts: [0, [Validators.min(0)]],
    reserveMonths: [0, [Validators.min(0), Validators.max(24)]],

    // Income (monthly)
    rentMonthly: [3500, [Validators.min(0)]],
    otherIncomeMonthly: [0, [Validators.min(0)]],
    vacancyPct: [5, [Validators.min(0), Validators.max(100)]],

    // Expenses
    taxesAnnual: [4800, [Validators.min(0)]],
    insuranceAnnual: [1800, [Validators.min(0)]],
    hoaMonthly: [0, [Validators.min(0)]],
    utilitiesMonthly: [0, [Validators.min(0)]],
    repairsPctEGI: [5, [Validators.min(0), Validators.max(100)]],      // % of Effective Gross Income
    managementPctEGI: [8, [Validators.min(0), Validators.max(100)]],   // % of EGI
  });

  // Derivatives
  loanAmount = computed(() => {
    const pp = Number(this.form.value.purchasePrice || 0);
    const dp = Number(this.form.value.downPaymentPct || 0) / 100;
    return Math.max(0, pp * (1 - dp));
  });

  effectiveGrossIncomeMonthly = computed(() => {
    const rent = Number(this.form.value.rentMonthly || 0);
    const other = Number(this.form.value.otherIncomeMonthly || 0);
    const vac = Number(this.form.value.vacancyPct || 0) / 100;
    const gross = rent + other;
    return gross * (1 - vac);
  });

  operatingExpensesMonthly = computed(() => {
    const taxes = Number(this.form.value.taxesAnnual || 0) / 12;
    const ins = Number(this.form.value.insuranceAnnual || 0) / 12;
    const hoa = Number(this.form.value.hoaMonthly || 0);
    const utilities = Number(this.form.value.utilitiesMonthly || 0);
    const egi = this.effectiveGrossIncomeMonthly();
    const repairs = egi * (Number(this.form.value.repairsPctEGI || 0) / 100);
    const mgmt = egi * (Number(this.form.value.managementPctEGI || 0) / 100);
    return taxes + ins + hoa + utilities + repairs + mgmt;
  });

  noiAnnual = computed(() => {
    const egiM = this.effectiveGrossIncomeMonthly();
    const opexM = this.operatingExpensesMonthly();
    return (egiM - opexM) * 12;
  });

  debtServiceMonthly = computed(() => {
    const L = this.loanAmount();
    const r = Number(this.form.value.rateAnnualPct || 0) / 100 / 12;
    const n = Number(this.form.value.termYears || 0) * 12;
    const io = !!this.form.value.interestOnly;
    if (L <= 0) return 0;
    if (io) return L * r;
    if (r === 0) return L / n;
    const pvif = Math.pow(1 + r, n);
    return (r / (1 - Math.pow(1 + r, -n))) * L; // positive monthly payment
  });

  debtServiceAnnual = computed(() => this.debtServiceMonthly() * 12);

  pointsCost = computed(() => this.loanAmount() * (Number(this.form.value.originationPointsPct || 0) / 100));

  cashInvested = computed(() => {
    const pp = Number(this.form.value.purchasePrice || 0);
    const down = pp - this.loanAmount();
    const closing = Number(this.form.value.closingCosts || 0);
    const rehab = Number(this.form.value.rehabCosts || 0);
    const points = this.pointsCost();
    const reserves = this.debtServiceMonthly() * Number(this.form.value.reserveMonths || 0);
    return down + closing + rehab + points + reserves;
  });

  btcAnnual = computed(() => Math.max(0, this.noiAnnual() - this.debtServiceAnnual()));

  cashOnCashPct = computed(() => {
    const invested = this.cashInvested();
    if (invested <= 0) return 0;
    return (this.btcAnnual() / invested) * 100;
  });

  dscr = computed(() => {
    const ads = this.debtServiceAnnual();
    if (ads === 0) return 0;
    return this.noiAnnual() / ads;
  });
}
