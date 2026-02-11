import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { IssueRequestStateService } from './issue-request-state.service';

export interface StepNavigationResult {
  canProceed: boolean;
  nextStep?: number;
  error?: string;
}

/**
 * Service responsible for step navigation logic in new issue request flow
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestNavigationService {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private stateService: IssueRequestStateService
  ) {}

  /**
   * Validates if can proceed from current step
   * @param currentStep - Current step number
   * @param canProceedFromSelection - Whether can proceed from selection step
   * @param submittingOrder - Whether order is being submitted
   * @returns Navigation result
   */
  canProceedToNextStep(
    currentStep: number,
    canProceedFromSelection: boolean,
    submittingOrder: boolean
  ): StepNavigationResult {
    if (submittingOrder) {
      return { canProceed: false, error: 'Order submission in progress' };
    }

    // Step 0: Allowance selection - always can proceed
    if (currentStep === 0) {
      return { canProceed: true, nextStep: 1 };
    }

    // Step 1: Cartridge selection - need valid selection
    if (currentStep === 1) {
      if (!canProceedFromSelection) {
        return { canProceed: false, error: 'Please select at least one item' };
      }
      return { canProceed: true, nextStep: 2 };
    }

    // Step 2: Usage form - can proceed to review
    if (currentStep === 2) {
      return { canProceed: true, nextStep: 3 };
    }

    // Step 3: Review - triggers submission
    if (currentStep === 3) {
      return { canProceed: true, nextStep: 4 };
    }

    // Step 4: Success - no next step
    return { canProceed: false };
  }

  /**
   * Validates if can go to previous step
   * @param currentStep - Current step number
   * @returns Previous step number or null
   */
  canGoToPreviousStep(currentStep: number): number | null {
    if (currentStep > 0) {
      return currentStep - 1;
    }
    return null;
  }
}

