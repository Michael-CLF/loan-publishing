import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  ReactiveFormsModule,
  AbstractControl,
  FormArray,
  FormControl,
} from '@angular/forms';
import { DecimalPipe, CurrencyPipe } from '@angular/common';
import {
  LenderTypeOption,
  PropertyCategory,
  PropertyTypes,
  StateOption,
} from '../lender-registration/lender-registration.component';

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
  @Input() lenderTypes!: { value: string; name: string }[];
  @Input() propertyCategories!: {
    value: string;
    name: string;
    subcategories: { name: string; value: string }[];
  }[];
  @Input() propertyTypes!: {
    value: string;
    name: string;
    subCategories: { value: string; name: string }[];
  }[];
  @Input() states!: { value: string; name: string }[];

  constructor(private currencyPipe: CurrencyPipe) {}
  formatCurrency(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    value = value.replace(/[^0-9.]/g, '');

    if (value) {
      // Format the value as currency
      const formattedValue = this.currencyPipe.transform(
        value,
        'USD',
        'symbol',
        '1.0-0'
      );

      // Update the form control without triggering another change event
      this.lenderForm
        .get(controlName)
        ?.setValue(formattedValue, { emitEvent: false });

      // Update the input display value
      input.value = formattedValue || '';
    }
  }

  ngOnInit(): void {
    if (!this.lenderForm) {
      console.error('LenderProductComponent: lenderForm input is missing');
      return;
    }

    if (!this.lenderTypes || this.lenderTypes.length === 0) {
      console.warn(
        'LenderProductComponent: lenderTypes input is empty or undefined'
      );
    }

    if (!this.propertyCategories || this.propertyCategories.length === 0) {
      console.warn(
        'LenderProductComponent: propertyCategories input is empty or undefined'
      );
    }

    console.log('Form controls:', Object.keys(this.lenderForm.controls));

    // Check initial form validity
    setTimeout(() => {
      console.log('Initial form validity:', this.lenderForm.valid);
      console.log(
        'Lender types array:',
        (this.lenderForm.get('lenderTypes') as FormArray).value
      );
      console.log(
        'Property categories array:',
        (this.lenderForm.get('propertyCategories') as FormArray).value
      );

      this.lenderForm.updateValueAndValidity({
        onlySelf: false,
        emitEvent: true,
      });

      Object.keys(this.lenderForm.controls).forEach((key) => {
        const control = this.lenderForm.get(key);
        if (control) {
          control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
        }
      });
    });
  }

  get lenderTypesArray(): FormArray {
    return this.lenderForm.get('lenderTypes') as FormArray;
  }

  get propertyCategoriesArray(): FormArray {
    return this.lenderForm.get('propertyCategories') as FormArray;
  }

  get propertyTypesArray(): FormArray {
    return this.lenderForm.get('propertyTypes') as FormArray;
  }

  getControl(name: string): AbstractControl | null {
    return this.lenderForm.get(name);
  }

  isControlInvalid(controlName: string): boolean {
    const control = this.lenderForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  controlHasError(controlName: string, errorName: string): boolean {
    const control = this.lenderForm.get(controlName);
    return !!control && control.hasError(errorName);
  }

  markControlAsTouched(name: string): void {
    const control = this.getControl(name);
    if (control) {
      control.markAsTouched();
    }
  }

  isOptionSelected(formArrayName: string, value: string): boolean {
    const formArray = this.lenderForm.get(formArrayName) as FormArray;
    return formArray.controls.some((control) => control.value === value);
  }

  isSubOptionSelected(category: string, subValue: string): boolean {
    const formArray = this.lenderForm.get('subcategorySelections') as FormArray;
    return (
      formArray?.controls.some(
        (control) => control.value === `${category}:${subValue}`
      ) || false
    );
  }

  onLenderTypeChange(event: Event, value: string): void {
    const checkbox = event.target as HTMLInputElement;
    const checked = checkbox.checked;

    // Get the form array
    const formArray = this.lenderForm.get('lenderTypes') as FormArray;

    if (checked) {
      // Add the value to the form array
      formArray.push(new FormControl(value));
      console.log(`Added lender type: ${value}`);
    } else {
      // Remove the value from the form array
      const index = formArray.controls.findIndex(
        (control) => control.value === value
      );
      if (index !== -1) {
        formArray.removeAt(index);
        console.log(`Removed lender type: ${value}`);
      }
    }

    // Log for debugging
    console.log('Lender types after change:', formArray.value);
    console.log('Lender types count:', formArray.length);
    console.log('Lender types valid:', formArray.valid);
    console.log('Lender types errors:', formArray.errors);

    // Update validation
    formArray.updateValueAndValidity();
    this.lenderForm.updateValueAndValidity();
  }

  onPropertyCategoryChange(event: Event, value: string): void {
    const checkbox = event.target as HTMLInputElement;
    const checked = checkbox.checked;

    // Get the form array
    const formArray = this.lenderForm.get('propertyCategories') as FormArray;

    if (checked) {
      // Add the value to the form array
      formArray.push(new FormControl(value));
      console.log(`Added property category: ${value}`);
    } else {
      // Remove the value from the form array
      const index = formArray.controls.findIndex(
        (control) => control.value === value
      );
      if (index !== -1) {
        formArray.removeAt(index);
        console.log(`Removed property category: ${value}`);
      }
    }

    // Log for debugging
    console.log('Property categories after change:', formArray.value);
    console.log('Property categories count:', formArray.length);
    console.log('Property categories valid:', formArray.valid);
    console.log('Property categories errors:', formArray.errors);

    // Update validation
    formArray.updateValueAndValidity();
    this.lenderForm.updateValueAndValidity();
  }

  onPropertyTypeChange(event: Event, formArrayName: string) {
    const checkbox = event.target as HTMLInputElement;
    const formArray = this.lenderForm.get(formArrayName) as FormArray;

    if (checkbox.checked) {
      formArray.push(new FormControl(checkbox.value));
    } else {
      const index = formArray.controls.findIndex(
        (c) => c.value === checkbox.value
      );
      if (index !== -1) {
        formArray.removeAt(index);
      }
    }

    // Update validation
    formArray.updateValueAndValidity();
    this.lenderForm.updateValueAndValidity();
  }

  onSubmit(): void {
    if (this.lenderForm.invalid) {
      Object.keys(this.lenderForm.controls).forEach((key) => {
        this.markControlAsTouched(key);
      });
      return;
    }

    console.log('Form is valid:', this.lenderForm.value);
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  filters: { [key: string]: string[] } = {
    propertyTypes: [],
    loanTypes: [],
  };
}
