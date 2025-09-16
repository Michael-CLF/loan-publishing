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

  /**
   * Validate a promotion code for user registration
   */
  validatePromotionCode(
    code: string,
    role: 'originator' | 'lender',
    interval: 'monthly' | 'annually'
  ): Observable<PromotionValidationResponse> {
    const cleanedCode = (code ?? '').trim().toUpperCase();

    if (!cleanedCode) {
      return of({ valid: true }); // No code = valid (no discount)
    }

    const request: PromotionValidationRequest = {
      code: cleanedCode,
      role,
      interval
    };

    return this.http.post<PromotionValidationResponse>(
  this.endpoint('validatePromotionCode'),
  request,
  { headers: this.headers }
).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      shareReplay(1),
      map((response): PromotionValidationResponse => {
        // Ensure consistent response format
        if (response?.valid && response?.promotion_code) {
          return {
            valid: true,
            promotion_code: {
              code: response.promotion_code.code ?? cleanedCode,
              id: response.promotion_code.id,
              coupon: { ...(response.promotion_code.coupon ?? {}) }
            }
          };
        }

        return {
          valid: false,
          error: response?.error || 'Invalid promotion code'
        };
      }),
      catchError((error) => {
        console.error('Error validating promotion code:', error);
        return of({
          valid: false,
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