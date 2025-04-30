// loan-success-modal.component.ts
import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EventEmitter, Output } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '@angular/fire/auth';

filter((user: User | null) => !!user);

@Component({
  selector: 'app-loan-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loan-success-modal.component.html',
  styleUrls: ['./loan-success-modal.component.css'],
})
export class LoanSuccessModalComponent implements OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  countdown = 7; // 7 seconds before auto-redirect
  private timer: any;

  @Output() modalClosed = new EventEmitter<void>();

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

  async navigateToDashboard(): Promise<void> {
    clearInterval(this.timer);

    this.modalClosed.emit();

    await this.authService.refreshCurrentUser();

    await firstValueFrom(
      this.authService.getFirebaseUser().pipe(
        filter((user: User | null) => !!user) // correctly inside pipe
      )
    );

    this.router.navigate(['/dashboard']);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
