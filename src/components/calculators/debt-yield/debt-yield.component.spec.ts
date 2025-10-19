import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DebtYieldComponent } from './debt-yield.component';

describe('DebtYieldComponent', () => {
  let component: DebtYieldComponent;
  let fixture: ComponentFixture<DebtYieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DebtYieldComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DebtYieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
