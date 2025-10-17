import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CapRateCalculatorComponent } from './cap-rate-calculator.component';

describe('CapRateCalculatorComponent', () => {
  let component: CapRateCalculatorComponent;
  let fixture: ComponentFixture<CapRateCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CapRateCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CapRateCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
