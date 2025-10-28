// lender-product.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  ReactiveFormsModule,
  AbstractControl,
  FormArray,
  FormControl,
} from '@angular/forms';
import { CurrencyPipe } from '@angular/common';

export interface LoanTypes {
  value: string;
  name: string;
}

@Component({
  selector: 'app-lender-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [CurrencyPipe],
  templateUrl: './lender-product.component.html',
  styleUrls: ['./lender-product.component.css'],
})
export class LenderProductComponent implements OnInit {
  @Input() lenderForm!: FormGroup;

  // Initialize with empty arrays to prevent template errors
  @Input() lenderTypes: { value: string; name: string }[] = [];
  @Input() propertyCategories: {
    value: string;
    name: string;
    subcategories: { name: string; value: string }[];
  }[] = [];
  @Input() states: { value: string; name: string }[] = [];
  @Input() loanTypes: LoanTypes[] = [];
  expandedCategory: string | null = null;

  constructor(private currencyPipe: CurrencyPipe) { }

  ngOnInit(): void {
    console.log('LenderProductComponent initialized with data:', {
      lenderTypesCount: this.lenderTypes?.length || 0,
      propertyCategoriesCount: this.propertyCategories?.length || 0,
      loanTypesCount: this.loanTypes?.length || 0
    });

    if (!this.lenderForm) {
      console.error('LenderProductComponent: lenderForm (productInfo) is missing');
      return;
    }
    // Trigger validity so parent "Next" button [disabled] works
    this.lenderForm.updateValueAndValidity();
  }

  // Convenience getters for FormArrays
  get lenderTypesArray(): FormArray {
    return this.lenderForm.get('lenderTypes') as FormArray;
  }

  get propertyCategoriesArray(): FormArray {
    return this.lenderForm.get('propertyCategories') as FormArray;
  }

  get subcategorySelectionsArray(): FormArray {
    return this.lenderForm.get('subcategorySelections') as FormArray;
  }

  get loanTypesArray(): FormArray {
    return this.lenderForm.get('loanTypes') as FormArray;
  }

  // helpers
  getControl(name: string): AbstractControl | null {
    return this.lenderForm.get(name);
  }

 // Helper methods for template
isControlInvalid(controlName: string): boolean {
  const control = this.lenderForm.get(controlName);
  return !!control && control.invalid && (control.dirty || control.touched);
}

isOptionSelected(formArrayName: string, value: string): boolean {
  const formArray = this.lenderForm.get(formArrayName) as FormArray;
  if (!formArray) return false;

  return formArray.controls.some((ctrl) => {
    const v = ctrl.value;
    if (typeof v === 'object' && v !== null) {
      return v.value === value;
    }
    return v === value;
  });
}

isAnyLenderTypeSelected(): boolean {
  return this.lenderTypesArray.length > 0;
}

isLenderTypeDisabled(value: string): boolean {
  return (
    this.isAnyLenderTypeSelected() &&
    !this.isOptionSelected('lenderTypes', value)
  );
}

isLoanTypeSelected(loanTypeValue: string): boolean {
  return this.isOptionSelected('loanTypes', loanTypeValue);
}

getSelectedSubcategoriesCount(categoryValue: string): number {
  return this.subcategorySelectionsArray.controls.filter((ctrl) => {
    const val = ctrl.value as string;
    return val && val.startsWith(categoryValue + ':');
  }).length;
}

isSubOptionSelected(categoryValue: string, subValue: string): boolean {
  const combined = `${categoryValue}:${subValue}`;
  return this.subcategorySelectionsArray.controls.some(
    (ctrl) => ctrl.value === combined
  );
}

allSubcategoriesSelected(categoryValue: string): boolean {
  const cat = this.propertyCategories.find((c) => c.value === categoryValue);
  if (!cat || !cat.subcategories?.length) return false;

  return (
    this.getSelectedSubcategoriesCount(categoryValue) ===
    cat.subcategories.length
  );
}

 

  // UI actions
  onLenderTypeChange(event: Event, value: string): void {
    event.stopPropagation();

    // enforce "one lender type max"
    while (this.lenderTypesArray.length) {
      this.lenderTypesArray.removeAt(0);
    }

    const obj = this.lenderTypes.find((t) => t.value === value);
    if (obj) {
      this.lenderTypesArray.push(new FormControl(obj));
    }

    this.touchAndValidate();
  }

