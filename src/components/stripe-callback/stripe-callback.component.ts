import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ResolveFn } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { take } from 'rxjs/operators';

// ✅ Resolver to check query param and flag registration success
export const stripeCallbackResolver: ResolveFn<void> = (route) => {
  const authService = inject(AuthService);
  const payment = route.queryParams['payment'];

  if (payment === 'success') {
    authService.setRegistrationSuccess(true);
  }

  return;
};

@Component({
  selector: 'app-stripe-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stripe-callback.component.html',
  styleUrls: ['./stripe-callback.component.css'],
})
export class StripeCallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private router = inject(Router);

  public isLoading = signal(true);
  public showSuccessModal = signal(false);
  public hasError = signal(false);

  ngOnInit(): void {
    const showModal = localStorage.getItem('showRegistrationModal');
    const rawData = localStorage.getItem('completeLenderData');

    if (showModal !== 'true' || !rawData) {
      this.hasError.set(true);
      this.router.navigate(['/']);
      return;
    }

    const lenderData = JSON.parse(rawData);
    const email = lenderData?.contactInfo?.contactEmail;

    if (!email) {
      this.hasError.set(true);
      this.router.navigate(['/register/lender']);
      return;
    }

    const password =
      lenderData.contactInfo?.tempPassword || this.generateTempPassword();

    this.authService
      .registerUser(email, password, {
        role: 'lender',
        userData: {
          firstName: lenderData.contactInfo.firstName,
          lastName: lenderData.contactInfo.lastName,
          company: lenderData.contactInfo.company,
          phone: lenderData.contactInfo.contactPhone,
          city: lenderData.contactInfo.city,
          state: lenderData.contactInfo.state,
        },
        lenderData: {
          contactInfo: lenderData.contactInfo,
          productInfo: lenderData.productInfo,
          footprintInfo: lenderData.footprintInfo,
        },
      })
      .pipe(take(1))
      .subscribe({
        next: () => {
          localStorage.removeItem('showRegistrationModal');
          localStorage.removeItem('completeLenderData');

          this.modalService.openLenderRegistrationSuccessModal();
          this.showSuccessModal.set(true);
          this.isLoading.set(false);

          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 3000);
        },
        error: (err) => {
          console.error('Lender registration after payment failed:', err);
          this.hasError.set(true);
          this.router.navigate(['/register/lender']);
        },
      });
  }

  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-10) + 'A1!';
  }
}
