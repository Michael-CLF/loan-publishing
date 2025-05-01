// lender-footprint.component.ts
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

interface SelectionState {
  stateValue: string;
  stateName: string;
  counties: Array<{
    value: string;
    name: string;
    selected: boolean;
  }>;
  allCountiesSelected: boolean;
}

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

  // States data
  footprintLocation: FootprintLocation[] = [];

  // Track selected states and counties
  selectedStates: SelectionState[] = [];

  // Track which states dropdown is expanded
  expandedState: string | null = null;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    console.log('LenderFootprintComponent: Initializing');

    // Get states and counties data
    this.footprintLocation = this.locationService.getFootprintLocations();

    // Initialize form structure
    this.initializeFormStructure();

    // Initialize the selected states array from form values
    this.initializeSelectedStates();

    // Log initial state
    console.log('Footprint form initialized:', this.lenderForm);
    console.log('Footprint form valid:', this.lenderForm.valid);
    console.log(
      'lendingFootprint value:',
      this.lenderForm.get('lendingFootprint')?.value
    );

    // Force validation check immediately
    this.lenderForm.updateValueAndValidity();
  }

  /**
   * Initialize the form structure with states and counties
   */
  private initializeFormStructure(): void {
    // Make sure we have the lendingFootprint control
    if (!this.lenderForm.get('lendingFootprint')) {
      this.lenderForm.addControl('lendingFootprint', this.fb.control([]));
      console.log('Added lendingFootprint control to form');
    }

    // Initialize states form group if it doesn't exist
    if (!this.lenderForm.get('states')) {
      console.log('Creating states form group');

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
      console.log('Added states controls to form');
    }

    // Apply the validator to the form
    this.lenderForm.setValidators(this.atLeastOneStateValidator());
    console.log('Set validator on form');
  }

  /**
   * Initialize selected states from form values
   */
  private initializeSelectedStates(): void {
    console.log('Initializing selected states from form values');
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) {
      console.error('No states group found in form');
      return;
    }

    // Clear the array
    this.selectedStates = [];

    // Get all state keys (excluding county groups)
    const stateControls = Object.keys(statesGroup.controls).filter(
      (key) => !key.includes('_counties')
    );

    console.log('Found state controls:', stateControls);

    // For each selected state, add to our tracking array
    stateControls.forEach((stateKey) => {
      if (statesGroup.get(stateKey)?.value === true) {
        console.log(`State ${stateKey} is selected in form`);

        const state = this.footprintLocation.find((s) => s.value === stateKey);
        if (state) {
          const countiesGroup = statesGroup.get(
            `${stateKey}_counties`
          ) as FormGroup;

          if (!countiesGroup) {
            console.error(`No counties group found for state ${stateKey}`);
            return;
          }

          // Map counties with their selected state
          const counties = state.subcategories.map((county) => {
            const isSelected = countiesGroup.get(county.value)?.value === true;
            if (isSelected) {
              console.log(`County ${county.value} is selected in form`);
            }
            return {
              value: county.value,
              name: county.name,
              selected: isSelected,
            };
          });

          // Check if all counties are selected
          const allCountiesSelected =
            counties.length > 0 && counties.every((county) => county.selected);

          // Add to our tracking array
          this.selectedStates.push({
            stateValue: stateKey,
            stateName: state.name,
            counties,
            allCountiesSelected,
          });

          console.log(
            `Added ${state.name} to selected states with ${
              counties.filter((c) => c.selected).length
            } selected counties`
          );
        } else {
          console.error(
            `State ${stateKey} not found in footprintLocation data`
          );
        }
      }
    });

    console.log(
      'Initialized selectedStates:',
      this.selectedStates.map((s) => s.stateName)
    );
  }

  /**
   * Custom validator to ensure at least one state is selected
   */
  private atLeastOneStateValidator(): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const statesGroup = formGroup.get('states') as FormGroup;
      if (!statesGroup) return { noStateSelected: true };

      const anyStateSelected = Object.keys(statesGroup.controls)
        .filter((key) => !key.includes('_counties'))
        .some((key) => statesGroup.get(key)?.value === true);

      return anyStateSelected ? null : { noStateSelected: true };
    };
  }

  /**
   * Update form values based on current selections
   */
  private updateFormValues(): void {
    console.log('Updating form values from current selections');
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (!statesGroup) {
      console.error('No states group found in form');
      return;
    }

    // Reset all states to unselected first (to handle removed states)
    Object.keys(statesGroup.controls)
      .filter((key) => !key.includes('_counties'))
      .forEach((key) => {
        statesGroup.get(key)?.setValue(false);
      });

    // Update form with current selections
    this.selectedStates.forEach((state) => {
      console.log(`Updating form for state: ${state.stateName}`);

      // Set state as selected
      statesGroup.get(state.stateValue)?.setValue(true);

      // Get counties group
      const countiesGroup = statesGroup.get(
        `${state.stateValue}_counties`
      ) as FormGroup;

      if (countiesGroup) {
        // Reset all counties first (to handle removed counties)
        Object.keys(countiesGroup.controls).forEach((key) => {
          countiesGroup.get(key)?.setValue(false);
        });

        // Set selected counties
        state.counties.forEach((county) => {
          if (county.selected) {
            console.log(`Setting county ${county.name} as selected`);
            countiesGroup.get(county.value)?.setValue(true);
          }
        });
      } else {
        console.error(`No counties group found for state ${state.stateValue}`);
      }
    });

    // Update lendingFootprint value with state names
    const selectedStateNames = this.selectedStates.map(
      (state) => state.stateName
    );
    console.log('Setting lendingFootprint to:', selectedStateNames);
    this.lenderForm.get('lendingFootprint')?.setValue(selectedStateNames);

    // Mark form as touched and trigger validation
    this.lenderForm.markAsDirty();
    this.lenderForm.markAsTouched();
    this.lenderForm.updateValueAndValidity();

    console.log('Form updated, valid:', this.lenderForm.valid);
  }

  /**
   * Toggle all states selection
   */
  toggleAllStates(): void {
    console.log('Toggling all states');

    // Determine if we should select or deselect all
    const shouldSelectAll =
      this.footprintLocation.length > this.selectedStates.length;

    if (shouldSelectAll) {
      console.log('Selecting all states');

      // Add all states that aren't already selected
      this.footprintLocation.forEach((state) => {
        if (!this.isStateSelected(state.value)) {
          this.selectedStates.push({
            stateValue: state.value,
            stateName: state.name,
            counties: state.subcategories.map((county) => ({
              value: county.value,
              name: county.name,
              selected: false,
            })),
            allCountiesSelected: false,
          });
        }
      });
    } else {
      console.log('Deselecting all states');
      // Clear all selected states
      this.selectedStates = [];
    }

    // Update form values
    this.updateFormValues();
  }

  /**
   * Check if all states are selected
   */
  areAllStatesSelected(): boolean {
    return this.selectedStates.length === this.footprintLocation.length;
  }

  /**
   * Toggle state selection
   */
  toggleState(stateValue: string): void {
    console.log(`Toggling state: ${stateValue}`);

    // Check if state is already selected
    const stateIndex = this.selectedStates.findIndex(
      (s) => s.stateValue === stateValue
    );

    // If state is already selected, remove it
    if (stateIndex !== -1) {
      console.log(`Removing state: ${stateValue}`);
      this.selectedStates.splice(stateIndex, 1);

      // Also ensure it's properly removed from the form
      const statesGroup = this.lenderForm.get('states') as FormGroup;
      if (statesGroup && statesGroup.get(stateValue)) {
        statesGroup.get(stateValue)?.setValue(false);
      }
    }
    // Otherwise, add it
    else {
      console.log(`Adding state: ${stateValue}`);
      const state = this.footprintLocation.find((s) => s.value === stateValue);
      if (state) {
        // Add with all counties unselected initially
        this.selectedStates.push({
          stateValue,
          stateName: state.name,
          counties: state.subcategories.map((county) => ({
            value: county.value,
            name: county.name,
            selected: false,
          })),
          allCountiesSelected: false,
        });

        // Also ensure it's properly added to the form
        const statesGroup = this.lenderForm.get('states') as FormGroup;
        if (statesGroup && statesGroup.get(stateValue)) {
          statesGroup.get(stateValue)?.setValue(true);
        }

        // Expand this state's dropdown
        this.expandedState = stateValue;
      } else {
        console.error(
          `State ${stateValue} not found in footprintLocation data`
        );
      }
    }

    // Update form
    this.updateFormValues();
  }

  /**
   * Toggle county selection
   */
  toggleCounty(stateValue: string, countyValue: string): void {
    console.log(`Toggling county: ${stateValue} - ${countyValue}`);

    // Find the state
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) {
      console.error(`State ${stateValue} not found in selectedStates`);
      return;
    }

    // Find the county
    const county = state.counties.find((c) => c.value === countyValue);
    if (!county) {
      console.error(`County ${countyValue} not found in state ${stateValue}`);
      return;
    }

    // Toggle selection
    county.selected = !county.selected;
    console.log(`County ${countyValue} selected: ${county.selected}`);

    // Update the "allCountiesSelected" flag
    state.allCountiesSelected = state.counties.every((c) => c.selected);

    // Also update the form control
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (statesGroup) {
      const countiesGroup = statesGroup.get(
        `${stateValue}_counties`
      ) as FormGroup;
      if (countiesGroup && countiesGroup.get(countyValue)) {
        countiesGroup.get(countyValue)?.setValue(county.selected);
      }
    }

    // Update form
    this.updateFormValues();
  }

  /**
   * Toggle all counties for a state
   */
  toggleAllCounties(stateValue: string): void {
    console.log(`Toggling all counties for state: ${stateValue}`);

    // Find the state
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) {
      console.error(`State ${stateValue} not found in selectedStates`);
      return;
    }

    // Toggle the "allCountiesSelected" flag
    state.allCountiesSelected = !state.allCountiesSelected;
    console.log(`All counties selected: ${state.allCountiesSelected}`);

    // Update all counties
    state.counties.forEach((county) => {
      county.selected = state.allCountiesSelected;
    });

    // Update form controls directly
    const statesGroup = this.lenderForm.get('states') as FormGroup;
    if (statesGroup) {
      const countiesGroup = statesGroup.get(
        `${stateValue}_counties`
      ) as FormGroup;
      if (countiesGroup) {
        state.counties.forEach((county) => {
          countiesGroup.get(county.value)?.setValue(county.selected);
        });
      }
    }

    // Update form
    this.updateFormValues();
  }

  /**
   * Toggle dropdown expanded/collapsed state
   */
  toggleDropdown(stateValue: string): void {
    console.log(`Toggling dropdown for state: ${stateValue}`);

    if (this.expandedState === stateValue) {
      this.expandedState = null;
    } else {
      this.expandedState = stateValue;
    }

    // Prevent event propagation
    event?.stopPropagation();
  }

  /**
   * Check if a state is selected
   */
  isStateSelected(stateValue: string): boolean {
    return this.selectedStates.some((s) => s.stateValue === stateValue);
  }

  /**
   * Check if a county is selected
   */
  isCountySelected(stateValue: string, countyValue: string): boolean {
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) return false;

    const county = state.counties.find((c) => c.value === countyValue);
    return county?.selected || false;
  }

  /**
   * Get total selected counties for a state
   */
  getSelectedCountiesCount(stateValue: string): number {
    const state = this.selectedStates.find((s) => s.stateValue === stateValue);
    if (!state) return 0;

    return state.counties.filter((c) => c.selected).length;
  }

  /**
   * Format state display text
   */
  getStateDisplayText(state: FootprintLocation): string {
    const selectedCount = this.getSelectedCountiesCount(state.value);
    const totalCount = state.subcategories.length;

    if (this.isStateSelected(state.value)) {
      if (selectedCount === 0) {
        return `${state.name} (All counties)`;
      } else if (selectedCount === totalCount) {
        return `${state.name} (All counties)`;
      } else {
        return `${state.name} (${selectedCount} of ${totalCount} counties)`;
      }
    }

    return state.name;
  }

  /**
   * Check if the form has any validation errors
   */
  hasFormError(errorName: string): boolean {
    return (
      this.lenderForm.hasError(errorName) &&
      (this.lenderForm.touched || this.lenderForm.dirty)
    );
  }
}
