import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RegistrationProcessingComponent } from './registration-processing.component';

describe('RegistrationProcessingComponent', () => {
  let component: RegistrationProcessingComponent;
  let fixture: ComponentFixture<RegistrationProcessingComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', ['getRegistrationSuccess', 'clearRegistrationSuccess', 'getCurrentUser']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [RegistrationProcessingComponent],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RegistrationProcessingComponent);
    component = fixture.componentInstance;
    mockAuthService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    mockRouter = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should redirect to dashboard if no registration success detected', () => {
    mockAuthService.getRegistrationSuccess.and.returnValue(false);
    spyOn(localStorage, 'getItem').and.returnValue(null);
    
    component.ngOnInit();
    
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should show processing spinner initially when registration success detected', () => {
    mockAuthService.getRegistrationSuccess.and.returnValue(true);
    
    expect(component.showProcessingSpinner()).toBe(true);
  });
});