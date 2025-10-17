import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FixFlipCalculatorComponent } from './fix-flip-calculator.component';

describe('FixFlipCalculatorComponent', () => {
  let component: FixFlipCalculatorComponent;
  let fixture: ComponentFixture<FixFlipCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FixFlipCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FixFlipCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
