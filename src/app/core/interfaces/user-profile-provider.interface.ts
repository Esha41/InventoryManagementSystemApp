import { AuthenticatedUser } from '@models/auth.model';


export interface IUserProfileProvider {
  saveProfile(user: AuthenticatedUser, apiResponse?: any): void;
  clearProfile(): void;
}