  toggleCategory(categoryValue: string): void {
    const already = this.isOptionSelected('propertyCategories', categoryValue);

    if (!already) {
      // Store the full category object, not just the value
      const categoryObj = this.propertyCategories.find(c => c.value === categoryValue);
      if (categoryObj) {
        this.propertyCategoriesArray.push(new FormControl(categoryObj));
      }
      this.expandedCategory = categoryValue;
    } else {
      // remove category - check for both object and string values
      const idx = this.propertyCategoriesArray.controls.findIndex(
        (c) => {
          const val = c.value;
          return typeof val === 'object' ? val.value === categoryValue : val === categoryValue;
        }
      );
      if (idx !== -1) this.propertyCategoriesArray.removeAt(idx);

      // also drop all its subcategories
      this.removeAllSubcategories(categoryValue);

      if (this.expandedCategory === categoryValue) {
        this.expandedCategory = null;
      }
    }

    this.touchAndValidate();
  }


  toggleLoanType(event: Event, loanTypeValue: string): void {
    event.stopPropagation();

    const isSelected = this.isLoanTypeSelected(loanTypeValue);

    const obj = this.loanTypes.find((lt) => lt.value === loanTypeValue);

    if (!isSelected && obj) {
      this.loanTypesArray.push(new FormControl(obj));
    } else {
      const idx = this.loanTypesArray.controls.findIndex((ctrl) =>
        typeof ctrl.value === 'object'
          ? ctrl.value.value === loanTypeValue
          : ctrl.value === loanTypeValue
      );
      if (idx !== -1) this.loanTypesArray.removeAt(idx);
    }

    this.touchAndValidate();
  }

  toggleSubcategory(
    event: Event,
    categoryValue: string,
    subValue: string
  ): void {
    const combined = `${categoryValue}:${subValue}`;

    const idx = this.subcategorySelectionsArray.controls.findIndex(
      (ctrl) => ctrl.value === combined
    );

    if (idx === -1) {
      this.subcategorySelectionsArray.push(new FormControl(combined));
    } else {
      this.subcategorySelectionsArray.removeAt(idx);
    }

    this.touchAndValidate();
  }

  toggleAllSubcategories(categoryValue: string): void {
    const cat = this.propertyCategories.find((c) => c.value === categoryValue);
    if (!cat || !cat.subcategories) return;

    const shouldSelectAll = !this.allSubcategoriesSelected(categoryValue);

    // clear existing for that category
    this.removeAllSubcategories(categoryValue);

    if (shouldSelectAll) {
      cat.subcategories.forEach((sub) => {
        this.subcategorySelectionsArray.push(
          new FormControl(`${categoryValue}:${sub.value}`)
        );
      });
    }

    this.touchAndValidate();
  }



  removeAllSubcategories(categoryValue: string): void {
    for (let i = this.subcategorySelectionsArray.length - 1; i >= 0; i--) {
      const v = this.subcategorySelectionsArray.at(i).value;
      if (typeof v === 'string' && v.startsWith(categoryValue + ':')) {
        this.subcategorySelectionsArray.removeAt(i);
      }
    }
  }

  toggleDropdown(categoryValue: string): void {
    this.expandedCategory =
      this.expandedCategory === categoryValue ? null : categoryValue;
    // no stopPropagation here because we are already inside click handlers
  }

  // currency formatter
  formatCurrency(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const numericString = input.value.replace(/[^0-9.]/g, '');
    const numericValue = parseFloat(numericString);

    this.lenderForm.get(controlName)?.setValue(numericValue, {
      emitEvent: false,
    });

    const formatted = this.currencyPipe.transform(
      numericValue,
      'USD',
      'symbol',
      '1.0-0'
    );
    input.value = formatted || '';

    console.log(`${controlName} stored value:`, numericValue, typeof numericValue);
  }

  // mark form touched + validate so parent button state updates
  private touchAndValidate(): void {
    this.lenderForm.markAsTouched();
    this.lenderForm.markAsDirty();
    this.lenderForm.updateValueAndValidity({ onlySelf: false, emitEvent: true });
  }
}
