import { Component, OnInit, HostListener } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
  ValidationErrors,
  ReactiveFormsModule,
} from '@angular/forms';
import { NgClass, NgFor, NgIf } from '@angular/common';

interface PropertyCategoryType {
  category: string;
  types: Array<{ value: string; name: string }>;
}

@Component({
  selector: 'app-lender-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, NgFor, NgIf],
  templateUrl: './lender-form.component.html',
  styleUrls: ['./lender-form.component.css'],
})
export class LenderFormComponent implements OnInit {
  lenderForm!: FormGroup;
  activeDropdown: string | null = null;
  submitted = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  // Dropdown options
  states = [
    { value: 'AL', name: 'Alabama' },
    { value: 'AK', name: 'Alaska' },
    { value: 'AZ', name: 'Arizona' },
    { value: 'AR', name: 'Arkansas' },
    { value: 'CA', name: 'California' },
    { value: 'CO', name: 'Colorado' },
    { value: 'CT', name: 'Connecticut' },
    { value: 'DE', name: 'Delaware' },
    { value: 'FL', name: 'Florida' },
    { value: 'GA', name: 'Georgia' },
    { value: 'HI', name: 'Hawaii' },
    { value: 'ID', name: 'Idaho' },
    { value: 'IL', name: 'Illinois' },
    { value: 'IN', name: 'Indiana' },
    { value: 'IA', name: 'Iowa' },
    { value: 'KS', name: 'Kansas' },
    { value: 'KY', name: 'Kentucky' },
    { value: 'LA', name: 'Louisiana' },
    { value: 'ME', name: 'Maine' },
    { value: 'MD', name: 'Maryland' },
    { value: 'MA', name: 'Massachusetts' },
    { value: 'MI', name: 'Michigan' },
    { value: 'MN', name: 'Minnesota' },
    { value: 'MS', name: 'Mississippi' },
    { value: 'MO', name: 'Missouri' },
    { value: 'MT', name: 'Montana' },
    { value: 'NE', name: 'Nebraska' },
    { value: 'NV', name: 'Nevada' },
    { value: 'NH', name: 'New Hampshire' },
    { value: 'NJ', name: 'New Jersey' },
    { value: 'NM', name: 'New Mexico' },
    { value: 'NY', name: 'New York' },
    { value: 'NC', name: 'North Carolina' },
    { value: 'ND', name: 'North Dakota' },
    { value: 'OH', name: 'Ohio' },
    { value: 'OK', name: 'Oklahoma' },
    { value: 'OR', name: 'Oregon' },
    { value: 'PA', name: 'Pennsylvania' },
    { value: 'RI', name: 'Rhode Island' },
    { value: 'SC', name: 'South Carolina' },
    { value: 'SD', name: 'South Dakota' },
    { value: 'TN', name: 'Tennessee' },
    { value: 'TX', name: 'Texas' },
    { value: 'UT', name: 'Utah' },
    { value: 'VT', name: 'Vermont' },
    { value: 'VA', name: 'Virginia' },
    { value: 'WA', name: 'Washington' },
    { value: 'WV', name: 'West Virginia' },
    { value: 'WI', name: 'Wisconsin' },
    { value: 'WY', name: 'Wyoming' },
    { value: 'DC', name: 'District of Columbia' },
  ];

  propertyCategory = [
    { value: 'commercial', name: 'Commercial' },
    { value: 'industrial', name: 'Industrial' },
    { value: 'land', name: 'Land' },
    { value: 'multifamily', name: 'Multifamily' },
    { value: 'office', name: 'Office' },
    { value: 'residential', name: 'Residential' },
    { value: 'retail', name: 'Retail' },
  ];

