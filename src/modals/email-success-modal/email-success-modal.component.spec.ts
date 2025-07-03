import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailSuccessModalComponent } from './email-success-modal.component';

describe('EmailSuccessModalComponent', () => {
  let component: EmailSuccessModalComponent;
  let fixture: ComponentFixture<EmailSuccessModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailSuccessModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailSuccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
