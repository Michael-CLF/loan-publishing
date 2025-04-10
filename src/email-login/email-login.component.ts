import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-email-login',
  templateUrl: './email-login.component.html',
  styleUrls: ['./email-login.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
})
export class EmailLoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  showLinkSent = false;
  isVerifying = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    // Check if we're verifying an email link
    if (this.authService.isEmailSignInLink()) {
      this.handleEmailLink();
    }
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
    const email = this.loginForm.value.email;

    this.authService.sendSignInLink(email).subscribe({
      next: (success) => {
        this.isLoading = false;
        if (success) {
          this.showLinkSent = true;
        } else {
          this.errorMessage = 'Failed to send login link. Please try again.';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = 'An error occurred. Please try again.';
        console.error('Error sending login link:', error);
      },
    });
  }

  // Handle email link verification
  private handleEmailLink(): void {
    this.isVerifying = true;

    // Get stored email or ask user for it
    const storedEmail = this.authService.getStoredEmail();

    if (!storedEmail) {
      // If no stored email, show form to enter it
      this.isVerifying = false;
      this.errorMessage =
        'Please enter the email you used to request the login link.';
      return;
    }

    this.authService.signInWithEmailLink().subscribe({
      next: (user) => {
        this.isVerifying = false;
        if (user) {
          // Check if this is a new user completing registration
          this.authService.completeRegistration().subscribe();

          // Successfully logged in, redirect to dashboard or home
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage =
            'Invalid or expired login link. Please request a new one.';
        }
      },
      error: (error) => {
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
}
