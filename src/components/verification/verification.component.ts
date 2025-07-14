import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FirestoreService } from '../../services/firestore.service';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { EmailService } from '../../services/email.service';
import { VerificationCodeService } from '../../services/verification-code.service';

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
  private verificationService = inject(VerificationCodeService);

  verificationForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    // Check if there's registration data
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');

    if (!pendingEmail) {
      // If no pending email, redirect back to registration
      this.router.navigate(['/register']);
      return;
    }

    // Initialize form
    this.verificationForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
  }

  onSubmit(): void {
    if (this.verificationForm.invalid) {
      return;
    }

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
    // Use the verification service to verify the code
    this.verificationService.verifyCode(email, code).subscribe({
      next: (userData) => {
        this.isLoading = false;
        this.successMessage =
          'Verification successful! Redirecting to your dashboard...';

        // Create user account in Firebase and Firestore
        this.authService
          .registerUser(userData.email, userData)
          .subscribe({
            next: (user) => {
              // Set logged in flag
              localStorage.setItem('isLoggedIn', 'true');

              // Clear verification data
              localStorage.removeItem('pendingVerificationEmail');

              // Redirect to dashboard
              setTimeout(() => {
                this.router.navigate(['/dashboard']);
              }, 1500);
            },
            error: (error) => {
              console.error('Error creating user account:', error);
              this.errorMessage =
                'Failed to create user account. Please try again.';
            },
          });
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Verification error:', error);

        if (error.message === 'Invalid verification code') {
          this.errorMessage = 'Invalid verification code. Please try again.';
        } else if (error.message === 'Verification code has expired') {
          this.errorMessage =
            'Your verification code has expired. Please register again.';
        } else {
          this.errorMessage = 'Verification failed. Please try again.';
        }
      },
    });
  }

  resendCode(): void {
    const email = localStorage.getItem('pendingVerificationEmail');

    if (!email) {
      this.errorMessage = 'Session expired. Please register again.';
      return;
    }

    this.isLoading = true;

    // Generate a new verification code
    this.verificationService
      .storeVerificationCode(email, null)
      .pipe(
        switchMap((code) => {
          // Send the new code via email
          return this.emailService.sendVerificationEmail(
            email,
            code,
            'User' // Since we don't have the firstName here, use a generic greeting
          );
        })
      )
      .subscribe({
        next: (success) => {
          this.isLoading = false;
          if (success) {
            this.successMessage =
              'Verification code resent. Please check your email.';
            this.errorMessage = '';
          } else {
            this.errorMessage =
              'Failed to resend verification code. Please try again.';
            this.successMessage = '';
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error resending code:', error);
          this.errorMessage =
            'Failed to resend verification code. Please try again.';
        },
      });
  }
  private verifyCode(email: string, code: string): Observable<any> {
    // Placeholder for code verification logic
    // In a real implementation, you would check the code against your database

    // For demonstration purposes, we'll retrieve the userData from localStorage
    const userData = JSON.parse(
      localStorage.getItem('registrationData') || '{}'
    );

    // Simulate verification (replace with actual verification)
    if (code === '123456') {
      // Replace with actual verification logic
      return from(Promise.resolve(userData));
    } else {
      return throwError(() => new Error('Invalid code'));
    }
  }

  private createUserAccount(userData: any): Observable<void> {
    // This would create a user account in your system
    // For Firebase, you might use anonymous auth or email/password auth

    return from(Promise.resolve()).pipe(
      switchMap(() => {
        // For demonstration, we'll just simulate account creation
        // Replace with actual account creation logic

        // Set authenticated flag
        localStorage.setItem('isLoggedIn', 'true');

        // Clear registration data
        localStorage.removeItem('pendingVerificationEmail');
        localStorage.removeItem('registrationData');

        return from(Promise.resolve());
      }),
      catchError((error) => {
        console.error('Error creating account:', error);
        return throwError(() => error);
      })
    );
  }
}
