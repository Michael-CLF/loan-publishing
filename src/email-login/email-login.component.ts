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

  loginForm: FormGroup;
  isLoading = false;
  showLinkSent = false;
  isVerifying = false;
  errorMessage = '';
  isEmailLink = false;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    console.log('Email login component initializing...');

    // Use the service method that safely checks for email sign-in link
    this.authService.isEmailSignInLink().subscribe({
      next: (isSignInLink) => {
        console.log('Is email sign-in link:', isSignInLink);
        this.isEmailLink = isSignInLink;

        if (this.isEmailLink) {
          console.log(
            'This is an email sign-in link, handling authentication...'
          );
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

  // Getter for easy access to form fields
  get emailControl() {
    return this.loginForm.get('email');
  }

  // Send login link to the user's email
  sendLoginLink(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const email = this.loginForm.value.email;
    console.log('Sending login link to:', email);

    this.authService.sendSignInLink(email).subscribe({
      next: (success) => {
        this.isLoading = false;
        if (success) {
          console.log('Login link sent successfully');
          this.showLinkSent = true;
        } else {
          console.error('Failed to send login link');
          this.errorMessage = 'Failed to send login link. Please try again.';
        }
      },
      error: (error: Error) => {
        this.isLoading = false;
        this.errorMessage = 'An error occurred. Please try again.';
        console.error('Error sending login link:', error);
      },
    });
  }

  // Handle email link verification
  private handleEmailLink(): void {
    this.isVerifying = true;
    this.errorMessage = '';

    // Get stored email or ask user for it
    const storedEmail = this.authService.getStoredEmail();
    console.log(
      'Stored email for verification:',
      storedEmail ? 'Found' : 'Not found'
    );

    if (!storedEmail) {
      // If no stored email, show form to enter it
      this.isVerifying = false;
      this.errorMessage =
        'Please enter the email you used to request the login link.';
      return;
    }

    console.log('Proceeding with email link sign-in using:', storedEmail);
    this.authService.signInWithEmailLink(storedEmail).subscribe({
      next: (user) => {
        console.log(
          'Sign-in with email link result:',
          user ? 'Success' : 'Failed'
        );
        this.isVerifying = false;

        if (user) {
          // Successfully logged in, redirect to dashboard
          console.log('Authentication successful, redirecting to dashboard');
          this.ngZone.run(() => {
            // Set login state explicitly
            localStorage.setItem('isLoggedIn', 'true');

            // Redirect to dashboard or stored URL
            const redirectUrl =
              localStorage.getItem('redirectUrl') || '/dashboard';
            console.log('Redirecting to:', redirectUrl);
            this.router.navigate([redirectUrl]);
            localStorage.removeItem('redirectUrl');
          });
        } else {
          this.errorMessage =
            'Invalid or expired login link. Please request a new one.';
        }
      },
      error: (error: Error) => {
        this.isVerifying = false;
        this.errorMessage =
          'An error occurred during verification. Please try again.';
        console.error('Error verifying email link:', error);
      },
    });
  }

  // Reset the form to request another link
  requestNewLink(): void {
    this.showLinkSent = false;
    this.errorMessage = '';
  }

  // Submit email when user has to manually enter it for a verification link
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

          // Successfully logged in, redirect to dashboard
          this.ngZone.run(() => {
            // Set login state explicitly
            localStorage.setItem('isLoggedIn', 'true');

            // Redirect to dashboard or stored URL
            const redirectUrl =
              localStorage.getItem('redirectUrl') || '/dashboard';
            this.router.navigate([redirectUrl]);
            localStorage.removeItem('redirectUrl');
          });
        } else {
          this.errorMessage =
            'Invalid or expired login link. Please request a new one.';
        }
      },
      error: (error: Error) => {
        this.isVerifying = false;
        this.errorMessage =
          'An error occurred during verification. Please try again.';
        console.error('Error verifying email link with manual email:', error);
      },
    });
  }
}
