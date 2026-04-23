import { InjectionToken } from '@angular/core';
import { IUserProfileProvider } from '../interfaces/user-profile-provider.interface';

export const USER_PROFILE_PROVIDER = new InjectionToken<IUserProfileProvider>('USER_PROFILE_PROVIDER');
