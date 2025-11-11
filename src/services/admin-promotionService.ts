// src/app/services/admin-promotion.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import {
  CreatePromotionRequest,
  UpdatePromotionRequest,
  PromotionOperationResponse,
  PromotionListResponse,
  PromotionCode
} from '../interfaces/promotion-code.interface';
import { Auth, authState, User } from '@angular/fire/auth'; // Imports needed for async safety

@Injectable({
  providedIn: 'root'
})
export class AdminPromotionService {

  private readonly functionsBase =
    (environment.functionsBaseUrl || 'https://us-central1-loanpub.cloudfunctions.net').replace(/\/+$/, '');
  private endpoint = (path: string) => `${this.functionsBase}/${path.replace(/^\/+/, '')}`;
  private readonly auth = inject(Auth);

  constructor(private http: HttpClient) { }

  // Helper function to safely wait for the Firebase User state (the essential async check)
  private getCurrentUser$(): Observable<User | null> {
    return authState(this.auth);
  }

  // ============================================
  // ADMIN MANAGEMENT METHODS
  // ============================================

  getAllPromotionCodes(): Observable<{ codes: PromotionCode[] }> {
    // ASYNC CHECK: Safely wait for the Admin user object to be loaded
    return this.getCurrentUser$().pipe(
      switchMap(user => {
        if (!user) {
          console.error('Admin user not authenticated');
          return of({ codes: [] });
        }

        // HTTP CALL: Simple GET (relying on Admin Auth Guard/Interceptor for cookies/session)
        return this.http.get<PromotionListResponse>(
          this.endpoint('getPromotionCodes')
        );
      }),
      map(response => ({
        codes: response?.codes || []
      })),
      catchError((error) => {
        console.error('Error fetching promotion codes:', error);
        return of({ codes: [] });
      })
    );
  }

  createPromotionCode(request: CreatePromotionRequest): Observable<PromotionOperationResponse> {
    return this.getCurrentUser$().pipe(
      switchMap(user => {
        if (!user) {
          return of({
            success: false,
            message: 'Not authenticated',
            error: 'User not authenticated'
          });
        }

        // HTTP CALL: Simple POST
        return this.http.post<PromotionOperationResponse>(
          this.endpoint('createPromotionCode'),
          request
        );
      }),
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
    return this.getCurrentUser$().pipe(
      switchMap(user => {
        if (!user) {
          return of({
            success: false,
            message: 'Not authenticated',
            error: 'User not authenticated'
          });
        }

        // HTTP CALL: Simple PUT
        return this.http.put<PromotionOperationResponse>(
          this.endpoint('updatePromotionCode'),
          { ...request, id }
        );
      }),
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
    return this.getCurrentUser$().pipe(
      switchMap(user => {
        if (!user) {
          return of({
            success: false,
            message: 'Not authenticated',
            error: 'User not authenticated'
          });
        }

        // HTTP CALL: Simple DELETE
        return this.http.request<PromotionOperationResponse>(
          'DELETE',
          this.endpoint('deletePromotionCode'),
          {
            body: { id }
          }
        );
      }),
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

  togglePromotionCodeStatus(id: string, active: boolean): Observable<PromotionOperationResponse> {
    return this.updatePromotionCode(id, { active });
  }
}