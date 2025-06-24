import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  FormControl,
  Validators,
} from '@angular/forms';
import {
  StateOption,
  LenderTypeOption,
  LoanTypes,
  SubCategory,
} from '../lender-registration/lender-registration.component';
import { FirestoreService } from 'src/services/firestore.service';
import { AuthService } from 'src/services/auth.service';
// ✅ CORRECT
import { PropertyCategory } from '../../shared/constants/property-mappings';


interface CountyInfo {
  state: string;
  stateName: string;
  counties: string[];
}

interface PropertyTypeInfo {
  category: string;
  subcategory: string;
}

@Component({
  selector: 'app-lender-review',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-review.component.html',
  styleUrls: ['./lender-review.component.css'],
})
export class LenderReviewComponent implements OnInit {
  private fb = inject(FormBuilder);
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);

  registrationForm!: FormGroup;
  currentStep = 1;
  emailValidated = false;

  @Input() selectedPropertyTypes: { category: string; subcategory: string }[] =
    [];
  groupedCategories: Array<{ categoryName: string; subcategories: string[] }> =
    [];
  @Input() lenderForm!: FormGroup;
  @Input() states: StateOption[] = [];
  @Input() lenderTypes: LenderTypeOption[] = [];
  @Input() propertyCategories: PropertyCategory[] = [];
  @Input() propertySubCategories: SubCategory[] = [];
  @Input() loanTypes: LoanTypes[] = [];
  selectedCounties: CountyInfo[] = [];

  ngOnInit() {
    // Extract selected counties
    this.processSelectedCounties();

    // Process property subcategories
    this.processPropertySubcategories();

    // Check if termsAccepted control exists
    if (!this.lenderForm.get('termsAccepted')) {
      console.log('Adding termsAccepted control to form');
      this.lenderForm.addControl(
        'termsAccepted',
        new FormControl(false, Validators.requiredTrue)
      );
    }

    const grouped = this.selectedPropertyTypes.reduce((acc, item) => {
      const { category, subcategory } = item;
      if (!acc[category]) acc[category] = [];
      acc[category].push(subcategory);
      return acc;
    }, {} as Record<string, string[]>);

    this.groupedCategories = Object.entries(grouped).map(
      ([category, subcategories]) => ({
        categoryName: this.getPropertyCategoryName(category),
        subcategories,
      })
    );

    // Log initial terms state
    console.log(
      'Terms control exists:',
      !!this.lenderForm.get('termsAccepted')
    );
    console.log(
      'Terms initially accepted:',
      this.lenderForm.get('termsAccepted')?.value
    );

    // Subscribe to terms changes
    this.lenderForm.get('termsAccepted')?.valueChanges.subscribe((value) => {
      console.log('Terms accepted changed to:', value);
    });
  }

  // Helper methods to get display values
  getStateName(stateCode: string): string {
    if (!stateCode) return 'Unknown';
    const state = this.states.find(
      (s) =>
        s.value === stateCode ||
        s.value.toLowerCase() === stateCode.toLowerCase()
    );
    return state ? state.name : stateCode;
  }

  getLenderTypeName(typeCode: string): string {
    if (!typeCode) return 'Unknown';
    const type = this.lenderTypes.find((t) => t.value === typeCode);
    return type ? type.name : typeCode;
  }

  getPropertyCategoryName(categoryCode: string): string {
    if (!categoryCode) return 'Unknown';
    const category = this.propertyCategories.find(
      (c) => c.value === categoryCode
    );
    return category ? category.name : categoryCode;
  }

  getLoanTypeName(typeCode: string): string {
    if (!typeCode) return 'Unknown';
    const type = this.loanTypes.find((t) => t.value === typeCode);
    return type ? type.name : typeCode;
  }

  // Process property subcategories
  processPropertySubcategories() {
    const propertyCategories = this.lenderForm.get(
      'productInfo.propertyCategories'
    )?.value;
    const propertyTypes = this.lenderForm.get(
      'productInfo.propertyTypes'
    )?.value;

    if (!propertyCategories || !propertyTypes) return;

    // If we have property categories but no types specifically selected
    // Let's show all subcategories for the selected categories
    if (propertyCategories.length > 0 && propertyTypes.length === 0) {
      propertyCategories.forEach((categoryCode: string) => {
        const category = this.propertyCategories.find(
          (c) => c.value === categoryCode
        );
        if (category && category.subcategories) {
         category.subcategories?.forEach((subcategory: { value: string; name: string }) => {
            this.selectedPropertyTypes.push({
              category: this.getPropertyCategoryName(categoryCode),
              subcategory: subcategory.name,
            });
          });
        }
      });
    } else {
      // Process selected property types if they exist
      propertyTypes.forEach((typeCode: string) => {
        // Find which category this subcategory belongs to
        for (const category of this.propertyCategories) {
          const foundSubcategory = category.subcategories?.find(
            (sc: { value: string; name: string }) => sc.value === typeCode

          );
          if (foundSubcategory) {
            this.selectedPropertyTypes.push({
              category: category.name,
              subcategory: foundSubcategory.name,
            });
            break;
          }
        }
      });
    }
  }

  // Process selected counties from the complex form structure
  processSelectedCounties() {
    const statesData = this.lenderForm.get('footprintInfo.states')?.value;

    if (!statesData) return;

    // Loop through all state entries to find selected states and their counties
    Object.keys(statesData).forEach((key) => {
      // Skip the "_counties" entries, we'll process them with their parent state
      if (key.includes('_counties')) return;

      // If the state is selected (true)
      if (statesData[key] === true) {
        const stateCode = key;
        const stateName = this.getStateName(stateCode);
        const countiesKey = `${stateCode}_counties`;
        const countiesData = statesData[countiesKey];

        if (!countiesData) return;

        // Get all selected counties for this state
        const selectedCounties = Object.keys(countiesData)
          .filter((countyKey) => countiesData[countyKey] === true)
          .map((countyKey) => {
            // Convert kebab-case to Title Case for display
            return countyKey
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          });

        if (selectedCounties.length > 0) {
          this.selectedCounties.push({
            state: stateCode,
            stateName: stateName,
            counties: selectedCounties,
          });
        }
      }
    });
  }

  // Check if there are any property subcategories selected
  hasPropertySubcategories(): boolean {
    return this.selectedPropertyTypes.length > 0;
  }

  // Check if there are any counties selected
  hasCounties(): boolean {
    return this.selectedCounties.length > 0;
  }

  // Format currency properly
  formatCurrency(value: string | number): number {
    if (!value) return 0;
    // Remove all non-digit characters except for decimal point
    const cleanValue = value.toString().replace(/[^0-9.]/g, '');
    return parseFloat(cleanValue) || 0;
  }

  // Handle terms of service link click
  onTermsClick(event: Event): void {
    console.log('Terms of Service link clicked');
    // Don't prevent default behavior - let it open in new tab

    // Log for debugging
    const target = event.target as HTMLAnchorElement;
    console.log('Terms link href:', target.href);
  }

  // Handle terms checkbox click directly
  onTermsCheckboxChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    console.log('Terms checkbox clicked, new value:', checkbox.checked);

    // Make sure form control is updated
    const termsControl = this.lenderForm.get('termsAccepted');
    if (termsControl) {
      // Only update if different to avoid infinite loop with valueChanges subscription
      if (termsControl.value !== checkbox.checked) {
        termsControl.setValue(checkbox.checked);
        termsControl.markAsTouched();
        termsControl.updateValueAndValidity();
      }
    } else {
      console.error('Terms control not found in form');
    }
  }

  // Method to check if form is valid including terms
  isFormValid(): boolean {
    // Make sure all controls are marked as touched to show validation errors
    this.markFormGroupTouched(this.lenderForm);

    // Specifically check terms
    const termsAccepted = this.lenderForm.get('termsAccepted')?.value === true;

    // Log validation status
    console.log('Form valid:', this.lenderForm.valid);
    console.log('Terms accepted:', termsAccepted);

    return this.lenderForm.valid && termsAccepted;
  }

  // Helper method to mark all form controls as touched
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }

      if (control instanceof FormArray) {
        control.controls.forEach((arrayControl) => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          } else {
            arrayControl.markAsTouched();
          }
        });
      }
    });
  }
}
