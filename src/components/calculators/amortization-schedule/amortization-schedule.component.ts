import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { RoleSelectionModalComponent } from '../../../role-selection-modal/role-selection-modal.component';

type AmortRow = {
  period: number;
  date?: string;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

@Component({
  selector: 'app-amortization-schedule',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './amortization-schedule.component.html',
  styleUrls: ['./amortization-schedule.component.css']
})
export class AmortizationScheduleComponent {
  private modalService = inject(ModalService);

  constructor(private fb: FormBuilder) {}

  form = this.fb.group({
    loanAmount: [300000, [Validators.required, Validators.min(1)]],
    rateAnnualPct: [6.99, [Validators.required, Validators.min(0)]],
    termYears: [30, [Validators.required, Validators.min(1), Validators.max(40)]],
    startDate: [new Date().toISOString().slice(0, 10)], // YYYY-MM-DD
    includeDates: [true]
  });

  openRoleSelectionModal(): void {
  this.modalService.openRoleSelectionModal();
}

  // Signals for results
  schedule = signal<AmortRow[]>([]);
  monthlyPayment = signal<number>(0);
  totalInterest = signal<number>(0);
  totalPaid = computed(() => this.totalInterest() + (this.form.value.loanAmount ?? 0));

  calculate(): void {
    if (this.form.invalid) return;

    const P = Number(this.form.value.loanAmount);
    const r = Number(this.form.value.rateAnnualPct) / 100 / 12; // monthly rate
    const n = Number(this.form.value.termYears) * 12;

    // Handle zero-rate edge case
    const payment = r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n));
    this.monthlyPayment.set(payment);

    const rows: AmortRow[] = [];
    let balance = P;
    let cursor = this.form.value.startDate ? new Date(this.form.value.startDate) : new Date();

    for (let k = 1; k <= n; k++) {
      const interest = r === 0 ? 0 : balance * r;
      const principal = Math.min(payment - interest, balance);
      balance = Math.max(0, balance - principal);

      const row: AmortRow = {
        period: k,
        date: this.form.value.includeDates ? this.formatDate(cursor) : undefined,
        payment,
        interest,
        principal,
        balance
      };
      rows.push(row);

      // advance one month
      if (this.form.value.includeDates && cursor) {
        const next = new Date(cursor);
        next.setMonth(next.getMonth() + 1);
        cursor = next;
      }
    }

    const ti = rows.reduce((s, r) => s + r.interest, 0);
    this.totalInterest.set(ti);
    this.schedule.set(rows);
  }

  reset(): void {
    this.schedule.set([]);
    this.monthlyPayment.set(0);
    this.totalInterest.set(0);
  }

  downloadCSV(): void {
    if (this.schedule().length === 0) return;

    const header = this.form.value.includeDates
      ? 'Period,Date,Payment,Interest,Principal,Balance'
      : 'Period,Payment,Interest,Principal,Balance';

    const lines = this.schedule().map(r => {
      const cols = [
        r.period,
        ...(this.form.value.includeDates ? [r.date ?? ''] : []),
        r.payment.toFixed(2),
        r.interest.toFixed(2),
        r.principal.toFixed(2),
        r.balance.toFixed(2)
      ];
      return cols.join(',');
    });

    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amortization_schedule.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  private formatDate(d: Date): string {
    // YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
