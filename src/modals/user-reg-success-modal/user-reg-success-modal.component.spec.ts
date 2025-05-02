import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserRegSuccessModalComponent } from './user-reg-success-modal.component';

describe('UserRegSuccessModalComponent', () => {
  let component: UserRegSuccessModalComponent;
  let fixture: ComponentFixture<UserRegSuccessModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserRegSuccessModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserRegSuccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
