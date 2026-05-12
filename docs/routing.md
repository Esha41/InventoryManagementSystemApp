# Routing Architecture

**Document Version**: 1.0

## Route Structure

### Main Routes (app.routes.ts)

```typescript
export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayoutComponent,
    loadChildren: () => import('./features/auth/auth.routes')
      .then(m => m.AUTH_ROUTES)
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],  // Protects all authenticated routes
    children: [
      // Lazy-loaded features...
    ]
  },
  {
    path: '**',
    redirectTo: ''  // Unknown URLs → root
  }
];
```

## Layout Components

### AuthLayoutComponent
- Used for `/auth/*` routes
- No navbar, sidebar
- Login, password reset, role selection

### MainLayoutComponent
- Used for all authenticated routes (path: '')
- Includes navbar, sidebar, main content area
- All protected by authGuard

## Protected Routes

All routes under MainLayoutComponent are protected by authGuard:

```typescript
{
  path: '',
  component: MainLayoutComponent,
  canActivate: [authGuard],  // Redirects to login if not authenticated
  children: [
    {
      path: 'warehouse',
      loadChildren: () => import('./features/warehouse/warehouse.routes')
        .then(m => m.WAREHOUSE_ROUTES),
      canActivate: [permissionGuard],
      data: { permissions: ['warehouse.page'] }
    },
    // ... more routes
  ]
}
```

## Feature Routes (Lazy-Loaded)

Each feature has a [feature].routes.ts file:

### Warehouse Routes
```typescript
path: ''  → WarehouseListComponent
path: ':id/inventory'  → WarehouseInventoryComponent
path: ':id/inventory/add'  → AddInventoryComponent
path: ':warehouseId/inventory/:itemId'  → InventoryItemDetailComponent
path: ':warehouseId/inventory/:itemId/map'  → WarehouseMapComponent
path: ':id/assets/add'  → AddWeaponAssetComponent
path: ':id/assets/add/bulk-entry'  → BulkEntryComponent
path: ':warehouseId/assets/:id'  → AssetDetailsComponent
path: ':warehouseId/assets/:id/map'  → WarehouseMapComponent
```

### Requests Routes
```typescript
path: 'supply-order'  → SupplyOrderListComponent
path: 'supply-order/:supplyId'  → SupplyOrderComponent
path: 'new-issue-request'  → NewIssueRequestComponent
path: 'return-request'  → ReturnRequestComponent
path: 'discard-request'  → DiscardRequestComponent
path: 'requests-management'  → RequestsManagementComponent
path: 'requests-management/requests-report'  → OrderReportComponent (Requests Report UI). Legacy `order-report` redirects here.
path: 'requests-management/:id/workflow-approval'  → WorkflowApprovalDetailComponent
```

### Admin Routes
```typescript
path: 'dashboard'  → AdminDashboardComponent
path: 'analytics-dashboard'  → AnalyticsDashboardComponent
path: 'depot-management'  → DepotManagementComponent
path: 'manage-admins'  → ManageAdminsComponent
path: 'lookup-tables'  → LookupTablesComponent
path: 'roles'  → AdminRolesComponent
path: 'role-permissions'  → RolePermissionsComponent
path: 'import-export'  → AdminImportExportComponent
path: 'help-center'  → HelpCenterManagementComponent
path: 'announcements'  → AnnouncementsComponent
```

## Route Guards

### authGuard

Protects authenticated routes. Activated on MainLayoutComponent.

**Behavior**:
1. Checks if user is authenticated
2. If yes: Allow access
3. If no: Attempt silent session restore
4. If restore succeeds: Allow access
5. If restore fails: Redirect to /auth/login with returnUrl

**Usage**:
```typescript
{
  path: '',
  component: MainLayoutComponent,
  canActivate: [authGuard]
}
```

### permissionGuard

Enforces role-based access control.

**Behavior**:
1. Reads route.data.permissions array
2. Checks if user has ALL permissions
3. If yes: Allow access
4. If no: Redirect to /access-denied

