import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FirebaseApp } from '@angular/fire/app';

@Injectable({
  providedIn: 'root'
})
export class AppCheckService {
  private readonly app = inject(FirebaseApp);
  private readonly platformId = inject(PLATFORM_ID);
  private initialized = false;

  /**
   * Initialize App Check with reCAPTCHA v3 provider
   * Following Angular 18 best practices with dependency injection
   */
  async initializeAppCheck(): Promise<void> {
    if (this.initialized) {
      console.log('App Check already initialized');
      return;
    }

    // Only initialize in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      console.log('App Check skipped - not in browser');
      return;
    }

    try {
      // Dynamic import to ensure it only runs in browser
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');

      // Verify we have the Firebase app
      if (!this.app) {
        throw new Error('Firebase app not available');
      }

      console.log('Initializing App Check with reCAPTCHA...');

      initializeAppCheck(this.app, {
        provider: new ReCaptchaV3Provider('6LfWCEwrAAAAABlc_Prf6WpaYX00VC0512hkSWyw'),
        isTokenAutoRefreshEnabled: true,
      });

      this.initialized = true;
      console.log('✅ App Check initialized with reCAPTCHA v3');
    } catch (error) {
      console.error('❌ Failed to initialize App Check:', error);
      throw error; // Re-throw to handle in component
    }
  }
}