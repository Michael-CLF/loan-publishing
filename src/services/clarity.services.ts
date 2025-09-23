// src/app/services/clarity.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

declare global {
  interface Window {
    clarity: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class ClarityService {
  private clarityId = environment.clarityProjectId;
  private isInitialized = false;

  initializeClarity(): void {
    if (this.isInitialized || !this.clarityId) {
      return;
    }

    try {
      // Load Clarity script dynamically
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.innerHTML = `
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${this.clarityId}");
      `;
      document.head.appendChild(script);
      
      this.isInitialized = true;
      console.log('Clarity initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Clarity:', error);
    }
  }

  identifyUser(userId: string, customData?: Record<string, any>): void {
    if (this.isInitialized && window.clarity) {
      if (customData) {
        window.clarity('identify', userId, customData);
      } else {
        window.clarity('identify', userId);
      }
    }
  }

  setCustomTag(key: string, value: string): void {
    if (this.isInitialized && window.clarity) {
      window.clarity('set', key, value);
    }
  }

  upgradeSession(reason: string): void {
    if (this.isInitialized && window.clarity) {
      window.clarity('upgrade', reason);
    }
  }
}