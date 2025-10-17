import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DscrCalculatorComponent } from './dscr-calculator.component';

describe('DscrCalculatorComponent', () => {
  let component: DscrCalculatorComponent;
  let fixture: ComponentFixture<DscrCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DscrCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DscrCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
