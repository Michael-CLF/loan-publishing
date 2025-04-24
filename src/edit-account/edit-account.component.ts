// edit-account.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { StateOption } from '../user-form/user-form.component';
import { take } from 'rxjs/operators';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';

@Component({
  selector: 'app-edit-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-account.component.html',
  styleUrls: ['./edit-account.component.css'],
})
export class EditAccountComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);

  accountForm!: FormGroup;
  emailChangeForm!: FormGroup;
  showEmailChangeForm = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  userId: string | null = null;
  currentEmail = '';
  userFullName = '';
  userFirstName = '';
  userData: any = {};

  // Define all US states
  states: StateOption[] = [
    { value: 'AL', name: 'Alabama' },
    // ... include all states
  ];

  ngOnInit(): void {
    this.initForms();
    this.loadUserData();
  }

  initForms(): void {
    // Main account form with relevant editable fields

    this.accountForm = this.fb.group({
      firstName: [{ value: '', disabled: true }], // Set as view-only
      lastName: [{ value: '', disabled: true }], // Set as view-only
      company: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z0-9 ]+$/),
        ],
      ],
      email: [{ value: '', disabled: true }], // Always disabled, changed through separate flow
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[\d\(\)\-\+\s]*$/),
          Validators.minLength(14),
        ],
      ],
      city: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      state: ['', [Validators.required]],
    });

    // Separate form for email change
    this.emailChangeForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]], // To verify user identity
    });
  }

  formatPhoneNumber(): void {
    let phone = this.accountForm.get('phone')?.value;
    if (phone) {
      phone = phone.replace(/\D/g, ''); // Remove non-numeric characters
      if (phone.length === 10) {
        phone = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
        this.accountForm.get('phone')?.setValue(phone);
      }
    }
  }

  loadUserData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.authService
      .getCurrentUser()
      .pipe(take(1))
      .subscribe({
        next: (user) => {
          if (user) {
            this.userId = user.uid;
            console.log('Current user ID:', this.userId);

            // Try to get user profile from Firestore
            this.authService
              .getUserProfile(user.uid)
              .pipe(take(1))
              .subscribe({
                next: (profile) => {
                  console.log(
                    'Full profile data:',
                    JSON.stringify(profile, null, 2)
                  );

                  if (profile) {
                    // Process the profile data
                    this.userData = profile;

                    console.log('firstName:', profile.firstName);
                    console.log('lastName:', profile.lastName);
                    console.log('email:', profile.email);
                    console.log('company:', profile.company);
                    console.log('phone:', profile.phone);
                    console.log('city:', profile.city);
                    console.log('state:', profile.state);

                    // Set user display info
                    this.userFirstName = profile['firstName'] || '';
                    this.userFullName = `${profile['firstName'] || ''} ${
                      profile['lastName'] || ''
                    }`.trim();

                    // Update form with existing data
                    this.accountForm.patchValue({
                      firstName: profile['firstName'] || '',
                      lastName: profile['lastName'] || '',
                      email: profile['email'] || '',
                      company: profile['company'] || '',
                      phone: profile['phone'] || '',
                      city: profile['city'] || '',
                      state: profile['state'] || '',
                    });

                    // Store current email for reference
                    this.currentEmail = profile['email'] || '';
                  } else {
                    console.log(
                      'No profile found, using auth data as fallback'
                    );

                    // Use auth user data as fallback
                    const email = user.email || '';

                    this.currentEmail = email;
                    this.accountForm.patchValue({
                      email: email,
                    });

                    this.errorMessage =
                      'Profile data not found. Please complete your profile.';
                  }
                  this.isLoading = false;
                },
                error: (err) => {
                  console.error('Error loading profile:', err);
                  this.errorMessage = 'Failed to load profile data';
                  this.isLoading = false;
                },
              });
          } else {
            console.log('No authenticated user found');
            this.errorMessage = 'Not logged in';
            this.isLoading = false;
          }
        },
        error: (err) => {
          console.error('Auth error:', err);
          this.errorMessage = 'Authentication error';
          this.isLoading = false;
        },
      });
  }

  onSubmit(): void {
    if (this.accountForm.invalid || !this.userId) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Prepare the form data
    const formData = {
      firstName: this.accountForm.get('firstName')?.value || '',
      lastName: this.accountForm.get('lastName')?.value || '',
      company: this.accountForm.get('company')?.value || '',
      phone: this.accountForm.get('phone')?.value || '',
      city: this.accountForm.get('city')?.value || '',
      state: this.accountForm.get('state')?.value || '',
      email: this.currentEmail, // Make sure email is included
    };

    // Use a simple approach - just save the data
    this.userService.updateUser(this.userId, formData).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Profile updated successfully!';
        setTimeout(() => this.router.navigate(['/dashboard']), 1500);
      },
      error: (err) => {
        this.errorMessage = 'Failed to update profile';
        this.isLoading = false;
        console.error(err);
      },
    });
  }

  toggleEmailChangeForm(): void {
    this.showEmailChangeForm = !this.showEmailChangeForm;
    // Reset the form when toggling
    if (this.showEmailChangeForm) {
      this.emailChangeForm.reset();
    }
  }

  submitEmailChange(): void {
    if (this.emailChangeForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { newEmail, password } = this.emailChangeForm.value;

    // First reauthenticate the user to ensure security
    this.userService
      .initiateEmailChange(this.currentEmail, newEmail, password)
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage =
            'Email verification sent. Please check your new email inbox to complete the change.';
          this.showEmailChangeForm = false;
        },
        error: (err) => {
          this.isLoading = false;
          if (err.code === 'auth/wrong-password') {
            this.errorMessage = 'Incorrect password. Please try again.';
          } else if (err.code === 'auth/email-already-in-use') {
            this.errorMessage =
              'This email is already in use by another account.';
          } else {
            this.errorMessage =
              'Failed to initiate email change. Please try again.';
          }
          console.error('Email change error:', err);
        },
      });
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }
}
