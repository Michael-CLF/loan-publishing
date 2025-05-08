import {
  Component,
  OnInit,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { VerificationCodeService } from '../services/verification-code.service';
import { EmailService } from '../services/email.service';
import { ModalService } from '../services/modal.service';
import { usaStatesWithCounties } from 'typed-usa-states/dist/states-with-counties';
import { LocationService } from 'src/services/location.service';

export interface StateOption {
  value: string;
  name: string;
}

export interface UserTypeOption {
  value: string;
  name: string;
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
  providers: [EmailService],
})
export class UserFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private emailService = inject(EmailService);
  private verificationService = inject(VerificationCodeService);
  private modalService = inject(ModalService); // Inject ModalService
  private readonly locationService = inject(LocationService);
  private injector = inject(Injector);

  userForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  phone: any;

  // Define all US states - using the same approach as lender registration
  states: StateOption[] = [];

  ngOnInit(): void {
    // Use the LocationService to get states in the same format as lender registration
    const footprintLocations = this.locationService.getFootprintLocations();
    this.states = footprintLocations.map((location) => ({
      value: location.value,
      name: location.name,
    }));

    this.userForm = this.fb.group({
      firstName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      company: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z0-9 ]+$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
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
      tos: [false, [Validators.requiredTrue]],
    });

    console.log('Initial TOS control state:', {
      value: this.userForm.get('tos')?.value,
      status: this.userForm.get('tos')?.status,
      enabled: !this.userForm.get('tos')?.disabled,
    });
  }

  formatPhoneNumber(): void {
    let phone = this.userForm.get('phone')?.value;
    if (phone) {
      phone = phone.replace(/\D/g, ''); // digits only
      if (phone.length > 10) phone = phone.slice(0, 10);

      let formatted = phone;
      if (phone.length >= 6) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(
          6
        )}`;
      } else if (phone.length >= 3) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
      } else {
        formatted = phone;
      }

      this.userForm.get('phone')?.setValue(formatted, { emitEvent: false });
    }
  }

  onSubmit(): void {
    // Mark form as touched to show validation errors
    Object.keys(this.userForm.controls).forEach((key) => {
      const control = this.userForm.get(key);
      control?.markAsTouched();
    });

    if (this.userForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formData = this.userForm.value;

    // Run Firebase operations inside injection context for consistency with LenderRegistrationComponent
    runInInjectionContext(this.injector, () => {
      // For direct registration without email verification
      this.authService
        .registerUser(formData.email, 'defaultPassword123', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          company: formData.company,
          userType: formData.userType,
          phone: formData.phone,
          city: formData.city,
          state: formData.state,
          role: 'originator',
        })
        .pipe(
          tap(() => {
            this.isLoading = false;
            this.modalService.openUserRegSuccessModal();
            this.userForm.reset();
          }),
          catchError((error) => {
            this.isLoading = false;
            console.error('Registration error:', error);
            if (error.code === 'auth/email-already-in-use') {
              this.errorMessage =
                'This email is already registered. Please use a different email or login with your existing account.';
            } else {
              this.errorMessage = 'Registration failed. Please try again.';
            }
            return of(null);
          })
        )
        .subscribe();
    });
  }
}
