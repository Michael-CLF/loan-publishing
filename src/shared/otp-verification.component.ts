// src/app/shared/otp-verification/otp-verification.component.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { OTPService } from '../services/otp.service';

@Component({
  selector: 'app-otp-verification',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './otp-verification.component.html',
  styleUrls: ['./otp-verification.component.css'],
})
export class OtpVerificationComponent implements OnInit {
  // services
  public otpService = inject(OTPService);

  // inputs/outputs
  @Input() email!: string;
  @Input() context: 'login' | 'registration' = 'registration';
  @Output() verified = new EventEmitter<void>();

  // state signals
  errorMessage = signal<string>('');
  codeDigits = signal<string[]>(['', '', '', '', '', '']);
  timeRemaining = computed(() => this.otpService.formatTimeRemaining());
  isLoading = computed(() => this.otpService.isLoading());

  ngOnInit(): void {
    if (this.email) {
      console.log('📨 Sending OTP to', this.email);
      this.otpService.sendOTP(this.email).subscribe({
        next: () => {
          console.log('✅ OTP sent for', this.context);
        },
        error: (err) => {
          console.error('❌ OTP send error:', err);
          this.errorMessage.set('Failed to send code. Please try again.');
        },
      });
    }
  }

  // used by *ngFor trackBy to keep inputs stable
  trackIndex(index: number): number {
    return index;
  }

  /**
   * Handles typing in a single OTP box.
   * - restricts to 1 numeric char
   * - writes that char to the correct index
   * - moves focus forward
   * - triggers verify if last box filled
   */
  onCodeDigitInput(index: number, event: any): void {
    const raw = event.target.value ?? '';
    const val = raw.replace(/\D/g, '').slice(0, 1); // numeric, single char

    // clone current digits and update just this index
    const digits = this.codeDigits().slice();
    digits[index] = val;
    this.codeDigits.set(digits);

    // force DOM value for this box so DOM and model agree
    event.target.value = val;

    // auto-advance if we entered something and we're not in the last box
    if (val && index < 5) {
      const nextEl = document.getElementById(`otp-${index + 1}`) as HTMLInputElement | null;
      nextEl?.focus();
      nextEl?.select();
    }

    // if last box filled, try verify automatically
    if (index === 5 && val) {
      this.tryVerify();
    }
  }

  /**
   * Handles backspace behavior:
   * - if current box has a digit, clear it
   * - otherwise move back to previous box and clear that
   */
  onCodeDigitKeydown(index: number, e: KeyboardEvent): void {
    if (e.key === 'Backspace') {
      e.preventDefault();

      const digits = this.codeDigits().slice();

      if (digits[index]) {
        // clear current box
        digits[index] = '';
        this.codeDigits.set(digits);

        const el = document.getElementById(`otp-${index}`) as HTMLInputElement | null;
        if (el) {
          el.value = '';
          el.focus();
          el.select();
        }
      } else if (index > 0) {
        // move back a box and clear that box too
        digits[index - 1] = '';
        this.codeDigits.set(digits);

        const prevEl = document.getElementById(`otp-${index - 1}`) as HTMLInputElement | null;
        if (prevEl) {
          prevEl.value = '';
          prevEl.focus();
          prevEl.select();
        }
      }
    }
  }

  /**
   * Allows pasting a full code.
   * - fills up to 6 digits
   * - updates DOM for each box
   * - auto verifies if we got all 6
   */
  onCodePaste(e: ClipboardEvent): void {
    e.preventDefault();

    const pasted = e.clipboardData?.getData('text') || '';
    const cleaned = pasted.replace(/\D/g, '').slice(0, 6);
    if (!cleaned) return;

    // build array of exactly 6 slots
    const nextDigits = cleaned.split('');
    while (nextDigits.length < 6) {
      nextDigits.push('');
    }

    this.codeDigits.set(nextDigits);

    // reflect in DOM so UI matches state
    for (let i = 0; i < 6; i++) {
      const box = document.getElementById(`otp-${i}`) as HTMLInputElement | null;
      if (box) {
        box.value = nextDigits[i] || '';
      }
    }

    if (cleaned.length === 6) {
      // got full code
      this.tryVerify();
    } else {
      // focus first empty box
      const firstEmpty = nextDigits.findIndex((d) => d === '');
      const focusIndex = firstEmpty === -1 ? 5 : firstEmpty;
      const el = document.getElementById(`otp-${focusIndex}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  }

  /**
   * Resend the OTP to the same email.
   * Resets inputs.
   */
  resend(): void {
    this.errorMessage.set('');
    this.otpService.sendOTP(this.email).subscribe({
      next: () => {
        this.codeDigits.set(['', '', '', '', '', '']);
        const first = document.getElementById('otp-0') as HTMLInputElement | null;
        first?.focus();
      },
      error: (err) => {
        console.error('❌ Resend error:', err);
        this.errorMessage.set('Could not resend. Try again.');
      },
    });
  }

  /**
   * Try to verify the 6-digit code.
   * On success, emit `verified` so the parent (registration form)
   * can move on to Stripe checkout.
   */
  tryVerify(): void {
    const code = this.codeDigits().join('');
    if (code.length !== 6) {
      this.errorMessage.set('Enter all 6 digits');
      return;
    }

    this.errorMessage.set('');
    console.log('🔐 Verifying OTP for', this.email);

    this.otpService.verifyOTP(this.email, code).subscribe({
      next: () => {
        console.log('✅ OTP verified successfully');
        this.verified.emit();
      },
      error: (err) => {
        console.error('❌ Verify error:', err);
        this.errorMessage.set(err.message || 'Invalid code');
        this.codeDigits.set(['', '', '', '', '', '']);

        // focus first box again
        const first = document.getElementById('otp-0') as HTMLInputElement | null;
        first?.focus();
        first?.select();
      },
    });
  }
}
