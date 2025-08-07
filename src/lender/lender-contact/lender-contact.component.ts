import { Component, inject, Input, OnDestroy, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { StripeService } from '../../services/stripe.service';


interface StateOption {
  value: string;
  name: string;
}

@Component({
  selector: 'app-lender-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-contact.component.html',
  styleUrls: ['./lender-contact.component.css'],
})
export class LenderContactComponent implements OnDestroy {
  @Input() lenderForm!: FormGroup;
  @Input() states: StateOption[] = [];
  @Output() couponValidated = new EventEmitter<any>();

  private stripeService = inject(StripeService);
  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

 formatPhoneNumberOnInput(event: any): void {
  const input = event.target.value.replace(/\D/g, ''); // Strip non-digits
  const phoneControl = this.lenderForm.get('contactInfo.contactPhone');

  let formattedNumber = '';

  if (input.length <= 3) {
    formattedNumber = input;
  } else if (input.length <= 6) {
    formattedNumber = `(${input.substring(0, 3)}) ${input.substring(3)}`;
  } else {
    formattedNumber = `(${input.substring(0, 3)}) ${input.substring(3, 6)}-${input.substring(6, 10)}`;
  }

  // Set the formatted value
  phoneControl?.setValue(formattedNumber, { emitEvent: false });

  // Manual validation
  if (input.length === 10) {
    phoneControl?.setErrors(null);
  } else if (input.length > 0) {
    phoneControl?.setErrors({ invalidLength: true });
  }
}

formatPhoneNumber(): void {
  const phoneControl = this.lenderForm.get('contactInfo.contactPhone');
  if (!phoneControl?.value) return;

  const phoneNumber = phoneControl.value.replace(/\D/g, '');

  if (phoneNumber.length === 10) {
    const formatted = `(${phoneNumber.substring(0, 3)}) ${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6)}`;
    phoneControl.setValue(formatted, { emitEvent: false });
    phoneControl.setErrors(null);
  } else if (phoneNumber.length > 0) {
    phoneControl.setErrors({ invalidLength: true });
  }
}
}