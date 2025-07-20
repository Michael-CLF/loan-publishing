import { Component, OnInit, inject, NgZone } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { ModalService } from '../services/modal.service';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-email-login',
  templateUrl: './email-login.component.html',
  styleUrls: ['./email-login.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, CommonModule],
})
export class EmailLoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private modalService = inject(ModalService);

  loginForm: FormGroup;
  isLoading = false;
  isVerifying = false;
  errorMessage = '';
  successMessage = '';
  isEmailLink = false;
  showLinkSent = false;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    console.log('Email login component initializing...');

    this.authService.isEmailSignInLink().subscribe({
      next: (isSignInLink) => {
        console.log('Is email sign-in link:', isSignInLink);
        this.isEmailLink = isSignInLink;

        if (this.isEmailLink) {
          console.log('This is an email sign-in link, handling authentication...');
          this.handleEmailLink();
        } else {
          console.log('This is not an email sign-in link');
        }
      },
      error: (error: Error) => {
        console.error('Error checking email sign-in link:', error);
        this.errorMessage = 'Error checking authentication link';
      },
    });
  }
  get emailControl() {
    return this.loginForm.get('email');
  }

  sendLoginLink(email: string): void {
  this.isLoading = true;
  this.successMessage = '';
  this.errorMessage = '';

  console.log('🔍 Validating account before sending login link...');

  // ✅ First check if account exists
  this.authService.checkAccountExists(email).subscribe({
    next: (accountInfo) => {
      if (!accountInfo.exists) {
        // Account doesn't exist
        this.isLoading = false;
        this.errorMessage = 'Account not found. Please check your email address or contact support to create an account.';
        console.log('❌ Account not found for:', email);
        return;
      }

      if (accountInfo.needsPayment) {
        // Account exists but needs payment
        this.isLoading = false;
        this.errorMessage = `Account found but payment required. Please complete your registration to access your account.`;
        console.log('💳 Account needs payment:', accountInfo);
        
        // ✅ TODO: Add payment link here once Stripe integration is ready
        // For now, just show the message
        return;
      }

      // ✅ Account exists and is active - send login link
      console.log('✅ Account validated, sending login link...');
      this.sendValidatedLoginLink(email);
    },
    error: (error) => {
      this.isLoading = false;
      this.errorMessage = 'Unable to verify account status. Please try again.';
      console.error('❌ Error checking account:', error);
    }
  });
}

private sendValidatedLoginLink(email: string): void {
  // ✅ Store redirect URL before sending link
  localStorage.setItem('redirectUrl', '/dashboard');

  this.authService.sendLoginLink(email).subscribe({
    next: () => {
      this.isLoading = false;
      this.successMessage = 'Login link sent to your email!';
      this.showLinkSent = true;
      console.log('✅ Login link sent successfully');
    },
    error: (error: Error) => {
      this.isLoading = false;
      this.errorMessage = `Error sending login link: ${error.message}`;
      console.error('❌ Error sending login link:', error);
    }
  });
}

requestNewLink(): void {
  const email = this.emailControl?.value;
  if (!email || !this.emailControl?.valid) {
    this.errorMessage = 'Please enter a valid email address.';
    return;
  }
  this.sendLoginLink(email);
}

loginWithGoogle(): void {
  this.isLoading = true;
  this.errorMessage = '';

  console.log('🔍 Attempting Google login...');

  this.authService.loginWithGoogle().subscribe({
    next: (user: User | null) => {
      if (!user || !user.email) {
        this.isLoading = false;
        this.errorMessage = 'Google sign-in failed. Please try again.';
        return;
      }

      console.log('🔍 Google login successful, validating account...');

      // ✅ Check if account exists in our system
      this.authService.checkAccountExists(user.email).subscribe({
        next: (accountInfo) => {
          if (!accountInfo.exists) {
            // Account doesn't exist in our system
            this.isLoading = false;
            this.errorMessage = 'No account found for this Google email. Please contact support or register first.';
            console.log('❌ Google account not found in system:', user.email);
            return;
          }

          if (accountInfo.needsPayment) {
            // Account exists but needs payment
            this.isLoading = false;
            this.errorMessage = `Account found but payment required. Please complete your registration to access your account.`;
            console.log('💳 Google account needs payment:', accountInfo);
            
            // ✅ TODO: Add payment link here once Stripe integration is ready
            return;
          }

          // ✅ Account exists and is active - proceed with login
          console.log('✅ Google account validated, proceeding to dashboard...');
          this.isLoading = false;
          
          this.ngZone.run(() => {
            localStorage.setItem('isLoggedIn', 'true');
            const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
            this.router.navigate([redirectUrl]);
            localStorage.removeItem('redirectUrl');
          });
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Unable to verify account status. Please try again.';
          console.error('❌ Error validating Google account:', error);
        }
      });
    },
    error: (err: Error) => {
      this.isLoading = false;
      console.error('❌ Error during Google login:', err);
      this.errorMessage = 'Google sign-in failed. Please try again.';
    }
  });
}

  private handleEmailLink(): void {
  this.isVerifying = true;
  this.errorMessage = '';

  const storedEmail = this.authService.getStoredEmail();
  console.log('Stored email for verification:', storedEmail || 'Not found');

  if (!storedEmail) {
    this.isVerifying = false;
    this.errorMessage = 'Please enter the email you used to request the login link.';
    return;
  }

  this.authService.loginWithEmailLink(storedEmail).subscribe({
    next: () => {
      this.isVerifying = false;
      console.log('✅ Email link sign-in successful');
      // Navigation handled by auth service
    },
    error: (error: any) => {
      this.isVerifying = false;
      console.error('❌ Email link sign-in error:', error);
      
      // ✅ Handle specific Firebase errors
      if (error.code === 'auth/invalid-action-code') {
        this.errorMessage = 'This login link has expired or been used already. Please request a new one.';
      } else if (error.code === 'auth/expired-action-code') {
        this.errorMessage = 'This login link has expired. Please request a new one.';
      } else {
        this.errorMessage = `Login failed: ${error.message}`;
      }
    },
  });
}
  openRoleSelectionModal(): void {
    this.modalService.openRoleSelectionModal();
  }
}
