import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EventEmitter, Output } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-lender-reg-success-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lender-reg-success-modal.component.html',
  styleUrl: './lender-reg-success-modal.component.css',
})
export class LenderRegSuccessModalComponent implements OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  countdown = 5; // 5 seconds before auto-redirect
  private timer: any;

  public isVisible = false;

  open(): void {
    this.isVisible = true;
  }


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
