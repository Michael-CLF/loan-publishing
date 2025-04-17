import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { LocationService } from '../../services/location.service';
import {
  FootprintLocation,
  FootprintSubcategory,
} from '../../models/footprint-location.model';

@Component({
  selector: 'app-lender-footprint',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-footprint.component.html',
  styleUrls: ['./lender-footprint.component.css'],
  providers: [LocationService],
})
export class LenderFootprintComponent implements OnInit {
  @Input() lenderForm!: FormGroup;

  // States and counties data
  footprintLocation: FootprintLocation[] = [];

  // Currently selected state for UI highlighting
  currentSelectedState: string | null = null;

  // Flag to prevent validation loops
  private updatingValues = false;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    // Get states and counties data
    this.footprintLocation = this.locationService.getFootprintLocations();

    // Initialize the lendingFootprint field if not already set
    if (!this.lenderForm.get('lendingFootprint')) {
      this.lenderForm.addControl('lendingFootprint', this.fb.control([]));
    }

    // Initialize states form group if it doesn't exist
    if (!this.lenderForm.get('states')) {
      // Create states form group
      const statesGroup = this.fb.group({});

      // Add controls for each state
      this.footprintLocation.forEach((state) => {
        statesGroup.addControl(state.value, this.fb.control(false));

        // Add a nested form group for counties
        const countiesGroup = this.fb.group({});
        state.subcategories.forEach((county) => {
          countiesGroup.addControl(county.value, this.fb.control(false));
        });

        statesGroup.addControl(`${state.value}_counties`, countiesGroup);
      });

      // Add the states group to the main form
      this.lenderForm.addControl('states', statesGroup);
    }

    // Apply the validator to the form
    this.lenderForm.setValidators(this.atLeastOneStateValidator());

    // Force validation check immediately
    this.lenderForm.updateValueAndValidity();

