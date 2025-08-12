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
  
  // ✅ NEW: Add properties to manage error dialog state
  showErrorDialog = false;
  errorType: 'account-not-found' | 'payment-required' | 'general' | null = null;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

ngOnInit(): void {
  console.log('Email login component initializing...');
  
  // Don't try to handle email links if we're not on the login page
  // The registration-processing component handles auth actions
  const currentUrl = window.location.href;
  if (currentUrl.includes('/__/auth/action')) {
    console.log('📧 Email login component: Skipping - auth action URL');
    return;
  }
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
        this.showError('Error checking authentication link', 'general');
      },
    });
  }
  get emailControl() {
    return this.loginForm.get('email');
  }  
sendLoginLink(email: string): void {
  this.isLoading = true;
  this.successMessage = '';
  this.clearError();
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
      this.showError(`Error sending login link: ${error.message}`, 'general');
      console.error('❌ Error sending login link:', error);
    }
  });
}  
  // ✅ NEW: Method to show error with dialog
  private showError(message: string, type: 'account-not-found' | 'payment-required' | 'general'): void {
    this.errorMessage = message;
    this.errorType = type;
    this.showErrorDialog = true;
  }

  // ✅ NEW: Method to clear error state
  clearError(): void {
    this.errorMessage = '';
    this.errorType = null;
    this.showErrorDialog = false;
  }

  // ✅ MODIFIED: Fix the "Try Again" functionality
  tryAgain(): void {
    // Clear the error dialog and reset form state
    this.clearError();
    
    // Reset the email field so user can enter a different email
    this.loginForm.get('email')?.reset();
    this.loginForm.get('email')?.markAsUntouched();
    
    // Focus back to the email input (you'll need to add template reference)
    // The user can now enter a different email address
    
    console.log('🔄 Try again - form reset for new email entry');
  }

  // ✅ NEW: Close error dialog but keep the form data
  closeErrorDialog(): void {
    this.showErrorDialog = false;
  }

requestNewLink(): void {
  this.clearError();
  
  const email = this.emailControl?.value;
  if (!email || !this.emailControl?.valid) {
    this.showError('Please enter a valid email address.', 'general');
    return;
  }
  
  // Reset the form control to clear validation state
  this.loginForm.get('email')?.markAsUntouched();
  
  console.log('🔄 Trying again with email:', email);
  this.sendLoginLink(email);
}

  loginWithGoogle(): void {
    this.isLoading = true;
    this.clearError();

    console.log('🔍 Attempting Google login...');

    this.authService.loginWithGoogle().subscribe({
      next: (user: User | null) => {
        if (!user || !user.email) {
          this.isLoading = false;
          this.showError('Google sign-in failed. Please try again.', 'general');
          return;
        }

        console.log('🔍 Google login successful, validating account...');

        this.authService.checkAccountExists(user.email).subscribe({
          next: (accountInfo) => {
            if (!accountInfo.exists) {
              this.isLoading = false;
              this.showError(
                'No account found for this Google email. Please contact support or register first.',
                'account-not-found'
              );
              console.log('❌ Google account not found in system:', user.email);
              return;
            }

            if (accountInfo.needsPayment) {
              this.isLoading = false;
              this.showError(
                'Account found but payment required. Please complete your registration to access your account.',
                'payment-required'
              );
              console.log('💳 Google account needs payment:', accountInfo);
              return;
            }

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
            this.showError('Unable to verify account status. Please try again.', 'general');
            console.error('❌ Error validating Google account:', error);
          }
        });
      },
      error: (err: Error) => {
        this.isLoading = false;
        console.error('❌ Error during Google login:', err);
        this.showError('Google sign-in failed. Please try again.', 'general');
      }
    });
  }
private handleEmailLink(): void {
  this.isVerifying = true;
  this.clearError();

  console.log('🔗 Handling email link authentication...');

  this.authService.handleEmailLinkAuthentication().subscribe({
    next: (result) => {
      this.isVerifying = false;
      
      if (result.success && result.user) {
        console.log('✅ Email link authentication successful for:', result.user.email);
        
        // ✅ ENHANCED: Verify user has proper access
        this.authService.checkAccountExists(result.user.email!).subscribe({
          next: (accountInfo) => {
            if (!accountInfo.exists) {
              this.showError('Account not found. Please contact support.', 'account-not-found');
              return;
            }

            if (accountInfo.needsPayment) {
              this.showError('Payment required to access your account.', 'payment-required');
              return;
            }

            // ✅ SUCCESS: Navigate to dashboard
            this.ngZone.run(() => {
              localStorage.setItem('isLoggedIn', 'true');
              const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
              console.log('🔄 Redirecting to:', redirectUrl);
              
              this.router.navigate([redirectUrl]).then(() => {
                localStorage.removeItem('redirectUrl');
                console.log('✅ Navigation completed successfully');
              });
            });
          },
          error: (error) => {
            console.error('❌ Error validating account:', error);
            this.showError('Unable to verify account. Please try again.', 'general');
          }
        });
      } else {
        console.error('❌ Email link authentication failed:', result.error);
        
        if (result.error?.includes('expired')) {
          this.showError('This login link has expired. Please request a new one.', 'general');
        } else if (result.error?.includes('Email not found')) {
          this.showError('Authentication failed. Please try requesting a new login link.', 'general');
        } else {
          this.showError(`Authentication failed: ${result.error}`, 'general');
        }
      }
    },
    error: (error: any) => {
      this.isVerifying = false;
      console.error('❌ Email link authentication error:', error);
      this.showError('Authentication failed. Please try again.', 'general');
    }
  });
}

  openRoleSelectionModal(): void {
    this.modalService.openRoleSelectionModal();
  }
}