// src/app/services/promotion.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, debounceTime, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { 
  PromotionValidationRequest, 
  PromotionValidationResponse,
  CreatePromotionRequest,
  UpdatePromotionRequest,
  PromotionOperationResponse,
  PromotionListResponse
} from '../interfaces/promotion-code.interface';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { from } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
@Injectable({
  providedIn: 'root'
})
export class PromotionService {

  // Use a neutral base (no trailing slash, no function name)
  private readonly functionsBase =
    (environment.functionsBaseUrl || 'https://us-central1-loanpub.cloudfunctions.net').replace(/\/+$/, '');

  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  private readonly functions = getFunctions(undefined, 'us-central1');


  // Safe join helper
// Safe join helper
private endpoint = (path: string) => `${this.functionsBase}/${path.replace(/^\/+/, '')}`;


  constructor(private http: HttpClient) {}

   getPromotionCodes(): Observable<any> {
    return this.http.get(this.endpoint('getPromotionCodes'));
  }

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
  // ============================================
  // ADMIN METHODS (for admin dashboard)
  // ============================================

    getAllPromotionCodes(): Observable<PromotionListResponse> {
    return this.http.get<PromotionListResponse>(
      this.endpoint('getPromotionCodes'),
      { headers: this.headers }
    ).pipe(
      catchError((error) => {
        console.error('Error fetching promotion codes:', error);
        return of({ codes: [], total: 0 });
      })
    );
  }


    createPromotionCode(request: CreatePromotionRequest): Observable<PromotionOperationResponse> {
    return this.http.post<PromotionOperationResponse>(
      this.endpoint('createPromotionCode'),
      request,
      { headers: this.headers }
    ).pipe(
      catchError((error) => {
        console.error('Error creating promotion code:', error);
        return of({
          success: false,
          message: 'Failed to create promotion code',
          error: error?.error?.message || 'Unknown error'
        });
      })
    );
  }


   updatePromotionCode(id: string, request: UpdatePromotionRequest): Observable<PromotionOperationResponse> {
    return this.http.put<PromotionOperationResponse>(
      this.endpoint('updatePromotionCode'),
      { ...request, id },
      { headers: this.headers }
    ).pipe(
      catchError((error) => {
        console.error('Error updating promotion code:', error);
        return of({
          success: false,
          message: 'Failed to update promotion code',
          error: error?.error?.message || 'Unknown error'
        });
      })
    );
  }


  deletePromotionCode(id: string): Observable<PromotionOperationResponse> {
    return this.http.request<PromotionOperationResponse>(
      'DELETE',
      this.endpoint('deletePromotionCode'),
      {
        body: { id },
        headers: this.headers
      }
    ).pipe(
      catchError((error) => {
        console.error('Error deleting promotion code:', error);
        return of({
          success: false,
          message: 'Failed to delete promotion code',
          error: error?.error?.message || 'Unknown error'
        });
      })
    );
  }


  /**
   * Toggle promotion code active status (admin only)
   */
  togglePromotionCodeStatus(id: string, active: boolean): Observable<PromotionOperationResponse> {
    return this.updatePromotionCode(id, { active });
  }
}