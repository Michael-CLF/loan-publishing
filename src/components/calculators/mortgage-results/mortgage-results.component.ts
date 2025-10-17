import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { MortgageResult } from '../../../models/mortgage.model';

@Component({
  selector: 'app-mortgage-results',
  templateUrl: './mortgage-results.component.html',
  styleUrls: ['./mortgage-results.component.css'],
  standalone: true,
  imports: [CommonModule], // Import CommonModule for standalone component
})
export class MortgageResultsComponent implements OnChanges {
  @Input() calculationResults!: MortgageResult;

  // For pagination of amortization schedule
  currentPage = 1;
  pageSize = 12; // Show 1 year at a time
  displayedSchedule: any[] = [];

  // For chart data
  paymentBreakdown: any[] = [];

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['calculationResults'] && this.calculationResults) {
      this.updateDisplayedSchedule();
      this.setupPaymentBreakdown();
    }
  }

  updateDisplayedSchedule(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.displayedSchedule = this.calculationResults.amortizationSchedule.slice(
      start,
      end,
    );
  }

  changePage(page: number): void {
    this.currentPage = page;
    this.updateDisplayedSchedule();
  }

  get totalPages(): number {
    return Math.ceil(
      this.calculationResults.amortizationSchedule.length / this.pageSize,
    );
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  setupPaymentBreakdown(): void {
    this.paymentBreakdown = [
      {
        name: 'Principal & Interest',
        value: this.calculationResults.principalAndInterest,
      },
      {
        name: 'Property Tax',
        value: this.calculationResults.propertyTax,
      },
      {
        name: 'Insurance',
        value: this.calculationResults.insurance,
      },
    ];
  }
}