  lenderTypes = [
    { value: 'Agency', name: 'Agency Lender (Fannie/Freddie)' },
    { value: 'bank', name: 'Bank' },
    { value: 'bridge_lender', name: 'Bridge Lender' },
    { value: 'cdfi', name: 'CDFI Lender' },
    { value: 'conduit_lender', name: 'Conduit Lender (CMBS)' },
    { value: 'construction_lender', name: 'Construction Lender' },
    { value: 'correspondent_lender', name: 'Correspondent Lender' },
    { value: 'credit_union', name: 'Credit Union' },
    { value: 'crowdfunding', name: 'Crowdfunding Platform' },
    { value: 'direct_lender', name: 'Direct Lender' },
    { value: 'family_office', name: 'Family Office' },
    { value: 'hard_money', name: 'Hard Money Lender' },
    { value: 'life_insurance', name: 'Life Insurance Lender' },
    { value: 'mezzanine_lender', name: 'Mezzanine Lender' },
    { value: 'mortgage_broker', name: 'Mortgage Broker' },
    { value: 'non_qm_lender', name: 'Non-QM Lender' },
    { value: 'portfolio_lender', name: 'Portfolio Lender' },
    { value: 'private_lender', name: 'Private Lender' },
    { value: 'sba', name: 'SBA Lender' },
    { value: 'usda', name: 'USDA Lender' },
  ];

  propertyTypes: PropertyCategoryType[] = [
    {
      category: 'Healthcare',
      types: [
        { value: 'assisted_living', name: 'Assisted Living' },
        { value: 'hospital', name: 'Hospital' },
        { value: 'independent_living', name: 'Independent Living' },
        { value: 'rehab_facility', name: 'Rehab Facility' },
      ],
    },
    {
      category: 'Hospitality',
      types: [
        { value: 'hospitality_land', name: 'Hospitality Land' },
        { value: 'hotel', name: 'Hotel' },
        { value: 'long_term_rentals', name: 'Long-term Rentals' },
        { value: 'motel', name: 'Motel' },
        { value: 'short_term_rentals', name: 'Short-term Rentals' },
      ],
    },
    {
      category: 'Industrial Property',
      types: [
        { value: 'cold_storage', name: 'Cold Storage' },
        { value: 'flex_space', name: 'Flex Space' },
        { value: 'industrial_land', name: 'Industrial Land' },
        { value: 'rv_park', name: 'RV Park' },
        { value: 'self_storage', name: 'Self Storage' },
        { value: 'warehouse', name: 'Warehouse' },
      ],
    },
    {
      category: 'Multi-family',
      types: [
        { value: 'affordable_housing', name: 'Affordable Housing' },
        { value: 'mf_assisted_living', name: 'Assisted Living' },
        { value: 'mf_independent_living', name: 'Independent Living' },
        { value: 'manufactured', name: 'Manufactured' },
        { value: 'military_housing', name: 'Military Housing' },
        { value: 'mixed_use', name: 'Mixed Use' },
        { value: 'multifamily_land', name: 'Multifamily Land' },
        { value: 'senior_housing', name: 'Senior Housing' },
        { value: 'single_family_portfolio', name: 'Single Family Portfolio' },
        { value: 'student_housing', name: 'Student Housing' },
      ],
    },
    {
      category: 'Office',
      types: [
        {
          value: 'residential_1_4_unit',
          name: '1-4 Unit Residential Property',
        },
        { value: 'co_op_duplex', name: 'Co-op Duplex' },
        { value: 'condominium', name: 'Condominium' },
        { value: 'medical_office', name: 'Medical Office' },
        { value: 'professional_office', name: 'Professional Office Building' },
        { value: 'quadplex', name: 'Quadplex' },
        { value: 'single_family', name: 'Single Family' },
        { value: 'triplex', name: 'Triplex' },
      ],
    },
    {
      category: 'Retail',
      types: [
        { value: 'anchored_center', name: 'Anchored Center' },
        { value: 'mall', name: 'Mall' },
        { value: 'nnn_retail', name: 'NNN Retail' },
        { value: 'restaurant', name: 'Restaurant' },
        { value: 'retail_land', name: 'Retail Land' },
        { value: 'single_tenant', name: 'Single Tenant' },
        { value: 'strip_mall', name: 'Strip Mall' },
      ],
    },
    {
      category: 'Special Purpose Loans',
      types: [
        { value: 'car_dealership', name: 'Car Dealership' },
        { value: 'church', name: 'Church' },
        { value: 'data_center', name: 'Data Center' },
        { value: 'daycare', name: 'Daycare' },
        { value: 'energy_park', name: 'Energy Park' },
        { value: 'farm', name: 'Farm' },
        { value: 'gas_station', name: 'Gas Station' },
        { value: 'golf_course', name: 'Golf Course' },
        { value: 'marina', name: 'Marina' },
        { value: 'mobile_home', name: 'Mobile Home' },
        { value: 'other', name: 'Other' },
        { value: 'parking_garage', name: 'Parking Garage' },
        { value: 'r_and_d', name: 'R&D' },
        { value: 'resort_rv_park', name: 'Resort RV Park' },
        { value: 'service_station', name: 'Service Station' },
        { value: 'stadium', name: 'Stadium' },
      ],
    },
  ];