    // Log initial state
    console.log('Footprint form initialized', this.lenderForm.valid);
  }

  /**
   * Custom validator to ensure at least one state is selected
   * This validator ONLY checks validity and does not modify form values
   */
  private atLeastOneStateValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      // Skip validation if we're actively updating values to prevent loops
      if (this.updatingValues) {
        return null;
      }

      const statesGroup = formGroup.get('states') as FormGroup;
      if (!statesGroup) return { noStateSelected: true };

      const anyStateSelected = Object.keys(statesGroup.controls)
        .filter((key) => !key.includes('_counties'))
        .some((key) => statesGroup.get(key)?.value === true);

      return anyStateSelected ? null : { noStateSelected: true };
    };
  }

  /**
   * Updates the lendingFootprint control based on selected states
   * Separated from validation to prevent infinite loops
   */
  private updateLendingFootprint(): void {
    // Set flag to prevent validation loops
    this.updatingValues = true;

    try {
      const statesGroup = this.lenderForm.get('states') as FormGroup;
      if (!statesGroup) return;

      const selectedStates = Object.keys(statesGroup.controls)
        .filter(
          (key) =>
            !key.includes('_counties') && statesGroup.get(key)?.value === true
        )
        .map((key) => {
          const state = this.footprintLocation.find((s) => s.value === key);
          return state ? state.name : key;
        });

      // Update the lendingFootprint control without triggering validation
      const lendingFootprint = this.lenderForm.get('lendingFootprint');
      if (lendingFootprint) {
        lendingFootprint.setValue(selectedStates, { emitEvent: false });
      }
    } finally {
      // Reset flag
      this.updatingValues = false;
    }
  }

  // Set currently selected state for the right panel
  selectState(stateValue: string): void {
    this.currentSelectedState = stateValue;
  }

  // Get name of currently selected state
  getSelectedStateName(): string {
    if (!this.currentSelectedState) return 'Selected State';

    const state = this.footprintLocation.find(
      (s) => s.value === this.currentSelectedState
    );
    return state ? state.name : 'Selected State';
  }

  // Check if all states are selected
  areAllStatesSelected(): boolean {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return false;

    const stateControls = Object.keys(statesGroup.controls).filter(
      (key) => !key.includes('_counties')
    );

    return (
      stateControls.length > 0 &&
      stateControls.every((key) => statesGroup.get(key)?.value === true)
    );
  }

  // Toggle all states selection
  toggleAllStates(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const isChecked = (event.target as HTMLInputElement).checked;
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return;

    // Get all state keys (excluding county groups)
    const stateControls = Object.keys(statesGroup.controls).filter(
      (key) => !key.includes('_counties')
    );

    // Update all state checkboxes
    stateControls.forEach((stateKey) => {
      statesGroup.get(stateKey)?.setValue(isChecked);
    });

    // Update the form
    this.updateLendingFootprint();
    this.lenderForm.markAsTouched();
    this.lenderForm.updateValueAndValidity();
  }

  // Check if all counties for a state are selected
  areAllCountiesSelected(stateValue: string): boolean {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return false;

    const countiesGroup = statesGroup.get(
      `${stateValue}_counties`
    ) as FormGroup;
    if (!countiesGroup) return false;

    const countyControls = Object.keys(countiesGroup.controls);
    return (
      countyControls.length > 0 &&
      countyControls.every((key) => countiesGroup.get(key)?.value === true)
    );
  }

  // Toggle all counties for a state
  toggleAllCounties(stateValue: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const isChecked = (event.target as HTMLInputElement).checked;
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return;

    // Ensure the parent state is also checked
    if (isChecked) {
      statesGroup.get(stateValue)?.setValue(true);
    }

    // Get counties group
    const countiesGroup = statesGroup.get(
      `${stateValue}_counties`
    ) as FormGroup;
    if (!countiesGroup) return;

    // Update all county checkboxes
    Object.keys(countiesGroup.controls).forEach((county) => {
      countiesGroup.get(county)?.setValue(isChecked);
    });

    // Update the form
    this.updateLendingFootprint();
    this.lenderForm.markAsTouched();
    this.lenderForm.updateValueAndValidity();
  }

  // Get counties for all selected states
  getCountiesForSelectedStates(): {
    stateValue: string;
    stateName: string;
    counties: FootprintSubcategory[];
  }[] {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return [];

    const selectedStates = Object.keys(statesGroup.controls).filter(
      (key) =>
        !key.includes('_counties') && statesGroup.get(key)?.value === true
    );

    return selectedStates.map((stateValue) => {
      const state = this.footprintLocation.find((s) => s.value === stateValue);
      return {
        stateValue,
        stateName: state ? state.name : stateValue,
        counties: state ? state.subcategories : [],
      };
    });
  }

  // Helper methods for template
  isStateSelected(stateValue: string): boolean {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    return statesGroup?.get(stateValue)?.value === true;
  }

  isCountySelected(stateValue: string, countyValue: string): boolean {
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return false;

    const countiesGroup = statesGroup.get(
      `${stateValue}_counties`
    ) as FormGroup;
    if (!countiesGroup) return false;

    return countiesGroup.get(countyValue)?.value === true;
  }

  // Event handlers
  onStateChange(stateValue: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const isChecked = (event.target as HTMLInputElement)?.checked || false;
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return;

    // Update state control
    statesGroup.get(stateValue)?.setValue(isChecked);

    // Select this state in the UI if checked
    if (isChecked) {
      this.currentSelectedState = stateValue;
    }
    // If unchecking state, clear the selection if it was this state
    else if (this.currentSelectedState === stateValue) {
      this.currentSelectedState = null;
    }

    // If unchecking state, also uncheck all counties
    if (!isChecked) {
      const countiesGroup = statesGroup.get(
        `${stateValue}_counties`
      ) as FormGroup;
      if (countiesGroup) {
        Object.keys(countiesGroup.controls).forEach((county) => {
          countiesGroup.get(county)?.setValue(false);
        });
      }
    }

    // Update lendingFootprint separately from validation
    this.updateLendingFootprint();

    // Mark form as touched to display validation
    this.lenderForm.markAsTouched();
    statesGroup.markAsTouched();

    // Update validation state
    this.lenderForm.updateValueAndValidity();

    console.log(
      'State changed',
      stateValue,
      'Form valid:',
      this.lenderForm.valid
    );
  }

  onCountyChange(stateValue: string, countyValue: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const isChecked = (event.target as HTMLInputElement)?.checked || false;
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) return;

    // Get counties group
    const countiesGroup = statesGroup.get(
      `${stateValue}_counties`
    ) as FormGroup;
    if (!countiesGroup) return;

    // Update county control
    countiesGroup.get(countyValue)?.setValue(isChecked);

    // If checking a county, ensure the state is also checked
    if (isChecked) {
      statesGroup.get(stateValue)?.setValue(true);
    }

    // Update lendingFootprint separately from validation
    this.updateLendingFootprint();

    // Mark form as touched to display validation
    this.lenderForm.markAsTouched();

    // Update validation state
    this.lenderForm.updateValueAndValidity();
  }

  // Check if the form has any validation errors
  hasFormError(errorName: string): boolean {
    return (
      this.lenderForm.hasError(errorName) &&
      (this.lenderForm.touched || this.lenderForm.dirty)
    );
  }
}
