import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

type MonthRow = {
  month: number;
  draw: number;
  balance: number;
  interest: number;
  cumInterest: number;
};

@Component({
  selector: 'app-construction-loan-draw',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './construction-loan-draw.component.html',
  styleUrls: ['./construction-loan-draw.component.css']
})
export class ConstructionLoanDrawComponent {
  constructor(private fb: FormBuilder) {}

  form = this.fb.group({
    totalCommitment: [750000, [Validators.required, Validators.min(1)]],
    rateAnnualPct: [10, [Validators.required, Validators.min(0)]],
    termMonths: [12, [Validators.required, Validators.min(1), Validators.max(36)]],

    // fees / reserves
    originationPointsPct: [2, [Validators.min(0)]],
    otherFees: [3000, [Validators.min(0)]],
    interestReserve: [0, [Validators.min(0)]], // optional fixed reserve at close

    // draws
    draws: this.fb.array([
      this.fb.group({ month: [1, [Validators.required, Validators.min(1)]], amount: [250000, [Validators.required, Validators.min(0)]] }),
      this.fb.group({ month: [4, [Validators.required, Validators.min(1)]], amount: [250000, [Validators.required, Validators.min(0)]] }),
      this.fb.group({ month: [7, [Validators.required, Validators.min(1)]], amount: [250000, [Validators.required, Validators.min(0)]] })
    ])
  });

  get drawsFA(): FormArray {
    return this.form.get('draws') as FormArray;
  }

  addDraw(): void {
    this.drawsFA.push(this.fb.group({ month: [1, [Validators.required, Validators.min(1)]], amount: [0, [Validators.required, Validators.min(0)]] }));
  }
  removeDraw(i: number): void {
    this.drawsFA.removeAt(i);
  }

  // computed figures
  monthlyRate = computed(() => Number(this.form.value.rateAnnualPct || 0) / 100 / 12);

  pointsCost = computed(() => {
    const L = Number(this.form.value.totalCommitment || 0);
    return L * (Number(this.form.value.originationPointsPct || 0) / 100);
  });

  schedule = signal<MonthRow[]>([]);
  totalInterest = signal(0);
  totalDrawn = signal(0);
  netProceedsAtClose = computed(() => {
    const points = this.pointsCost();
    const other = Number(this.form.value.otherFees || 0);
    const reserve = Number(this.form.value.interestReserve || 0);
    return Number(this.form.value.totalCommitment || 0) - (points + other + reserve);
  });

  // Summary at maturity assuming IO during construction and payoff of principal at Month term
  payoffAtMaturity = computed(() => {
    const L = Math.min(this.totalDrawn(), Number(this.form.value.totalCommitment || 0));
    return L; // principal due; exit fees not modeled here
  });

  calculate(): void {
    if (this.form.invalid) return;

    const term = Number(this.form.value.termMonths || 0);
    const r = this.monthlyRate();
    const Lmax = Number(this.form.value.totalCommitment || 0);

    // normalize draws by month and cap by commitment
    const draws = [...(this.form.value.draws || [])]
      .map(d => ({ month: Number((d as any).month), amount: Number((d as any).amount) }))
      .filter(d => d.month >= 1 && d.amount > 0)
      .sort((a, b) => a.month - b.month);

    const rows: MonthRow[] = [];
    let bal = 0;
    let cumInt = 0;
    let cumDrawn = 0;

    for (let m = 1; m <= term; m++) {
      // sum of draws scheduled for this month
      const drawThisMonth = draws.filter(d => d.month === m).reduce((s, d) => s + d.amount, 0);
      // fund draw at start of month (most lenders accrue interest for the full month on that draw)
      bal = Math.min(Lmax, bal + drawThisMonth);
      cumDrawn = Math.min(Lmax, cumDrawn + drawThisMonth);

      const interest = bal * r; // interest-only during construction
      cumInt += interest;

      rows.push({ month: m, draw: drawThisMonth, balance: bal, interest, cumInterest: cumInt });
    }

    this.totalInterest.set(cumInt);
    this.totalDrawn.set(cumDrawn);
    this.schedule.set(rows);
  }

  reset(): void {
    this.schedule.set([]);
    this.totalInterest.set(0);
    this.totalDrawn.set(0);
  }

  downloadCSV(): void {
    if (this.schedule().length === 0) return;
    const header = 'Month,Draw,Balance,Interest,Cumulative Interest';
    const lines = this.schedule().map(r =>
      [r.month, r.draw.toFixed(2), r.balance.toFixed(2), r.interest.toFixed(2), r.cumInterest.toFixed(2)].join(',')
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'construction_draw_schedule.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
