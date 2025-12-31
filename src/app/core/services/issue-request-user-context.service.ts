import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { UserContextService } from './user-context.service';
import { BackendAuthService } from './backend-auth.service';
import { BackendUserDto } from '@models/backend-user.model';
import { AuthenticatedUser } from '@models/auth.model';
import { UserContextState } from '@pages/new-issue-request/new-issue-request.state';
import {
  applyUserContext as applyUserContextUtil,
  applyAuthenticatedUserContext as applyAuthenticatedUserContextUtil
} from '@utils/issue-request.utils';

/**
 * Service responsible for managing user context initialization
 * Extracted from NewIssueRequestComponent to follow single responsibility principle
 */
@Injectable({
  providedIn: 'root'
})
export class IssueRequestUserContextService {
  constructor(
    private userContextService: UserContextService,
    private backendAuthService: BackendAuthService
  ) {}

  /**
   * Initializes user context state
   * @param userContextState - User context state to initialize
   * @param destroy$ - Subject for unsubscribing
   * @param syncRequesterNameCallback - Callback to sync requester name
   */
  initializeUserContext(
    userContextState: UserContextState,
    destroy$: any,
    syncRequesterNameCallback: () => void
  ): void {
    userContextState.isAdminUser = this.userContextService.isAdminUser();
    userContextState.lockRequesterName = !userContextState.isAdminUser;

    this.backendAuthService.currentUser$
      .pipe(takeUntil(destroy$))
      .subscribe(user => {
        const context = applyAuthenticatedUserContextUtil(user, userContextState);
        if (context) {
          applyUserContextUtil(context, userContextState);
          // Update requester name if backend details not yet available (fallback)
          if (!userContextState.currentUserDetails) {
            syncRequesterNameCallback();
          }
        }
      });

    this.userContextService
      .getCurrentUserDetails()
      .pipe(takeUntil(destroy$))
      .subscribe(details => {
        userContextState.currentUserDetails = details;
        syncRequesterNameCallback();
      });
  }
}

