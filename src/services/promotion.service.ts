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

    // If no code entered, treat as "no promo" and valid
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

    const request: PromotionValidationRequest = {
      code: cleanedCode,
      role,
      interval
    };

    return this.http
      .post<PromotionValidationResponse>(
        this.endpoint('validatePromotionCode'),
        request,
        { headers: this.headers }
      )
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        shareReplay(1),
        map((response): PromotionValidationResponse => {
          // Backend will send a normalized shape. We just trust it.
          // Expected success shape (example):
          // {
          //   valid: true,
          //   promo: {
          //     code: 'LENDER2025',
          //     promoType: 'percentage' | 'trial' | 'none',
          //     percentOff: 100,
          //     durationInMonths: 3,
          //     durationType: 'repeating',
          //     trialDays: null,
          //     onboardingFeeCents: 6900,
          //     promoExpiresAt: 1735622400000,
          //     allowedIntervals: ['monthly'],
          //     allowedRoles: ['lender'],
          //     promoInternalId: 'signed-server-token-or-id'
          //   },
          //   error: null
          // }
          //
          // Expected failure shape (example):
          // {
          //   valid: false,
          //   promo: null,
          //   error: 'Code expired'
          // }

          if (response?.valid && response?.promo) {
            return {
              valid: true,
              promo: {
                code: response.promo.code ?? cleanedCode,
                promoType: response.promo.promoType,
                percentOff: response.promo.percentOff ?? null,
                durationInMonths: response.promo.durationInMonths ?? null,
                durationType: response.promo.durationType ?? null,
                trialDays: response.promo.trialDays ?? null,
                onboardingFeeCents: response.promo.onboardingFeeCents ?? null,
                promoExpiresAt: response.promo.promoExpiresAt ?? null,
                allowedIntervals: response.promo.allowedIntervals ?? [interval],
                allowedRoles: response.promo.allowedRoles ?? [role],
                promoInternalId: response.promo.promoInternalId ?? null,
              },
              error: null
            };
          }

          return {
            valid: false,
            promo: null,
            error: response?.error || 'Invalid promotion code'
          };
        }),
        catchError((error) => {
          console.error('Error validating promotion code:', error);
          return of({
            valid: false,
            promo: null,
            error: 'Failed to validate promotion code. Please try again.'
          });
        })
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