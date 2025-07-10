import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

@Injectable({
  providedIn: 'root'
})
export class AppCheckService {
  private readonly app = inject(FirebaseApp);
  private initialized = false;

  /**
   * Initialize App Check with reCAPTCHA v3 provider
   * Following Angular 18 best practices with dependency injection
   */
  initializeAppCheck(): void {
    if (this.initialized) {
      console.log('App Check already initialized');
      return;
    }

    try {
      initializeAppCheck(this.app, {
        provider: new ReCaptchaV3Provider('6LfWCEwrAAAAABlc_Prf6WpaYX00VC0512hkSWyw'),
        isTokenAutoRefreshEnabled: true,
      });

      this.initialized = true;
      console.log('✅ App Check initialized with reCAPTCHA v3');
    } catch (error) {
      console.error('❌ Failed to initialize App Check:', error);
    }
  }
}