import { Injectable } from '@angular/core';
import {
  MortgageInput,
  MortgageResult,
  AmortizationEntry,
} from '../models/mortgage.model';

@Injectable({
  providedIn: 'root',
})
export class MortgageService {
  constructor() {}

  calculateMortgage(input: MortgageInput): MortgageResult {
    // Convert annual interest rate to monthly decimal rate
    const monthlyInterestRate = input.interestRate / 100 / 12;

    // Convert loan term to months
    const loanTermMonths = input.loanTerm * 12;

    // Calculate monthly principal and interest payment using the formula:
    // P = L[c(1 + c)^n]/[(1 + c)^n - 1]
    // Where P = payment, L = loan amount, c = monthly interest rate, n = number of payments
    let monthlyPayment: number;

    if (monthlyInterestRate === 0) {
      // If interest rate is 0, simply divide loan by term
      monthlyPayment = input.loanAmount / loanTermMonths;
    } else {
      const numerator =
        monthlyInterestRate * Math.pow(1 + monthlyInterestRate, loanTermMonths);
      const denominator = Math.pow(1 + monthlyInterestRate, loanTermMonths) - 1;
      monthlyPayment = input.loanAmount * (numerator / denominator);
    }

    // Calculate monthly property tax and insurance
    const monthlyPropertyTax = input.propertyTax / 12;
    const monthlyInsurance = input.insurance / 12;

    // Total monthly payment including tax and insurance
    const totalMonthlyPayment =
      monthlyPayment + monthlyPropertyTax + monthlyInsurance;

    // Generate amortization schedule
    const amortizationSchedule = this.generateAmortizationSchedule(
      input.loanAmount,
      monthlyInterestRate,
      monthlyPayment,
      loanTermMonths,
    );

    return {
      principalAndInterest: monthlyPayment,
      propertyTax: monthlyPropertyTax,
      insurance: monthlyInsurance,
      totalMonthlyPayment,
      totalInterestPaid: this.calculateTotalInterest(amortizationSchedule),
      totalPaid: totalMonthlyPayment * loanTermMonths,
      amortizationSchedule,
    };
  }

  private generateAmortizationSchedule(
    loanAmount: number,
    monthlyInterestRate: number,
    monthlyPayment: number,
    loanTermMonths: number,
  ): AmortizationEntry[] {
    const schedule: AmortizationEntry[] = [];
    let remainingBalance = loanAmount;
    let totalInterestPaid = 0;

    for (let month = 1; month <= loanTermMonths; month++) {
      // Calculate interest for this month
      const interestPayment = remainingBalance * monthlyInterestRate;

      // Calculate principal for this month
      const principalPayment = monthlyPayment - interestPayment;

      // Update remaining balance
      remainingBalance -= principalPayment;

      // Update total interest
      totalInterestPaid += interestPayment;

      // Ensure we don't have negative remaining balance at the end due to rounding
      if (month === loanTermMonths) {
        if (Math.abs(remainingBalance) < 0.01) {
          remainingBalance = 0;
        }
      }

      // Add entry to schedule
      schedule.push({
        month,
        principalPayment,
        interestPayment,
        totalPayment: principalPayment + interestPayment,
        remainingBalance: Math.max(0, remainingBalance), // Ensure we don't go below 0
        totalInterestPaid,
      });
    }

    return schedule;
  }

  private calculateTotalInterest(
    amortizationSchedule: AmortizationEntry[],
  ): number {
    if (amortizationSchedule.length === 0) {
      return 0;
    }

    // The total interest paid will be the last entry's totalInterestPaid
    return amortizationSchedule[amortizationSchedule.length - 1]
      .totalInterestPaid;
  }
}
