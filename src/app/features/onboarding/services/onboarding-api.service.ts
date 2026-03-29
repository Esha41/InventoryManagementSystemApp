import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@services/api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { OnboardingStatus } from '../models/onboarding.model';

@Injectable({
  providedIn: 'root'
})
export class OnboardingApiService {
  constructor(private apiService: ApiService) {}

  getStatus(): Observable<OnboardingStatus> {
    return this.apiService.get<OnboardingStatus>(API_ENDPOINTS.ONBOARDING.STATUS);
  }

  markComplete(): Observable<boolean> {
    return this.apiService.post<boolean>(API_ENDPOINTS.ONBOARDING.COMPLETE, {});
  }
}
