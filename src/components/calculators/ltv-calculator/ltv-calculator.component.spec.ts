import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LtvCalculatorComponent } from './ltv-calculator.component';

describe('LtvCalculatorComponent', () => {
  let component: LtvCalculatorComponent;
  let fixture: ComponentFixture<LtvCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LtvCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LtvCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
