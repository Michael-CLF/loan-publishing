import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConstructionLoanDrawComponent } from './construction-loan-draw.component';

describe('ConstructionLoanDrawComponent', () => {
  let component: ConstructionLoanDrawComponent;
  let fixture: ComponentFixture<ConstructionLoanDrawComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConstructionLoanDrawComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConstructionLoanDrawComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
