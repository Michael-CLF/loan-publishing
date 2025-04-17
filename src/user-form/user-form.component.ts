import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { PasswordAuthService } from '../services/password-auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
})
export class UserFormComponent implements OnInit {
  userForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  phone: any;

  // Define user types options
  userTypes: UserTypeOption[] = [
    { value: 'bank', name: 'Bank' },
    { value: 'borrower-sponsor', name: 'Borrower/Sponsor' },
    { value: 'loan-officer', name: 'Loan Officer' },
    { value: 'mortgage-broker', name: 'Mortgage Broker' },
    { value: 'mortgage-banker', name: 'Mortgage Banker' },
  ];

  // Define all US states
  states: StateOption[] = [
    { value: 'AL', name: 'Alabama' },
    { value: 'AK', name: 'Alaska' },
    { value: 'AZ', name: 'Arizona' },
    { value: 'AR', name: 'Arkansas' },
    { value: 'CA', name: 'California' },
    { value: 'CO', name: 'Colorado' },
    { value: 'CT', name: 'Connecticut' },
    { value: 'DE', name: 'Delaware' },
    { value: 'FL', name: 'Florida' },
    { value: 'GA', name: 'Georgia' },
    { value: 'HI', name: 'Hawaii' },
    { value: 'ID', name: 'Idaho' },
    { value: 'IL', name: 'Illinois' },
    { value: 'IN', name: 'Indiana' },
    { value: 'IA', name: 'Iowa' },
    { value: 'KS', name: 'Kansas' },
    { value: 'KY', name: 'Kentucky' },
    { value: 'LA', name: 'Louisiana' },
    { value: 'ME', name: 'Maine' },
    { value: 'MD', name: 'Maryland' },
    { value: 'MA', name: 'Massachusetts' },
    { value: 'MI', name: 'Michigan' },
    { value: 'MN', name: 'Minnesota' },
    { value: 'MS', name: 'Mississippi' },
    { value: 'MO', name: 'Missouri' },
    { value: 'MT', name: 'Montana' },
    { value: 'NE', name: 'Nebraska' },
    { value: 'NV', name: 'Nevada' },
    { value: 'NH', name: 'New Hampshire' },
    { value: 'NJ', name: 'New Jersey' },
    { value: 'NM', name: 'New Mexico' },
    { value: 'NY', name: 'New York' },
    { value: 'NC', name: 'North Carolina' },
    { value: 'ND', name: 'North Dakota' },
    { value: 'OH', name: 'Ohio' },
    { value: 'OK', name: 'Oklahoma' },
    { value: 'OR', name: 'Oregon' },
    { value: 'PA', name: 'Pennsylvania' },
    { value: 'RI', name: 'Rhode Island' },
    { value: 'SC', name: 'South Carolina' },
    { value: 'SD', name: 'South Dakota' },
    { value: 'TN', name: 'Tennessee' },
    { value: 'TX', name: 'Texas' },
    { value: 'UT', name: 'Utah' },
    { value: 'VT', name: 'Vermont' },
    { value: 'VA', name: 'Virginia' },
    { value: 'WA', name: 'Washington' },
    { value: 'WV', name: 'West Virginia' },
    { value: 'WI', name: 'Wisconsin' },
    { value: 'WY', name: 'Wyoming' },
    { value: 'DC', name: 'District of Columbia' },
  ];

  constructor(
    private fb: FormBuilder,
    private passwordAuthService: PasswordAuthService
  ) {}

  ngOnInit(): void {
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
      userType: ['', [Validators.required]],
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

  // This method formats the phone number
  formatPhoneNumber(): void {
    let phone = this.userForm.get('phone')?.value;
    if (phone) {
      phone = phone.replace(/\D/g, ''); // Remove non-numeric characters
      if (phone.length === 10) {
        phone = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
        this.userForm.get('phone')?.setValue(phone);
      }
    }
  }

  onSubmit(): void {
    if (this.userForm.invalid) return;

    this.isLoading = true;
    const {
      firstName,
      lastName,
      company,
      userType,
      email,
      phone,
      city,
      state,
      tos,
    } = this.userForm.value;

    this.passwordAuthService
      .registerUser(email, 'defaultpassword', {
        firstName,
        lastName,
        company,
        userType,
        email,
        phone,
        city,
        state,
      })
      .subscribe(
        (user) => {
          this.isLoading = false;
          this.successMessage = 'Registration successful!';
        },
        (error) => {
          this.isLoading = false;
          this.errorMessage = 'Registration failed. Please try again.';
        }
      );
  }
}
