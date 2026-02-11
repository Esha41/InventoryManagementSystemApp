import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { BackendAuthService } from '@services/backend-auth.service';
import { StorageService } from '@services/storage.service';

/**
 * Structural directive for permission-based rendering
 * 
 * Usage:
 * <div *appHasPermission="'users-create'">
 *   <!-- Content visible only if user has 'users-create' permission -->
 * </div>
 * 
 * <button *appHasPermission="['users-edit', 'users-delete']" appPermissionMode="any">
 *   <!-- Visible if user has ANY of the specified permissions -->
 * </button>
 * 
 * <button *appHasPermission="['users-edit', 'users-delete']" appPermissionMode="all">
 *   <!-- Visible if user has ALL of the specified permissions -->
 * </button>
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  @Input() appHasPermission: string | string[] = [];
  @Input() appPermissionMode: 'any' | 'all' = 'any';
  
  private destroy$ = new Subject<void>();
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: BackendAuthService,
    private storageService: StorageService
  ) {}

  ngOnInit(): void {
    this.checkPermissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkPermissions(): void {
    // Check if user is authenticated
    if (!this.authService.isAuthenticated()) {
      this.hideContent();
      return;
    }

    const requiredPermissions = Array.isArray(this.appHasPermission) 
      ? this.appHasPermission 
      : [this.appHasPermission];

    if (requiredPermissions.length === 0) {
      this.showContent();
      return;
    }

    // Check permissions using the auth service
    const hasPermission = this.appPermissionMode === 'all'
      ? this.authService.hasAllPermissions(requiredPermissions)
      : this.authService.hasAnyPermission(requiredPermissions);

    if (hasPermission) {
      this.showContent();
    } else {
      this.hideContent();
    }
  }

  private showContent(): void {
    if (!this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    }
  }

  private hideContent(): void {
    if (this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

