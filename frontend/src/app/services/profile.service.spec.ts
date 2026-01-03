import { TestBed } from '@angular/core/testing';
import { ProfileService } from './profile.service';
import { of } from 'rxjs';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpSpy: any;
  let userServiceSpy: any;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get']);
    userServiceSpy = jasmine.createSpyObj('UserService', ['updateUser', 'getUserById']);

    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: (ProfileService as any).constructor['__proto__'], useValue: {} }
      ]
    });

    service = new ProfileService(httpSpy, userServiceSpy);
  });

  it('should list available icons', async () => {
    httpSpy.get.and.returnValue(of(['assets/avatares/a.png','assets/avatares/b.png']));
    const icons = await service.listAvailableIcons();
    expect(icons.length).toBe(2);
    expect(httpSpy.get).toHaveBeenCalled();
  });

  it('should call userService.updateUser on updateProfile', async () => {
    userServiceSpy.updateUser.and.returnValue(Promise.resolve());
    await service.updateProfile('uid123', { displayName: 'Novo' });
    expect(userServiceSpy.updateUser).toHaveBeenCalledWith('uid123', { displayName: 'Novo' });
  });
});