  constructor(private formBuilder: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  // Initialize form with validations
  private initializeForm(): void {
    // Create form controls for property category
    const propertyCategoryGroup: Record<string, FormControl> = {};
    this.propertyCategory.forEach((type) => {
      propertyCategoryGroup[type.value] = new FormControl(false);
    });

    // Create form controls for property types from all categories
    const propertyTypesGroup: Record<string, FormControl> = {};
    this.propertyTypes.forEach((category) => {
      category.types.forEach((type) => {
        propertyTypesGroup[type.value] = new FormControl(false);
      });
    });

    this.lenderForm = this.formBuilder.group(
      {
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        contactPhone: [
          '',
          [
            Validators.required,
            Validators.pattern(
              /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/
            ),
          ],
        ],
        contactEmail: ['', [Validators.required, Validators.email]],
        city: ['', Validators.required],
        state: ['', Validators.required],
        minLoanAmount: ['', [Validators.required, Validators.min(1)]],
        maxLoanAmount: ['', [Validators.required, Validators.min(1)]],
        lendingFootprint: [[] as string[], Validators.required],
        propertyTypes: this.formBuilder.group(propertyCategoryGroup, {
          validators: this.atLeastOneCheckboxSelected,
        }),
        lenderType: ['', Validators.required],
        propertyClasses: this.formBuilder.group(propertyTypesGroup, {
          validators: this.atLeastOneCheckboxSelected,
        }),
      },
      { validators: this.validateLoanAmounts }
    );
  }

  // Toggle dropdown visibility
  toggleDropdown(dropdown: string): void {
    this.activeDropdown = this.activeDropdown === dropdown ? null : dropdown;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-checkbox-container')) {
      this.activeDropdown = null;
    }
  }

  // Check if a state is selected
  isStateSelected(stateValue: string): boolean {
    const selectedStates = this.lenderForm.get('lendingFootprint')?.value || [];
    return selectedStates.includes(stateValue);
  }

  // Toggle state selection
  toggleState(stateValue: string): void {
    const lendingFootprint = this.lenderForm.get('lendingFootprint');
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
    const selectedStates = this.lenderForm.get('lendingFootprint')?.value || [];
    return selectedStates.length === this.states.length;
  }

