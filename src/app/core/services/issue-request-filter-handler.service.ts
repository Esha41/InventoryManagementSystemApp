import { Injectable } from '@angular/core';
import { FilterState } from '@pages/new-issue-request/new-issue-request.state';
import { IssueRequestFilterService } from './issue-request-filter.service';

/**
 * Service responsible for handling filter changes
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestFilterHandlerService {
  constructor(
    private filterService: IssueRequestFilterService
  ) {}

  /**
   * Updates filter value and triggers filtering
   * @param filterState - Filter state to update
   * @param filterKey - Key of filter to update
   * @param value - New filter value
   * @param allCartridges - All cartridges to filter
   * @returns Filtered cartridges
   */
  updateFilterAndFilter(
    filterState: FilterState,
    filterKey: keyof FilterState,
    value: string,
    allCartridges: any[]
  ): any[] {
    (filterState as any)[filterKey] = value;
    return this.filterService.filterCartridges(allCartridges, filterState);
  }

  /**
   * Clears all filters for current item type
   * @param filterState - Filter state to clear
   * @param itemType - Current item type
   * @param allCartridges - All cartridges to filter
   * @returns Filtered cartridges
   */
  clearFiltersAndFilter(
    filterState: FilterState,
    itemType: string,
    allCartridges: any[]
  ): any[] {
    this.filterService.clearFilters(filterState, itemType);
    return this.filterService.filterCartridges(allCartridges, filterState);
  }
}

