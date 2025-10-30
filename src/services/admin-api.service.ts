// src/app/services/admin-api.service.ts
import { Injectable } from '@angular/core';

export interface AdminOverview {
  ok: boolean;
  originators: number;
  lenders: number;
  loans: number;
  activePromotions: number;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  async getOverview(): Promise<AdminOverview> {
    const resp = await fetch('/admin/overview', {
      method: 'GET',
      credentials: 'include'
    });
    if (!resp.ok) {
      throw new Error('UNAUTHORIZED_OR_ERROR');
    }
    return resp.json();
  }
}
