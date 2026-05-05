# Feature Modules Overview

**Document Version**: 1.0

## 16 Feature Modules

| # | Module | Purpose | Route | Complexity |
|---|--------|---------|-------|-----------|
| 1 | Admin | User/role management, analytics | /admin/* | High |
| 2 | Auth | Login, password reset, role selection | /auth/* | Medium |
| 3 | Assets | Asset management (weapons, ammo) | /assets/* | Medium |
| 4 | Dashboard | Main dashboard with KPIs | /dashboard | Low |
| 5 | Department | Department management | /department/* | Low |
| 6 | Forecast | Inventory forecasting | /forecast | Medium |
| 7 | Help | User help center | /help | Low |
| 8 | Help Center | Admin help management | /admin/help-center | Medium |
| 9 | Inventory | Inventory overview, monitoring | /inventory-dashboard/* | Medium |
| 10 | Notifications | User notifications | /notifications | Low |
| 11 | Onboarding | Onboarding tours | (In-app) | Low |
| 12 | Profile | User profile, delegations | /profile/* | Medium |
| 13 | Reports | DevExpress reporting | /reports/* | High |
| 14 | Requests | Supply workflows | /requests/* | **Very High** |
| 15 | Settings | App configuration | /settings/* | Medium |
| 16 | Warehouse | Warehouse inventory | /warehouse/* | **Very High** |
| 17 | Workflow | Workflow management | /workflow/* | Medium |

## Most Complex Modules

### Requests (Supply Workflows)
- Multi-step supply order workflows
- New issue request with item selection
- Return request processing
- Discard request handling
- Multi-tier approval workflows with timeline
- Lot selection and batch tracking
- Auto-rejection countdown logic

### Warehouse (Inventory Management)
- Warehouse-distributed inventory
- Multiple item types: Weapon, Ammunition, Cartridge, Explosive
- Batch and lot management
- Low stock monitoring
- Expiration tracking
- Warehouse mapping (Leaflet)
- Bulk weapon entry

### Admin (System Administration)
- User management (CRUD operations)
- Role and permission management
- Analytics dashboards (KPIs, charts)
- Import/export functionality
- Lookup table management
- Help center article management
- System announcements

## Feature Dependencies

All features depend on:
- @core/services (API, Auth, Config, Storage)
- @models (Domain models)
- RxJS (Observable streams)
- Angular Common (CommonModule, pipes)
- Reactive Forms (form handling)

Special dependencies:
- Admin: ECharts, Chart.js for analytics
- Reports: DevExpress Reporting Suite
- Warehouse: Leaflet for maps, file upload
- Requests: Complex forms, approval workflows
