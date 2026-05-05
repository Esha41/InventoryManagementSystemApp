# Architecture Guide

**Document Version**: 1.0

## Layered Architecture

### Four Layers

| Layer | Purpose | Location |
|-------|---------|----------|
| **Core** | Singletons, services, guards, interceptors | src/app/core/ |
| **Features** | Domain logic, pages, components (16 features) | src/app/features/ |
| **Shared** | Reusable UI components | src/app/shared/ |
| **Shell** | App layout and navigation | src/app/shell/ |

### Dependency Flow (Acyclic)
- Features → depends on → Core
- Shared ← used by ← all layers
- Core → depends on → nothing

## Core Layer (22 Services)

### Auth Services
- auth-session.service.ts - Session state (BehaviorSubjects)
- auth-flow.service.ts - Login/logout workflow
- backend-auth.service.ts - API calls for auth
- token-refresh.service.ts - JWT refresh logic
- auth-cross-tab-sync.service.ts - Sync auth across tabs
- session-heartbeat.service.ts - Keep-alive pings

### Core Services
- api.service.ts - Generic HTTP client
- config.service.ts - App config loading
- storage.service.ts - Storage abstraction
- idle.service.ts - Idle timer, auto-logout
- role.service.ts - Permission queries

### Route Guards (Functional)
- **authGuard**: Protects routes, attempts silent restore
- **permissionGuard**: Enforces RBAC, checks route data

### HTTP Interceptors (Functional)
- **authInterceptor**: Attaches JWT token, skips for login
- **errorInterceptor**: Handles 401/403/5xx errors

### Models (50+ domain types)
All TypeScript interfaces for tree-shaking optimization.

## Features Layer (16 Modules)

1. admin - Users, roles, analytics
2. auth - Login, password reset
3. assets - Weapons, ammunition management
4. dashboard - Main dashboard
5. department - Departments
6. forecast - Forecasting
7. help - User help
8. help-center - Admin help management
9. inventory - Inventory overview
10. notifications - Notifications center
11. onboarding - Tours
12. profile - User profile
13. reports - DevExpress reporting
14. requests - Supply workflows (most complex)
15. settings - App settings
16. warehouse - Warehouse inventory

## Data Flow

### Auth Flow
Login → AuthFlowService.login() → HTTP POST /account/login → 
Store tokens → Navigate to dashboard/role-selection

### HTTP Request Flow
Component → Service → HttpClient → authInterceptor (add token) → 
Backend → errorInterceptor (handle errors) → Service returns Observable

### State Management
RxJS Observables (no Redux/NgRx):
- AuthSessionService exposes authState$, currentUser$, isAuthenticated$
- Components consume via async pipe or .subscribe()

## Architectural Patterns

1. **Standalone Components** - No NgModules, smaller bundles
2. **Lazy Loading** - Features loaded on first access
3. **Observable Streams** - RxJS for state and async data
4. **Functional Guards/Interceptors** - Smaller than class-based
5. **RBAC** - Route-level and template-level permission checks

## Path Aliases

@core, @services, @models, @guards, @constants, @features, @shared, @shell, etc.

No relative imports like ../../../core/services

## Module Boundaries

Enforced by eslint-plugin-boundaries:
- Features cannot import other features
- Core cannot import features
- Shared is read-only

Cross-feature communication: Use Core services (singletons).