**Usage**:
```typescript
{
  path: 'admin/users',
  canActivate: [permissionGuard],
  data: { permissions: ['systemusers.page', 'systemusers.view'] }
}
```

**Permission Keys**: Defined in core/constants/permissions.constants.ts
- Example: 'warehouse.page', 'warehouse.inventory.view', 'admin.dashboard.page'

## Navigation

### Programmatic Navigation

```typescript
constructor(private router: Router) {}

// Navigate to route
this.router.navigate(['/warehouse', warehouseId, 'inventory']);

// Navigate with query params
this.router.navigate(['/warehouse'], { queryParams: { page: 2 } });

// Navigate with relative path
this.router.navigate(['../parent'], { relativeTo: this.route });
```

### Template Navigation

```html
<!-- Use routerLink -->
<a routerLink="/warehouse">Warehouse</a>

<!-- With parameters -->
<a [routerLink]="['/warehouse', warehouseId]">Warehouse Detail</a>

<!-- Highlight active route -->
<a routerLink="/admin/dashboard" routerLinkActive="active">Admin</a>
```

## Route Parameters

### Path Parameters

```typescript
// In route definition
path: ':warehouseId/inventory/:itemId'

// In component
constructor(private route: ActivatedRoute) {}

ngOnInit() {
  this.route.params.subscribe(params => {
    this.warehouseId = params['warehouseId'];
    this.itemId = params['itemId'];
  });
}

// Or snapshot (if params don't change)
this.itemId = this.route.snapshot.params['itemId'];
```

### Query Parameters

```typescript
// Pass
this.router.navigate(['/warehouse'], { queryParams: { page: 2, sort: 'name' } });

// Receive
this.route.queryParams.subscribe(params => {
  this.page = params['page'];
  this.sort = params['sort'];
});
```

## Lazy Loading

All features are lazy-loaded:

```typescript
{
  path: 'warehouse',
  loadChildren: () => import('./features/warehouse/warehouse.routes')
    .then(m => m.WAREHOUSE_ROUTES)  // Loaded on first access
}
```

**Benefits**:
- Initial bundle smaller
- Sub-features loaded on-demand
- Better perceived performance

## URL Structure

### Example URLs

- `/` - Dashboard (root, authenticated)
- `/auth/login` - Login page
- `/auth/forgot-password` - Password reset
- `/auth/select-role` - Role selection
- `/warehouse` - Warehouse list
- `/warehouse/1/inventory` - Warehouse 1 inventory
- `/warehouse/1/inventory/add` - Add inventory
- `/warehouse/1/inventory/42` - Inventory item 42
- `/requests/supply-order` - Supply orders
- `/requests/requests-management` - Request management
- `/admin/dashboard` - Admin dashboard
- `/admin/users` - User management
- `/assets` - Asset list
- `/profile` - User profile
- `/notifications` - Notifications
- `/settings` - Settings

## Error Handling

### Access Denied

If user lacks permissions:
```
Router → permissionGuard → Check permissions → Redirect to /access-denied
```

Component: `features/auth/pages/access-denied/access-denied.component.ts`

### Invalid Routes

Unknown routes:
```
path: '**' → Redirect to '/' (root)
```

On redirect, authGuard checks authentication, restores session if needed.

## Route Data

Routes can pass metadata via data:

```typescript
{
  path: 'warehouse',
  loadChildren: () => import('./features/warehouse/warehouse.routes')
    .then(m => m.WAREHOUSE_ROUTES),
  data: { 
    permissions: ['warehouse.page', 'warehouse.view'],
    breadcrumb: 'Warehouse'
  }
}
```

Access in component:
```typescript
this.route.data.subscribe(data => {
  console.log(data['permissions']);
});
```

## Summary

- **authGuard**: Protects all authenticated routes
- **permissionGuard**: Enforces RBAC
- **Lazy Loading**: Features loaded on-demand
- **Path Aliases**: Clean URL structure
- **Error Handling**: Unauthorized → redirect to access-denied
