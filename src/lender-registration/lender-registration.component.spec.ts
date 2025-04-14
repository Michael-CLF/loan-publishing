import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LenderRegistrationComponent } from './lender-registration.component';

describe('LenderRegistrationComponent', () => {
  let component: LenderRegistrationComponent;
  let fixture: ComponentFixture<LenderRegistrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LenderRegistrationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LenderRegistrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
