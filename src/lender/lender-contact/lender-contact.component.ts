// lender-contact.component.ts

import {
  Component,
  inject,
  Input,
  OnDestroy,
  Output,
  EventEmitter,
  OnInit,
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
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
export class LenderContactComponent implements OnInit, OnDestroy {
  @Input() lenderForm!: FormGroup;
  @Input() states: StateOption[] = [];
  @Output() couponValidated = new EventEmitter<any>();

  private stripeService = inject(StripeService);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    if (!this.lenderForm) {
      console.error('❌ lenderForm input is required');
    }

    // Ensure contactPhone control exists to avoid runtime errors in formatting
    const phoneControl = this.lenderForm.get('contactInfo.contactPhone');
    if (!phoneControl) {
      console.warn('⚠️ contactPhone control not found in lenderForm');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formatPhoneNumberOnInput(event: any): void {
    const input = event.target.value.replace(/\D/g, '');
    const phoneControl = this.lenderForm.get('contactInfo.contactPhone');
    if (!phoneControl) return;

    let formattedNumber = '';
    if (input.length <= 3) {
      formattedNumber = input;
    } else if (input.length <= 6) {
      formattedNumber = `(${input.substring(0, 3)}) ${input.substring(3)}`;
    } else {
      formattedNumber = `(${input.substring(0, 3)}) ${input.substring(3, 6)}-${input.substring(6, 10)}`;
    }

    phoneControl.setValue(formattedNumber, { emitEvent: false });

    if (input.length === 10) {
      phoneControl.setErrors(null);
    } else if (input.length > 0) {
      phoneControl.setErrors({ invalidLength: true });
    }
  }
  onPhoneInput(event: Event): void {
  const inputElement = event.target as HTMLInputElement;
  const rawValue = inputElement.value.replace(/\D/g, ''); // Strip non-digits
  const control = this.lenderForm.get('contactPhone');
  if (!control) return;

  let formatted = '';
  if (rawValue.length <= 3) {
    formatted = rawValue;
  } else if (rawValue.length <= 6) {
    formatted = `(${rawValue.slice(0, 3)}) ${rawValue.slice(3)}`;
  } else {
    formatted = `(${rawValue.slice(0, 3)}) ${rawValue.slice(3, 6)}-${rawValue.slice(6, 10)}`;
  }

  control.setValue(formatted, { emitEvent: false });

  // Set validation manually if user types slowly
  if (rawValue.length === 10) {
    control.setErrors(null);
  } else if (rawValue.length > 0) {
    control.setErrors({ invalidLength: true });
  }
}

allowOnlyDigits(event: KeyboardEvent): void {
  const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
  const isDigit = /^[0-9]$/.test(event.key);

  if (!isDigit && !allowedKeys.includes(event.key)) {
    event.preventDefault();
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
