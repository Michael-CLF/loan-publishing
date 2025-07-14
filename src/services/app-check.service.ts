import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FirebaseApp } from '@angular/fire/app';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AppCheckService {
  private readonly app = inject(FirebaseApp);
  private readonly platformId = inject(PLATFORM_ID);
  private initialized = false;
  private appCheckInstance: any = null;

  /**
   * Initialize App Check with reCAPTCHA v3 provider
   * Uses environment configuration for the site key
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

    // Validate environment configuration
    if (!environment.appCheckSiteKey) {
      console.error('❌ App Check site key not found in environment configuration.');
      return;
    }

    try {
      const { initializeAppCheck, ReCaptchaV3Provider, getToken } = await import('firebase/app-check');

      if (!this.app) {
        throw new Error('Firebase app not found.');
      }

      console.log('🟢 Initializing Firebase App Check with reCAPTCHA V3...');

      this.appCheckInstance = initializeAppCheck(this.app, {
        provider: new ReCaptchaV3Provider(environment.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });

      this.initialized = true;
      console.log('✅ App Check initialized successfully.');

      // Optional: manually get a token to confirm (only in development)
      if (!environment.production) {
        try {
          const tokenResult = await getToken(this.appCheckInstance, false);
          console.log('🔐 App Check token obtained:', tokenResult.token ? 'Success' : 'Failed');
        } catch (tokenError) {
          console.warn('⚠️ Could not obtain App Check token:', tokenError);
        }
      }

    } catch (error) {
      console.error('❌ App Check failed to initialize:', error);
      
      // In production, you might want to handle this gracefully
      if (environment.production) {
        // Could send error to monitoring service
        console.error('App Check initialization failed in production');
      }
    }
  }

  /**
   * Get the current App Check instance
   * @returns App Check instance or null if not initialized
   */
  getAppCheckInstance() {
    return this.appCheckInstance;
  }

  /**
   * Check if App Check is initialized
   * @returns boolean indicating initialization status
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Force refresh the App Check token
   * @returns Promise that resolves when token is refreshed
   */
  async refreshToken(): Promise<void> {
    if (!this.initialized || !this.appCheckInstance) {
      throw new Error('App Check not initialized. Call initializeAppCheck() first.');
    }

    try {
      const { getToken } = await import('firebase/app-check');
      await getToken(this.appCheckInstance, true); // Force refresh
      console.log('🔄 App Check token refreshed successfully.');
    } catch (error) {
      console.error('❌ Failed to refresh App Check token:', error);
      throw error;
    }
  }
}