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
   */
  async initializeAppCheck(): Promise<void> {
    if (this.initialized) {
      console.log('🟡 App Check already initialized.');
      return;
    }

    if (!isPlatformBrowser(this.platformId)) {
      console.log('⚪ Skipping App Check – not running in browser.');
      return;
    }

    try {
      const { initializeAppCheck, ReCaptchaV3Provider, getToken } = await import('firebase/app-check');

      if (!this.app) {
        throw new Error('Firebase app not found.');
      }

      console.log('🟢 Initializing Firebase App Check with reCAPTCHA V3...');

      const appCheckInstance = initializeAppCheck(this.app, {
        provider: new ReCaptchaV3Provider('6LfWCEwrAAAAABlc_Prf6WpaYX00VC0512hkSWyw'), // replace if needed
        isTokenAutoRefreshEnabled: true,
      });

      this.initialized = true;

      console.log('✅ App Check initialized.');

      // Optional: manually get a token to confirm
      const tokenResult = await getToken(appCheckInstance, false);
      console.log('🔐 App Check token:', tokenResult.token);

    } catch (error) {
      console.error('❌ App Check failed to initialize:', error);
    }
  }
}
