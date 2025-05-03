import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeletePublishedLoanComponent } from './delete-published-loan.component';

describe('DeletePublishedLoanComponent', () => {
  let component: DeletePublishedLoanComponent;
  let fixture: ComponentFixture<DeletePublishedLoanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletePublishedLoanComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletePublishedLoanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
