// src/app/components/admin/admin-billing/admin-billing.component.ts

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PromotionService } from '../../../services/promotion.service';
import {
  PromotionCode,
  CreatePromotionRequest,
  UpdatePromotionRequest,
  PromotionOperationResponse
} from '../../../interfaces/promotion-code.interface';

@Component({
  selector: 'app-admin-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-billing.component.html',
  styleUrls: ['./admin-billing.component.css']
})
export class AdminBillingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly promotionService = inject(PromotionService);
  private readonly fb = inject(FormBuilder);

  // State signals
  promotionCodes = signal<PromotionCode[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Modal state
  showCreateModal = signal(false);
  showEditModal = signal(false);
  selectedCode = signal<PromotionCode | null>(null);

  // Form
  promotionForm!: FormGroup;
  formLoading = signal(false);

  // Filters
  filterActive = signal<'all' | 'active' | 'inactive'>('all');
  searchTerm = signal('');

  ngOnInit(): void {
    this.initializeForm();
    this.loadPromotionCodes();

    // Check for query params
    const action = this.route.snapshot.queryParamMap.get('action');
    if (action === 'create') {
      this.openCreateModal();
    }
  }

 initializeForm(): void {
  this.promotionForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]+$/)]],
    name: ['', Validators.required],
    description: [''],
    type: ['percentage', Validators.required],
    value: [0, [Validators.required, Validators.min(1)]],
    validFor: [['originator'], Validators.required],
    validIntervals: [['monthly'], Validators.required],
    expiresAt: [''],
    maxUses: [null, [Validators.min(1)]],
    durationType: ['once', Validators.required],
    durationInMonths: [1, [Validators.min(1), Validators.max(36)]]
  });


    // ADD THIS RIGHT AFTER LINE 69:
    this.promotionForm.get('type')?.valueChanges.subscribe(type => {
      const valueControl = this.promotionForm.get('value');
      if (type === 'free') {
        valueControl?.setValue(100);
        valueControl?.disable();
      } else {
        valueControl?.enable();
      }
    });
  }


  async loadPromotionCodes(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.promotionService.getAllPromotionCodes().toPromise();
      if (response) {
        this.promotionCodes.set(response.codes);
      }
    } catch (err: any) {
      this.error.set('Failed to load promotion codes');
      console.error('Error loading promotion codes:', err);
    } finally {
      this.loading.set(false);
    }
  }

  // Computed filtered codes
  get filteredCodes(): PromotionCode[] {
    let codes = this.promotionCodes();

    // Filter by active status
    const activeFilter = this.filterActive();
    if (activeFilter !== 'all') {
      codes = codes.filter(code =>
        activeFilter === 'active' ? code.active : !code.active
      );
    }

    // Filter by search term
    const search = this.searchTerm().toLowerCase();
    if (search) {
      codes = codes.filter(code =>
        code.code.toLowerCase().includes(search) ||
        code.name.toLowerCase().includes(search)
      );
    }

    return codes;
  }

  // Modal methods
  openCreateModal(): void {
    this.promotionForm.reset({
      type: 'percentage',
      validFor: ['originator', 'lender'],
      validIntervals: ['monthly', 'annually'],
      value: 0
    });
    this.showCreateModal.set(true);
  }

  openEditModal(code: PromotionCode): void {
  this.selectedCode.set(code);
  
  // Handle date formatting for the form
  let expiresAtValue = '';
  if (code.expiresAt) {
    // Handle Firestore Timestamp format
    if ((code.expiresAt as any)._seconds) {
      expiresAtValue = new Date((code.expiresAt as any)._seconds * 1000).toISOString().split('T')[0];
    } else {
      // Handle regular date string or Date object
      expiresAtValue = new Date(code.expiresAt).toISOString().split('T')[0];
    }
  }
  
  this.promotionForm.patchValue({
    code: code.code,
    name: code.name,
    description: code.description,
    type: code.type,
    value: code.value,
    validFor: code.validFor,
    validIntervals: code.validIntervals,
    expiresAt: expiresAtValue,
    maxUses: code.maxUses,
    durationType: code.durationType || 'once' || 'repeating' || 'forever',// Add this
    durationInMonths: code.durationInMonths || 1  // Add this
  });
  
  this.showEditModal.set(true);
}

  closeModals(): void {
    this.showCreateModal.set(false);
    this.showEditModal.set(false);
    this.selectedCode.set(null);
    this.promotionForm.reset();
  }

  // CRUD operations
  async createPromotion(): Promise<void> {
    if (this.promotionForm.invalid) return;

    this.formLoading.set(true);

    try {
      const formData = this.promotionForm.value;
      const request: CreatePromotionRequest = {
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        value: Number(formData.value),
        validFor: formData.validFor,
        validIntervals: formData.validIntervals,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
        maxUses: formData.maxUses || undefined
      };

      const response = await this.promotionService.createPromotionCode(request).toPromise();

      if (response?.success) {
        await this.loadPromotionCodes();
        this.closeModals();
        this.showSuccessMessage('Promotion code created successfully!');
      } else {
        this.error.set(response?.error || 'Failed to create promotion code');
      }
    } catch (err: any) {
      this.error.set('Failed to create promotion code');
      console.error('Create error:', err);
    } finally {
      this.formLoading.set(false);
    }
  }

  async updatePromotion(): Promise<void> {
    if (this.promotionForm.invalid || !this.selectedCode()) return;

    this.formLoading.set(true);

    try {
      const formData = this.promotionForm.value;
      const request: UpdatePromotionRequest = {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        value: Number(formData.value),
        validFor: formData.validFor,
        validIntervals: formData.validIntervals,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
        maxUses: formData.maxUses || undefined
      };

      const response = await this.promotionService.updatePromotionCode(
        this.selectedCode()!.id,
        request
      ).toPromise();

      if (response?.success) {
        await this.loadPromotionCodes();
        this.closeModals();
        this.showSuccessMessage('Promotion code updated successfully!');
      } else {
        this.error.set(response?.error || 'Failed to update promotion code');
      }
    } catch (err: any) {
      this.error.set('Failed to update promotion code');
      console.error('Update error:', err);
    } finally {
      this.formLoading.set(false);
    }
  }

  async toggleCodeStatus(code: PromotionCode): Promise<void> {
    try {
      const response = await this.promotionService.togglePromotionCodeStatus(
        code.id,
        !code.active
      ).toPromise();

      if (response?.success) {
        await this.loadPromotionCodes();
        this.showSuccessMessage(`Promotion code ${!code.active ? 'activated' : 'deactivated'}!`);
      }
    } catch (err: any) {
      this.error.set('Failed to toggle promotion code status');
      console.error('Toggle error:', err);
    }
  }

  async deleteCode(code: PromotionCode): Promise<void> {
    if (!confirm(`Are you sure you want to delete promotion code "${code.code}"?`)) {
      return;
    }

    try {
      const response = await this.promotionService.deletePromotionCode(code.id).toPromise();

      if (response?.success) {
        await this.loadPromotionCodes();
        this.showSuccessMessage('Promotion code deleted successfully!');
      }
    } catch (err: any) {
      this.error.set('Failed to delete promotion code');
      console.error('Delete error:', err);
    }
  }

  // Utility methods
  private showSuccessMessage(message: string): void {
    // You could implement a toast service here
    console.log('Success:', message);
  }

 formatDate(date: any): string {
  if (!date) return 'No expiration';
  
  try {
    // Handle Firestore Timestamp
    if (date._seconds) {
      return new Date(date._seconds * 1000).toLocaleDateString();
    }
    // Handle ISO string or Date object
    const d = new Date(date);
    return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString();
  } catch {
    return 'Invalid Date';
  }
}

  formatValue(code: PromotionCode): string {
    if (code.type === 'percentage') {
      return `${code.value}%`;
    } else if (code.type === 'fixed') {
      return `$${(code.value / 100).toFixed(2)}`;
    }
    return 'Free';
  }
  toggleValidFor(role: string): void {
    const currentValues = this.promotionForm.get('validFor')?.value || [];
    let newValues: string[];

    if (currentValues.includes(role)) {
      newValues = currentValues.filter((r: string) => r !== role);
    } else {
      newValues = [...currentValues, role];
    }

    this.promotionForm.patchValue({ validFor: newValues });
  }

  toggleValidInterval(interval: string): void {
    const currentValues = this.promotionForm.get('validIntervals')?.value || [];
    let newValues: string[];

    if (currentValues.includes(interval)) {
      newValues = currentValues.filter((i: string) => i !== interval);
    } else {
      newValues = [...currentValues, interval];
    }

    this.promotionForm.patchValue({ validIntervals: newValues });
  }

  trackByCode(index: number, code: PromotionCode): string {
    return code.id;
  }

  getStatusClass(code: PromotionCode): string {
    if (!code.active) return 'status-inactive';
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) return 'status-expired';
    return 'status-active';
  }

  // Navigation
  navigateBack(): void {
    this.router.navigate(['/admin']);
  }

  // Form validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.promotionForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.promotionForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['pattern']) return 'Code must contain only uppercase letters, numbers, and underscores';
      if (field.errors['minlength']) return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
      if (field.errors['min']) return `Value must be at least ${field.errors['min'].min}`;
    }
    return '';
  }
}