  // Toggle all states
  toggleAllStates(): void {
    const lendingFootprint = this.lenderForm.get('lendingFootprint');
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

  // Get display text for selected states
  getSelectedStatesText(): string {
    const selectedStates = this.lenderForm.get('lendingFootprint')?.value || [];

    if (selectedStates.length === 0) {
      return 'Select States';
    } else if (selectedStates.length === this.states.length) {
      return 'All States Selected';
    } else if (selectedStates.length <= 2) {
      // Show the actual state names if only a few selected
      return selectedStates
        .map(
          (value: string) =>
            this.states.find((state) => state.value === value)?.name
        )
        .join(', ');
    } else {
      // Show count if many states selected
      return `${selectedStates.length} States Selected`;
    }
  }

  // Custom validator for ensuring at least one checkbox is selected
  private atLeastOneCheckboxSelected(
    control: AbstractControl
  ): ValidationErrors | null {
    const controls = control as FormGroup;
    const isAtLeastOneSelected = Object.keys(controls.controls).some(
      (key) => controls.get(key)?.value
    );

    return isAtLeastOneSelected ? null : { required: true };
  }

  // Custom validator to ensure max loan amount is greater than min loan amount
  private validateLoanAmounts(
    control: AbstractControl
  ): ValidationErrors | null {
    const minLoanAmount = parseFloat(control.get('minLoanAmount')?.value);
    const maxLoanAmount = parseFloat(control.get('maxLoanAmount')?.value);

    if (minLoanAmount && maxLoanAmount && maxLoanAmount <= minLoanAmount) {
      control.get('maxLoanAmount')?.setErrors({ min: true });
      return { invalidLoanRange: true };
    }

    return null;
  }

  // Format phone number on blur
  formatPhoneNumber(): void {
    const phoneControl = this.lenderForm.get('contactPhone');
    if (phoneControl?.value) {
      let phoneNumber = phoneControl.value.replace(/\D/g, '');
      if (phoneNumber.length === 10) {
        const formattedNumber = `(${phoneNumber.substring(
          0,
          3
        )}) ${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6)}`;
        phoneControl.setValue(formattedNumber, { emitEvent: false });
      }
    }
  }

  // Handle form submission
  onSubmit(): void {
    this.submitted = true;
    this.successMessage = '';
    this.errorMessage = '';

    // Stop if the form is invalid
    if (this.lenderForm.invalid) {
      // Scroll to the first invalid control
      const firstInvalidElement = document.querySelector('.invalid');
      if (firstInvalidElement) {
        firstInvalidElement.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    this.isLoading = true;

    // Process the form data
    const formData = this.prepareFormData();
    console.log('Form submitted successfully:', formData);

    // Simulate API call
    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Lender information successfully submitted!';

      // Optional: Reset form after successful submission
      // this.onReset();

      // Call your service to send the data to the backend
      // this.lenderService.submitLenderInfo(formData).subscribe(response => {
      //   this.isLoading = false;
      //   this.successMessage = 'Lender information successfully submitted!';
      // }, error => {
      //   this.isLoading = false;
      //   this.errorMessage = 'Failed to submit information. Please try again.';
      // });
    }, 1500);
  }

  // Prepare form data for submission
  private prepareFormData(): any {
    const formValue = this.lenderForm.value as Record<string, any>;

    // Process property types to create an array of selected types
    const propertyTypesValue = formValue['propertyTypes'] || {};
    const selectedPropertyTypes = Object.keys(propertyTypesValue)
      .filter((key) => propertyTypesValue[key])
      .map((key) => key);

    // Process property classes to create an array of selected classes
    const propertyClassesValue = formValue['propertyClasses'] || {};
    const selectedPropertyClasses = Object.keys(propertyClassesValue)
      .filter((key) => propertyClassesValue[key])
      .map((key) => key);

    return {
      firstName: formValue['firstName'],
      lastName: formValue['lastName'],
      contactPhone: formValue['contactPhone'],
      contactEmail: formValue['contactEmail'],
      city: formValue['city'],
      state: formValue['state'],
      loanAmounts: {
        min: parseFloat(formValue['minLoanAmount'] || '0'),
        max: parseFloat(formValue['maxLoanAmount'] || '0'),
      },
      lendingFootprint: formValue['lendingFootprint'],
      propertyTypes: selectedPropertyTypes,
      lenderType: formValue['lenderType'],
      propertyClasses: selectedPropertyClasses,
    };
  }

  // Reset the form
  onReset(): void {
    this.submitted = false;
    this.successMessage = '';
    this.errorMessage = '';
    this.lenderForm.reset();
  }
}
