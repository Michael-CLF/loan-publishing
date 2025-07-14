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
  showLinkSent = false;
  isVerifying = false;
  errorMessage = '';
  successMessage = '';
  isEmailLink = false;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  openRoleSelectionModal(): void {
    this.modalService.openRoleSelectionModal();
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
    this.authService.sendLoginLink(email).subscribe({
      next: () => {
        this.successMessage = 'Login link sent!';
      },
      error: (error: Error) => {
        this.isLoading = false;
        this.errorMessage = `Error: ${error.message}`;
        console.error('Error sending login link:', error);
      }
    });
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle().subscribe({
      next: (user: User | null) => {
        if (user) {
          console.log('✅ Signed in with Google:', user);
          this.ngZone.run(() => {
            localStorage.setItem('isLoggedIn', 'true');
            const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
            this.router.navigate([redirectUrl]);
            localStorage.removeItem('redirectUrl');
          });
        } else {
          this.errorMessage = 'Google sign-in failed. Please try again.';
        }
      },
      error: (err: Error) => {
        console.error('❌ Error during Google login:', err);
        this.errorMessage = 'Google sign-in failed.';
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

    console.log('Proceeding with email link sign-in using:', storedEmail);
    console.log('Current URL:', window.location.href);

    setTimeout(() => {
      this.authService.signInWithEmailLink(storedEmail).subscribe({
        next: (user) => {
          console.log('Sign-in with email link result:', user ? 'Success' : 'Failed');
          this.isVerifying = false;

          if (user) {
            console.log('Authentication successful, redirecting to dashboard');
            this.ngZone.run(() => {
              localStorage.setItem('isLoggedIn', 'true');
              const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
              this.router.navigate([redirectUrl]);
              localStorage.removeItem('redirectUrl');
            });
          } else {
            this.errorMessage = 'Invalid or expired login link. Please request a new one.';
          }
        },
        error: (error: Error) => {
          this.isVerifying = false;
          this.errorMessage = `Error: ${error.message}`;
          console.error('Error verifying email link:', error);
        },
      });
    }, 500);
  }

  requestNewLink(): void {
    this.showLinkSent = false;
    this.errorMessage = '';
  }

  submitEmail(): void {
    if (this.loginForm.invalid) {
      return;
    }

    const email = this.loginForm.value.email;
    console.log('Using manually entered email for verification:', email);

    this.isVerifying = true;
    this.authService.signInWithEmailLink(email).subscribe({
      next: (user) => {
        this.isVerifying = false;
        if (user) {
          console.log('Verification successful with manual email entry');
          this.ngZone.run(() => {
            localStorage.setItem('isLoggedIn', 'true');
            const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
            this.router.navigate([redirectUrl]);
            localStorage.removeItem('redirectUrl');
          });
        } else {
          this.errorMessage = 'Invalid or expired login link. Please request a new one.';
        }
      },
      error: (error: Error) => {
        this.isVerifying = false;
        this.errorMessage = 'An error occurred during verification. Please try again.';
        console.error('Error verifying email link with manual email:', error);
      },
    });
  }
}
