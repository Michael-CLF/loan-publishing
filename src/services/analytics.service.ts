import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

declare global {
  interface Window {
    dataLayer: any[];
    google_tag_manager: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private dataLayerReady = false;
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      // Check if dataLayer exists on window (not just in scope)
      this.initializeDataLayer();
    }
  }

  private initializeDataLayer(): void {
    // Ensure dataLayer exists on window object
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      this.dataLayerReady = true;
      
      // Verify GTM is loaded (for debugging)
      if (window.google_tag_manager) {
        console.log('✅ GTM is loaded:', Object.keys(window.google_tag_manager));
      } else {
        console.log('⏳ GTM is still loading (async)');
      }
    }
  }

  public trackEvent(eventName: string, parameters?: any): void {
  if (isPlatformBrowser(this.platformId)) {
    // Cast window to any to avoid TypeScript issues
    const win = window as any;
    
    // Re-check dataLayer directly
    if (win.dataLayer && Array.isArray(win.dataLayer)) {
      win.dataLayer.push({
        event: eventName,
        ...parameters
      });
      
      console.log('📊 Event pushed to dataLayer:', {
        event: eventName,
        ...parameters,
        dataLayerSize: win.dataLayer.length
      });
    } else {
      console.warn('⚠️ DataLayer not ready, attempting to initialize...');
      this.initializeDataLayer();
      
      // Retry once after initialization
      const winRetry = window as any;
      if (winRetry.dataLayer && Array.isArray(winRetry.dataLayer)) {
        winRetry.dataLayer.push({
          event: eventName,
          ...parameters
        });
      }
    }
  }
}


  public trackButtonClick(buttonName: string, section?: string): void {
    this.trackEvent('button_click', {
      button_name: buttonName,
      section: section || 'unknown',
      timestamp: new Date().toISOString()
    });
  }

  public trackFormSubmit(formName: string, formData?: any): void {
    this.trackEvent('form_submit', {
      form_name: formName,
      form_valid: true,
      timestamp: new Date().toISOString(),
      field_count: formData ? Object.keys(formData).length : 0
    });
  }

  public trackPageView(pagePath: string, pageTitle?: string): void {
    this.trackEvent('page_view', {
      page_path: pagePath,
      page_title: pageTitle || document.title,
      page_location: window.location.href
    });
  }
}