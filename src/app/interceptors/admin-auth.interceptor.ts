// src/app/interceptors/admin-auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { from, switchMap } from 'rxjs';

export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  console.log('Interceptor running for:', req.url); // Debug log
  
  // Only add auth to Cloud Function requests
  if (!req.url.includes('cloudfunctions.net')) {
    return next(req);
  }

  // Skip OPTIONS requests
  if (req.method === 'OPTIONS') {
    return next(req);
  }

  const auth = inject(Auth);
  const user = auth.currentUser;
  
  console.log('Current user:', user); // Debug log
  
  if (!user) {
    console.log('No user - skipping auth');
    return next(req);
  }

  // Get the ID token and add it to the request
  return from(user.getIdToken()).pipe(
    switchMap(token => {
      console.log('Adding Bearer token');
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return next(authReq);
    })
  );
};