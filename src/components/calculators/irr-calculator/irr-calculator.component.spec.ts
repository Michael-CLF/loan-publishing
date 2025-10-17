import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IrrCalculatorComponent } from './irr-calculator.component';

describe('IrrCalculatorComponent', () => {
  let component: IrrCalculatorComponent;
  let fixture: ComponentFixture<IrrCalculatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IrrCalculatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IrrCalculatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
