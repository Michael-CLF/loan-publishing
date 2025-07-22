import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { EmailService } from '../../services/email.service';
import { CommonModule } from '@angular/common';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-verification',
  templateUrl: './verification.component.html',
  styleUrls: ['./verification.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class VerificationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private firestoreService = inject(FirestoreService);
  private emailService = inject(EmailService);

  verificationForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');

    if (!pendingEmail) {
      this.router.navigate(['/register']);
      return;
    }

    this.verificationForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  onSubmit(): void {
    if (this.verificationForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const code = this.verificationForm.get('code')?.value;
    const email = localStorage.getItem('pendingVerificationEmail');

    if (!email) {
      this.errorMessage = 'Session expired. Please register again.';
      this.isLoading = false;
      return;
    }

    // Basic local code verification logic (temporary)
    if (code !== '123456') {
      this.isLoading = false;
      this.errorMessage = 'Invalid verification code. Please try again.';
      return;
    }

    const userData = JSON.parse(localStorage.getItem('registrationData') || '{}');

  // ✅ Authenticate via email link (same as email-login component)
const storedEmail = this.authService.getStoredEmail();

if (!storedEmail) {
  this.isLoading = false;
  this.errorMessage = 'No email found for verification. Please try logging in again.';
  return;
}

this.authService.loginWithEmailLink(storedEmail).subscribe({
  next: () => {
    this.isLoading = false;
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.removeItem('pendingVerificationEmail');
    localStorage.removeItem('registrationData');
    
    this.successMessage = 'Login successful! Redirecting...';
    
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 1500);
  },
  error: (error: any) => {
    this.isLoading = false;
    console.error('Error during email link authentication:', error);
    this.errorMessage = 'Authentication failed. Please try again or request a new login link.';
  }
});
  }

  resendCode(): void {
    const email = localStorage.getItem('pendingVerificationEmail');

    if (!email) {
      this.errorMessage = 'Session expired. Please register again.';
      return;
    }

    this.isLoading = true;

    // Use static code for resend (mocked)
    const code = '123456';

    this.emailService.sendVerificationEmail(email, code, 'User').subscribe({
      next: (success: boolean) => {
        this.isLoading = false;
        if (success) {
          this.successMessage = 'Verification code resent. Check your email.';
          this.errorMessage = '';
        } else {
          this.errorMessage = 'Failed to resend verification code.';
          this.successMessage = '';
        }
      },
      error: (error: any) => {
        console.error('Error resending code:', error);
        this.isLoading = false;
        this.errorMessage = 'Failed to resend verification code. Please try again.';
      },
    });
  }
}
