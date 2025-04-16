import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LenderFormService {
  private formData = {
    contact: null,
    product: null,
    footprint: null,
  };

  setFormSection(section: 'contact' | 'product' | 'footprint', data: any) {
    this.formData[section] = data;
  }

  getFormSection(section: 'contact' | 'product' | 'footprint') {
    return this.formData[section];
  }

  getFullForm() {
    return { ...this.formData };
  }

  clearForm() {
    this.formData = { contact: null, product: null, footprint: null };
  }
}
