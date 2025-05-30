import {
  Component,
  OnInit,
  inject,
  DestroyRef,
  Injector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoanService } from '../services/loan.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, tap, catchError, of } from 'rxjs';
import { Loan } from '../models/loan-model.model';


@Component({
  selector: 'app-edit-loan',
  templateUrl: './edit-loan.component.html',
  styleUrls: ['./edit-loan.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class EditLoanComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private loanService = inject(LoanService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  loanForm!: FormGroup;
  loanId: string = '';

  // For displaying read-only property information
  propertyInfo = signal<{
    propertyTypeCategory: string;
    propertySubCategory: string;
    transactionType: string;
    city: string;
    state: string;
  }>({
    propertyTypeCategory: '',
    propertySubCategory: '',
    transactionType: '',
    city: '',
    state: '',
  });

  // Loading and error states using signals
  loading = signal(true);
  error = signal<string | null>(null);
  success = signal(false);

  ngOnInit(): void {
    // Initialize the form
    this.initForm();

    // Get the loan ID from the route params and load the loan data
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap((params) => {
          const id = params.get('id');
          if (id) {
            this.loanId = id;
          } else {
            this.error.set('Loan ID not found in route');
            this.loading.set(false);
          }
        }),
        switchMap(() => {
          if (!this.loanId) {
            return of(null);
          }
          return this.loanService.getLoanById(this.loanId).pipe(
            catchError((err) => {
              console.error('Error fetching loan:', err);
              this.error.set('Failed to load loan data: ' + err.message);
              this.loading.set(false);
              return of(null);
            })
          );
        })
      )
      .subscribe((loan) => {
        if (loan) {
          // Store property info in the signal for read-only display
          this.propertyInfo.set({
            propertyTypeCategory: loan.propertyTypeCategory || '',
            propertySubCategory: loan.propertySubCategory || '',
            transactionType: loan.transactionType || '',
            city: loan.city || '',
            state: loan.state || '',
          });

          this.populateForm(loan);
        }
        this.loading.set(false);
      });
  }

  // Initialize the form with validators, excluding read-only fields
  initForm(): void {
    this.loanForm = this.fb.group({
      loanAmount: ['', Validators.required],
      loanType: ['', Validators.required],
      propertyValue: ['', Validators.required],
      ltv: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      noi: [''],
      numberOfSponsors: [1, [Validators.required, Validators.min(1)]],
      sponsorsLiquidity: ['', Validators.required],
      sponsorFico: [
        0,
        [Validators.required, Validators.min(300), Validators.max(850)],
      ],
      experienceInYears: [0, [Validators.required, Validators.min(0)]],
    });
  }

  // Populate the form with existing loan data
  populateForm(loan: Loan): void {
    // Only update the form with available values from the loan
    const formValue: any = {};

    Object.keys(this.loanForm.controls).forEach((key) => {
      if (loan.hasOwnProperty(key) && loan[key as keyof Loan] !== undefined) {
        formValue[key] = loan[key as keyof Loan];
      }
    });

    this.loanForm.patchValue(formValue);
  }

  // Calculate LTV when loan amount or property value changes
  calculateLtv(): void {
    const loanAmount = parseFloat(
      this.loanForm.get('loanAmount')?.value?.replace(/[^0-9.]/g, '') || '0'
    );
    const propertyValue = parseFloat(
      this.loanForm.get('propertyValue')?.value?.replace(/[^0-9.]/g, '') || '0'
    );

    if (propertyValue > 0) {
      const ltv = Math.round((loanAmount / propertyValue) * 100);
      this.loanForm.get('ltv')?.setValue(ltv);
    }
  }

  // Format currency input (for loanAmount and propertyValue)
  formatCurrency(event: any, controlName: string): void {
    const input = event.target;
    let value = input.value.replace(/[^0-9.]/g, '');

    if (value) {
      value = parseFloat(value)
        .toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
        .replace('$', '');

      this.loanForm
        .get(controlName)
        ?.setValue('$' + value, { emitEvent: false });
    }

    // Recalculate LTV if needed
    if (controlName === 'loanAmount' || controlName === 'propertyValue') {
      this.calculateLtv();
    }
  }

  // Submit the form to update the loan
  onSubmit(): void {
    if (this.loanForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.loanForm.controls).forEach((key) => {
        const control = this.loanForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);

    // Get form values and prepare for submission
    const formData = this.loanForm.value;

    // Ensure numeric values are properly formatted for Firestore
    if (typeof formData.loanAmount === 'string') {
      formData.loanAmount = formData.loanAmount.replace(/[^0-9.]/g, '');
    }

    if (typeof formData.propertyValue === 'string') {
      formData.propertyValue = formData.propertyValue.replace(/[^0-9.]/g, '');
    }

    if (typeof formData.sponsorsLiquidity === 'string') {
      formData.sponsorsLiquidity = formData.sponsorsLiquidity.replace(
        /[^0-9.]/g,
        ''
      );
    }

    // Add the property info back to the form data for updating
    // We don't modify these values, just preserve them
    const updatedLoan = {
      ...formData,
      propertyTypeCategory: this.propertyInfo().propertyTypeCategory,
      propertySubCategory: this.propertyInfo().propertySubCategory,
      transactionType: this.propertyInfo().transactionType,
      city: this.propertyInfo().city,
      state: this.propertyInfo().state,
    };

    // Update the loan
    this.loanService
      .updateLoan(this.loanId, updatedLoan)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          console.error('Error updating loan:', err);
          this.error.set('Failed to update loan: ' + err.message);
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(() => {
        this.success.set(true);
        this.loading.set(false);

        // Navigate back to dashboard after successful update
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1500);
      });
  }

  // Cancel editing and return to dashboard
  cancel(): void {
    this.router.navigate(['/dashboard']);
  }
}
