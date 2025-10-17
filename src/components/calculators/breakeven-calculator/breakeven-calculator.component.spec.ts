import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BreakevenCalculatorComponent } from './breakeven-calculator.component';

describe('BreakevenCalculatorComponent', () => {
  let component: BreakevenCalculatorComponent;
  let fixture: ComponentFixture<BreakevenCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreakevenCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BreakevenCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
