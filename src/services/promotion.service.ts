// src/app/services/promotion.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, debounceTime, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { 
  PromotionValidationRequest, 
  PromotionValidationResponse,
  PromotionCode,
  CreatePromotionRequest,
  UpdatePromotionRequest,
  PromotionOperationResponse,
  PromotionListResponse
} from '../interfaces/promotion-code.interface';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly functionsUrl = environment.stripeCheckoutUrl || 'https://us-central1-loanpub.cloudfunctions.net';
  
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });

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
      `${this.functionsUrl}/validatePromotionCode`,
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

  /**
   * Get all promotion codes (admin only)
   */
  getAllPromotionCodes(): Observable<PromotionListResponse> {
    return this.http.get<PromotionListResponse>(
      `${this.functionsUrl}/getPromotionCodes`,
      { headers: this.headers }
    ).pipe(
      catchError((error) => {
        console.error('Error fetching promotion codes:', error);
        return of({ codes: [], total: 0 });
      })
    );
  }

  /**
   * Create a new promotion code (admin only)
   */
  createPromotionCode(request: CreatePromotionRequest): Observable<PromotionOperationResponse> {
    return this.http.post<PromotionOperationResponse>(
      `${this.functionsUrl}/createPromotionCode`,
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

  /**
   * Update an existing promotion code (admin only)
   */
  updatePromotionCode(id: string, request: UpdatePromotionRequest): Observable<PromotionOperationResponse> {
    return this.http.put<PromotionOperationResponse>(
      `${this.functionsUrl}/updatePromotionCode/${id}`,
      request,
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

  /**
   * Delete a promotion code (admin only)
   */
  deletePromotionCode(id: string): Observable<PromotionOperationResponse> {
    return this.http.delete<PromotionOperationResponse>(
      `${this.functionsUrl}/deletePromotionCode/${id}`,
      { headers: this.headers }
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