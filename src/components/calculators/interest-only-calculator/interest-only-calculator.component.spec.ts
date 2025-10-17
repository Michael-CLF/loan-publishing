import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterestOnlyCalculatorComponent } from './interest-only-calculator.component';

describe('InterestOnlyCalculatorComponent', () => {
  let component: InterestOnlyCalculatorComponent;
  let fixture: ComponentFixture<InterestOnlyCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterestOnlyCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterestOnlyCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
