import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CartridgeState } from '@requests/pages/new-issue/new-issue-request.state';

export interface IssueRequestQueryParams {
  step?: number;
  fromReserve?: string;
  selections?: string;
}

export interface QueryParamsState {
  step: number;
  fromReserve: string;
  pendingSelections: Array<{ id: number; quantity: number; itemType?: string }> | null;
}

/**
 * Service responsible for managing component state and query parameter persistence
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestStateService {
  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  /**
   * Gets query parameters as observable
   * @param stepsLength - Length of steps array to validate step parameter
   * @returns Observable of query params state
   */
  getQueryParamsState(stepsLength: number): Observable<QueryParamsState> {
    return this.route.queryParams.pipe(
      map(params => {
        const stepParam = params['step'];
        let step = 0;
        if (stepParam !== undefined) {
          const parsedStep = parseInt(stepParam, 10);
          if (!isNaN(parsedStep) && parsedStep >= 0 && parsedStep < stepsLength) {
            step = parsedStep;
          }
        }

        const fromReserve = params['fromReserve'] || 'Yes';

        let pendingSelections: Array<{ id: number; quantity: number; itemType?: string }> | null = null;
        const selectionsParam = params['selections'];
        if (selectionsParam) {
          try {
            pendingSelections = JSON.parse(selectionsParam);
          } catch (error) {
            console.error('Failed to parse selections from query params:', error);
            pendingSelections = null;
          }
        }

        return { step, fromReserve, pendingSelections };
      })
    );
  }

  /**
   * Updates query parameters with current state
   * @param step - Current step number
   * @param fromReserve - From reserve value
   * @param selectedEntries - Selected cartridge entries
   */
  updateQueryParams(step: number, fromReserve: string, selectedEntries: Array<{ id: number; quantity: number; itemType?: string }>): void {
    const queryParams: IssueRequestQueryParams = {
      step: step,
      fromReserve: fromReserve
    };

    // Persist selected entries if there are any
    if (selectedEntries.length > 0) {
      queryParams.selections = JSON.stringify(selectedEntries);
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Persists selected entries to query params
   * @param selectedEntries - Selected cartridge entries
   */
  persistSelections(selectedEntries: Array<{ id: number; quantity: number; itemType?: string }>): void {
    const queryParams: IssueRequestQueryParams = {};
    if (selectedEntries.length > 0) {
      queryParams.selections = JSON.stringify(selectedEntries);
    } else {
      // Remove selections param if no selections
      queryParams.selections = undefined;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge'
    });
  }

  /**
   * Restores selected entries from pending selections and updates cartridge state
   * @param pendingSelections - Pending selections to restore
   * @param cartridgeState - Cartridge state to update
   */
  restoreSelections(
    pendingSelections: Array<{ id: number; quantity: number; itemType?: string }> | null,
    cartridgeState: CartridgeState
  ): void {
    if (!pendingSelections || !Array.isArray(pendingSelections) || pendingSelections.length === 0) {
      return;
    }

    // Restore selected entries
    cartridgeState.selectedEntries = pendingSelections;

    // Update cartridge state to reflect selections
    pendingSelections.forEach(entry => {
      const cartridge = cartridgeState.allCartridges.find(c => c.id === entry.id);
      if (cartridge) {
        cartridge.selected = true;
        cartridge.added = true;
        cartridge.quantity = entry.quantity;
        // Preserve itemType if available
        if (entry.itemType) {
          cartridge.itemType = entry.itemType;
        }
        // Cache the cartridge to preserve it across item type changes
        if (cartridgeState.selectedCartridgesCache) {
          cartridgeState.selectedCartridgesCache.set(cartridge.id, { ...cartridge });
        }
      }
    });
  }
}

