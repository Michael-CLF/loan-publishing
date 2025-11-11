// src/app/services/promotion.service.ts (CLEANED VERSION)

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, debounceTime, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { environment } from '../environments/environment';
import {
  PromotionValidationResponse
} from '../interfaces/promotion-code.interface';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { from } from 'rxjs';
import { Auth } from '@angular/fire/auth';
// Removed unused imports: PromotionCode, CreatePromotionRequest, UpdatePromotionRequest, etc.

@Injectable({
  providedIn: 'root'
})
export class PromotionService {

  private readonly functionsBase =
    (environment.functionsBaseUrl || 'https://us-central1-loanpub.cloudfunctions.net').replace(/\/+$/, '');
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  private readonly functions = getFunctions(undefined, 'us-central1');
  private endpoint = (path: string) => `${this.functionsBase}/${path.replace(/^\/+/, '')}`;
  private readonly auth = inject(Auth);

  constructor(private http: HttpClient) { }

  // This is the public facing method used during registration
  validatePromotionCode(
    code: string,
    role: 'originator' | 'lender',
    interval: 'monthly' | 'annually'
  ): Observable<PromotionValidationResponse> {
    const cleanedCode = (code ?? '').trim().toUpperCase();

    // No code entered → treat as valid “no promo”
    if (!cleanedCode) {
      return of({
        valid: true,
        promo: {
          code: '',
          promoType: 'none',
          percentOff: null,
          durationInMonths: null,
          durationType: null,
          trialDays: null,
          onboardingFeeCents: null,
          promoExpiresAt: null,
          allowedIntervals: [interval],
          allowedRoles: [role],
          promoInternalId: null,
        }
      });
    }

    const fn = httpsCallable<{ code: string; role?: 'originator' | 'lender' }, any>(
      this.functions,
      'validatePromo'
    );

    return from(fn({ code: cleanedCode, role })).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      shareReplay(1),
      map((res): PromotionValidationResponse => {
        const data = res?.data || {};
        if (data?.ok === true) {
          // Callable returns minimal fields. Fill your interface with safe defaults.
          return {
            valid: true,
            promo: {
              code: cleanedCode,
              promoType: 'none',
              percentOff: null,
              durationInMonths: null,
              durationType: null,
              trialDays: null,
              onboardingFeeCents: null,
              promoExpiresAt: data.expiresAt ?? null,
              allowedIntervals: [interval],
              allowedRoles: Array.isArray(data.validFor) ? data.validFor : [role],
              promoInternalId: null,
            },
            error: null
          };
        }
        const err = data?.error || 'Invalid promotion code';
        return { valid: false, promo: null, error: err };
      }),
      catchError(() => of({
        valid: false,
        promo: null,
        error: 'Failed to validate promotion code. Please try again.'
      }))
    );
  }
}