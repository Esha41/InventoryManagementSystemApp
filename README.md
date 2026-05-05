# Ettad Frontend - Supply Chain & Inventory Management System

**Version**: 1.3.0  
**Status**: Production-Ready  
**Last Updated**: 2026-05-03

---

## Project Overview

Ettad Frontend is an enterprise-grade Angular 21.1.0 web application for centralized supply chain, inventory, and asset management. The system manages weapons, ammunition, cartridges, explosives, and general supplies across distributed warehouse locations with role-based access control, multi-tier approval workflows, and comprehensive reporting.

**Key Capabilities**:
- Centralized inventory management with warehouse distribution
- Supply request workflows with multi-tier approvals
- Asset tracking and lifecycle management
- Role-based access control with fine-grained permissions
- Admin dashboards with analytics and KPIs
- Multi-language support (English, Arabic)
- Real-time notifications via SignalR
- Advanced reporting with DevExpress Report Designer

---

## Quick Start

### Prerequisites
- Node.js 18.x or 20.x
- npm 9.x or higher
- Backend API running on `https://localhost:7148/api`

### Installation
```bash
git clone <repository-url>
cd ettadfrontend
npm install
npm start
```

Visit **http://localhost:4200** and login with your credentials.

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Angular 21.1.0 |
| **Language** | TypeScript 5.9.0 |
| **State** | RxJS 7.8.1 (Observables) |
| **UI Components** | DevExtreme 25.2.3, Angular CDK 21.1.0 |
| **Styling** | Tailwind CSS 3.4.14 |
| **Charts** | ECharts 6.0.0, Chart.js 4.5.1 |
| **Maps** | Leaflet 1.9.4 |
| **Rich Text** | Quill 2.0.3 |
| **Export** | XLSX 0.18.5, jsPDF 3.0.3 |
| **i18n** | ngx-translate 17.0.0 |
| **Real-time** | @microsoft/signalr 10.0.0 |
| **Linting** | ESLint 9.39.4 + @angular-eslint |
| **Testing** | Karma, Jasmine |

---

## Architecture Overview

**Pattern**: Feature-based modular architecture with lazy-loaded features

```
AppComponent (Root)
  ↓
MainLayoutComponent (Protected routes)
  ├── Dashboard (lazy)
  ├── Warehouse (lazy)
  ├── Requests (lazy)
  ├── Admin (lazy)
  └── ... (12+ other features)

AuthLayoutComponent (Authentication routes)
  ├── Login
  ├── Forgot Password
  └── Reset Password
```

**Key Design Principles**:
- Standalone components (no NgModules)
- Lazy-loaded feature routes
- RxJS Observable streams for state
- Functional HTTP interceptors
- Role-based permission guards

---

## Available Scripts

```bash
npm start              # Dev server on localhost:4200
npm run start:local    # Dev with debug mode
npm run start:prod     # Dev with prod config
npm run build          # Build for production
npm run watch          # Build in watch mode
npm test               # Run unit tests
npm run lint           # Run ESLint
```

---

## Environment Configuration

Edit `src/environments/environment.ts`:

```typescript
export const environment: Environment = {
  production: false,
  apiUrl: 'https://your-api:7148/api',
  appName: 'Ettad (Dev)',
  enableLogging: true,
  version: '1.3.0'
};
```

---

## Routing & Guards

- **authGuard**: Protects authenticated routes, restores session silently
- **permissionGuard**: Checks user permissions against route requirements

---

## For Detailed Documentation

See `docs/` folder:
- `docs/architecture.md` - Detailed architecture patterns
- `docs/onboarding.md` - New developer setup guide
- `docs/modules.md` - Module-by-module breakdown
- `docs/deployment.md` - Build and deployment guide

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.3.0 | 2026-05-03 | Current Production |
