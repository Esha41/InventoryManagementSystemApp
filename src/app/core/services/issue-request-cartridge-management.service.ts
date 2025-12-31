import { Injectable } from '@angular/core';
import { Cartridge } from '@pages/new-issue-request/components/cartridge-list/cartridge-list.component';
import { CartridgeState } from '@pages/new-issue-request/new-issue-request.state';
import { IssueRequestStateService } from './issue-request-state.service';

/**
 * Service responsible for managing cartridge selection and state
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestCartridgeManagementService {
  constructor(
    private stateService: IssueRequestStateService
  ) {}

  /**
   * Adds a cartridge to selected entries
   * @param cartridge - Cartridge to add
   * @param quantity - Quantity to add
   * @param cartridgeState - Cartridge state to update
   */
  addCartridge(
    cartridge: Cartridge,
    quantity: number,
    cartridgeState: CartridgeState
  ): void {
    const existingIndex = cartridgeState.selectedEntries.findIndex(entry => entry.id === cartridge.id);
    if (existingIndex >= 0) {
      cartridgeState.selectedEntries[existingIndex].quantity = quantity;
    } else {
      cartridgeState.selectedEntries.push({ id: cartridge.id, quantity });
    }

    const target = cartridgeState.allCartridges.find(c => c.id === cartridge.id);
    if (target) {
      target.added = true;
      target.selected = true;
      target.quantity = quantity;
    }
  }

  /**
   * Removes a cartridge from selected entries
   * @param cartridgeId - ID of cartridge to remove
   * @param cartridgeState - Cartridge state to update
   */
  removeCartridge(
    cartridgeId: number,
    cartridgeState: CartridgeState
  ): void {
    cartridgeState.selectedEntries = cartridgeState.selectedEntries.filter(entry => entry.id !== cartridgeId);
    const target = cartridgeState.allCartridges.find(c => c.id === cartridgeId);
    if (target) {
      target.selected = false;
      target.added = false;
      target.quantity = null;
    }
  }

  /**
   * Persists selections to query params
   * @param selectedEntries - Selected entries to persist
   */
  persistSelections(selectedEntries: Array<{ id: number; quantity: number }>): void {
    this.stateService.persistSelections(selectedEntries);
  }
}

