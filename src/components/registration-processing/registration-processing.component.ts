import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-registration-processing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registration-processing.component.html',
  styleUrls: ['./registration-processing.component.css'],
})
export class RegistrationProcessingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // UI state
  showSuccessMessage = signal(false);
  showErrorMessage = signal(false);
  processingMessage = signal('');

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const paymentStatus = qp.get('payment');

    if (paymentStatus === 'success') {
      // Payment successful - show email check message
      this.showSuccessMessage.set(true);
      this.processingMessage.set('Registration Successful!');
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 4000);

    } else if (paymentStatus === 'cancel') {
      // Payment cancelled
      this.showErrorMessage.set(true);
      this.processingMessage.set('Payment was cancelled. Please try again.');
      // Redirect back to pricing after 5 seconds
      setTimeout(() => {
        this.router.navigate(['/pricing']);
      }, 5000);
    } else {
      // Unknown status
      this.showErrorMessage.set(true);
      this.processingMessage.set('Something went wrong. Please contact support.');
    }
  }

  goToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}