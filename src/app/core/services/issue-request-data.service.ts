import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '@constants/app.constants';
import { APIOperationResponse } from '@models/api-response.model';
import { RequestPurposeDto, RequestPurposeState } from '@pages/new-issue-request/new-issue-request.state';
import { normalizeArrayResponse } from '@utils/index';
import { TranslateService } from '@ngx-translate/core';
import { getLocalizedName, getCurrentLang } from '@utils/localization.utils';
import { DropdownOption } from '@components/dropdown/dropdown.component';

/**
 * Service responsible for loading data operations for issue request
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestDataService {
  constructor(
    private apiService: ApiService,
    private translate: TranslateService
  ) { }

  /**
   * Loads request purposes from API
   * @returns Observable of request purposes
   */
  loadRequestPurposes(): Observable<RequestPurposeDto[]> {
    return this.apiService
      .getWithAuth<APIOperationResponse<RequestPurposeDto[]>>(
        API_ENDPOINTS.REQUEST_PURPOSES.FOR_ORDER
      )
      .pipe(
        map(response => normalizeArrayResponse<RequestPurposeDto>(response))
      );
  }

  /**
   * Rebuilds request purpose options from source data
   * @param requestPurposeState - Request purpose state to update
   * @returns Map of request purpose ID to use purpose text
   */
  rebuildRequestPurposeOptions(requestPurposeState: RequestPurposeState): Map<number, { usePurpose: string }> {
    const currentLang = getCurrentLang(this.translate);
    const optionsMap = new Map<number, { usePurpose: string }>();

    requestPurposeState.requestPurposeOptions = requestPurposeState.requestPurposesSource.map(p => ({
      label: getLocalizedName(p, currentLang),
      value: p.id
    }));

    // Also update map for auto-fill
    requestPurposeState.requestPurposesSource.forEach(p => {
      optionsMap.set(p.id, { usePurpose: getLocalizedName(p, currentLang) });
    });

    return optionsMap;
  }

  /**
   * Updates use purpose from selected request purpose ID
   * @param id - Request purpose ID
   * @param optionsMap - Map of request purpose options
   * @param usageFormData - Usage form data to update
   */
  updateUsePurposeFromSelection(
    id: number | null,
    optionsMap: Map<number, { usePurpose: string }>,
    usageFormData: { usePurpose: string }
  ): void {
    if (id && optionsMap.has(id)) {
      usageFormData.usePurpose = optionsMap.get(id)?.usePurpose || '';
    }
  }

  /**
   * Rebuilds order priorities options
   * @returns Array of order priority dropdown options
   */
  rebuildOrderPriorities(): DropdownOption<string>[] {
    return [
      { label: 'newIssueRequest.normalPriority', value: 'Normal' },
      { label: 'newIssueRequest.urgentPriority', value: 'Urgent' },
      { label: 'newIssueRequest.veryUrgentPriority', value: 'Very Urgent' }
    ];
  }
}

