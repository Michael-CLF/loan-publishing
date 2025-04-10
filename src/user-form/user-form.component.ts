import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
  imports: [ReactiveFormsModule, CommonModule],
})
export class UserFormComponent implements OnInit {
  userForm: FormGroup;
  successMessage: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.userForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      company: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
    });
  }

  ngOnInit(): void {}

  onSubmit(): void {
    if (this.userForm.invalid) {
      // Mark all fields as touched to trigger validation display
      Object.keys(this.userForm.controls).forEach((key) => {
        this.userForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    const userData = this.userForm.value;

    // Use the email link registration method
    this.authService.registerWithEmailOnly(userData.email, userData).subscribe({
      next: (success) => {
        this.isLoading = false;
        if (success) {
          this.successMessage = `Registration email sent to ${userData.email}. Please check your inbox and click the link to complete registration.`;
          this.errorMessage = '';
        } else {
          this.errorMessage = 'Failed to register. Please try again.';
          this.successMessage = '';
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage =
          'An error occurred during registration. Please try again.';
        this.successMessage = '';
        console.error('Registration error:', error);
      },
    });
  }
}
