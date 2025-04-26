// loan-success-modal.component.ts
import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-loan-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loan-success-modal.component.html',
  styleUrls: ['./loan-success-modal.component.css'],
})
export class LoanSuccessModalComponent implements OnDestroy {
  private router = inject(Router);
  countdown = 7; // 7 seconds before auto-redirect
  private timer: any;

  constructor() {
    this.startCountdown();
  }

  startCountdown(): void {
    this.timer = setInterval(() => {
      this.countdown--;

      if (this.countdown <= 0) {
        clearInterval(this.timer);
        this.navigateToDashboard();
      }
    }, 1000);
  }

  navigateToDashboard(): void {
    clearInterval(this.timer);
    this.router.navigate(['/dashboard']);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
