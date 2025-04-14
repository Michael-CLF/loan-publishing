import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

interface State {
  value: string;
  name: string;
}

interface PropertyType {
  value: string;
  name: string;
}

interface PropertyCategory {
  category: string;
  types: PropertyType[];
}

@Component({
  selector: 'app-lender-footprint',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-footprint.component.html',
  styleUrls: ['./lender-footprint.component.css'],
})
export class LenderFootprintComponent implements OnInit {
  @Input() parentForm!: FormGroup;
  @Input() states: State[] = [];

  propertyCategories: PropertyCategory[] = [
    {
      category: 'Commercial',
      types: [
        { value: 'office', name: 'Office' },
        { value: 'retail', name: 'Retail' },
        { value: 'mixed_use', name: 'Mixed Use' },
      ],
    },
    {
      category: 'Residential',
      types: [
        { value: 'single_family', name: 'Single Family' },
        { value: 'multifamily', name: 'Multifamily' },
        { value: 'condo', name: 'Condominium' },
      ],
    },
    {
      category: 'Industrial',
      types: [
        { value: 'warehouse', name: 'Warehouse' },
        { value: 'manufacturing', name: 'Manufacturing' },
        { value: 'distribution', name: 'Distribution' },
      ],
    },
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializePropertyTypes();
  }

  // Initialize the propertyTypes form group with checkboxes
  private initializePropertyTypes(): void {
    const propertyTypesGroup = this.parentForm.get(
      'propertyTypes'
    ) as FormGroup;

    // If propertyTypes doesn't exist or is empty, initialize it
    if (
      !propertyTypesGroup ||
      Object.keys(propertyTypesGroup.controls).length === 0
    ) {
      const propertyTypeControls: Record<string, boolean> = {};

      // Add all property types to the form group
      this.propertyCategories.forEach((category) => {
        category.types.forEach((type) => {
          propertyTypeControls[type.value] = false;
        });
      });

      // Update the form group with new controls
      this.parentForm.setControl(
        'propertyTypes',
        this.fb.group(propertyTypeControls)
      );
    }
  }

  // Check if a state is selected
  isStateSelected(stateValue: string): boolean {
    const lendingFootprint =
      this.parentForm.get('lendingFootprint')?.value || [];
    return lendingFootprint.includes(stateValue);
  }

  // Toggle state selection
  toggleState(stateValue: string): void {
    const lendingFootprint = this.parentForm.get('lendingFootprint');
    if (!lendingFootprint) return;

    const currentStates = [...(lendingFootprint.value || [])];

    if (this.isStateSelected(stateValue)) {
      const index = currentStates.indexOf(stateValue);
      if (index !== -1) {
        currentStates.splice(index, 1);
      }
    } else {
      currentStates.push(stateValue);
    }

    lendingFootprint.setValue(currentStates);
    lendingFootprint.markAsDirty();
    lendingFootprint.markAsTouched();
  }

  // Check if all states are selected
  areAllStatesSelected(): boolean {
    const lendingFootprint =
      this.parentForm.get('lendingFootprint')?.value || [];
    return lendingFootprint.length === this.states.length;
  }

  // Toggle all states
  toggleAllStates(): void {
    const lendingFootprint = this.parentForm.get('lendingFootprint');
    if (!lendingFootprint) return;

    if (this.areAllStatesSelected()) {
      lendingFootprint.setValue([]);
    } else {
      const allStateValues = this.states.map((state) => state.value);
      lendingFootprint.setValue(allStateValues);
    }

    lendingFootprint.markAsDirty();
    lendingFootprint.markAsTouched();
  }

  // Helper method to check if a control is invalid and touched/dirty
  isInvalid(controlName: string): boolean {
    const control = this.parentForm.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }
}
