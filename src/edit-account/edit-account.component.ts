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
import { Firestore } from '@angular/fire/firestore';

import { UserData } from '../models/user-data.model'; // Make sure you import or define UserData correctly

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
  userData: UserData = {} as UserData;

  states: StateOption[] = [
    { value: 'AL', name: 'Alabama' },
    // add all other states here...
  ];

  ngOnInit(): void {
    this.initForms();
    this.loadUserData();
  }

  formatPhoneNumber(): void {
    const phoneControl = this.accountForm.get('phone');
    if (phoneControl) {
      let phone = phoneControl.value || '';
      phone = phone.replace(/\D/g, ''); // Remove all non-digit characters

      if (phone.length === 10) {
        const formattedPhone = `(${phone.slice(0, 3)}) ${phone.slice(
          3,
          6
        )}-${phone.slice(6)}`;
        phoneControl.setValue(formattedPhone, { emitEvent: false });
      }
    }
  }

  private initForms(): void {
    this.accountForm = this.fb.group({
      firstName: [{ value: '', disabled: true }],
      lastName: [{ value: '', disabled: true }],
      company: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z0-9 ]+$/),
        ],
      ],
      email: [{ value: '', disabled: true }],
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

    this.emailChangeForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  private async loadUserData(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const user = await this.authService.getCurrentUser().toPromise();

      if (!user) {
        console.log('No authenticated user found');
        this.errorMessage = 'Not logged in';
        this.isLoading = false;
        return;
      }

      this.userId = user.uid;
      console.log('Current user ID:', this.userId);

      const profile = await this.authService.getUserProfile(user.uid);

      if (profile) {
        this.userData = profile;

        this.userFirstName = profile.firstName || '';
        this.userFullName = `${profile.firstName || ''} ${
          profile.lastName || ''
        }`.trim();

        this.accountForm.patchValue({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          company: profile.company || '',
          phone: profile.phone || '',
          city: profile.city || '',
          state: profile.state || '',
        });

        this.currentEmail = profile.email || '';
      } else {
        console.warn('Profile not found, using auth user fallback');
        this.currentEmail = user.email || '';

        this.accountForm.patchValue({
          email: this.currentEmail,
        });

        this.errorMessage =
          'Profile data not found. Please complete your profile.';
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      this.errorMessage = 'Failed to load profile data';
    } finally {
      this.isLoading = false;
    }
  }

  onSubmit(): void {
    if (this.accountForm.invalid || !this.userId) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formData = {
      firstName: this.accountForm.get('firstName')?.value || '',
      lastName: this.accountForm.get('lastName')?.value || '',
      company: this.accountForm.get('company')?.value || '',
      phone: this.accountForm.get('phone')?.value || '',
      city: this.accountForm.get('city')?.value || '',
      state: this.accountForm.get('state')?.value || '',
      email: this.currentEmail,
    };

    this.userService.updateUser(this.userId, formData).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Profile updated successfully!';
        setTimeout(() => this.router.navigate(['/dashboard']), 1500);
      },
      error: (err) => {
        console.error('Failed to update profile:', err);
        this.errorMessage = 'Failed to update profile';
        this.isLoading = false;
      },
    });
  }

  toggleEmailChangeForm(): void {
    this.showEmailChangeForm = !this.showEmailChangeForm;
    if (this.showEmailChangeForm) {
      this.emailChangeForm.reset();
    }
  }

  submitEmailChange(): void {
    if (this.emailChangeForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { newEmail, password } = this.emailChangeForm.value;

    this.userService
      .initiateEmailChange(this.currentEmail, newEmail, password)
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage =
            'Email verification sent. Please check your inbox.';
          this.showEmailChangeForm = false;
        },
        error: (err) => {
          console.error('Email change error:', err);
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
        },
      });
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }
}
