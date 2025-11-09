# ETTAD Frontend Application

**Integrated Inventory Management System - Frontend**

A modern, enterprise-grade Angular application for managing inventory, supply requests, warehouses, and administrative operations.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Sprint 1 Deliverables](#sprint-1-deliverables)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Architecture](#architecture)
- [Features](#features)

---

## Overview

ETTAD Frontend is a comprehensive inventory management system built with Angular 18, featuring a modern UI, robust authentication, role-based access control, and full internationalization support (English/Arabic with RTL).

**Sprint 1 Duration:** 1 Week  
**Status:**  Core Features Complete

---

## 🛠 Tech Stack

### Core Framework
- **Angular 18** - Latest version with standalone components
- **TypeScript 5.4** - Type-safe development
- **RxJS 7.8** - Reactive programming

### UI & Styling
- **TailwindCSS 3.4** - Utility-first CSS framework
- **Lucide Angular** - Modern icon library
- **Custom Design System** - CSS variables for theming

### Additional Libraries
- **@ngx-translate** - Internationalization (i18n)
- **Chart.js** - Data visualization

### Development Tools
- **Angular CLI 18** - Build tooling
- **ESLint** - Code linting
- **PostCSS** - CSS processing

---

## 🚀 Sprint 1 Deliverables

###  Authentication & Authorization
- JWT-based authentication system
- Role-based access control (RBAC)
- Permission guards for route protection
- HTTP interceptors for token management
- Secure token storage

###  Core Layout & Navigation
- Responsive main layout with sidebar
- Collapsible sidebar with tooltips
- Navigation menu with permission-based visibility
- Header with user profile, notifications, and language switcher
- Footer component

###  User Management
- User CRUD operations
- Role assignment interface
- User list with filtering and search
- User form modal (create/edit)
- LDAP user support

###  Admin Management
- Admin user management interface
- Role management system
- Permission management
- Lookup tables management (18 tables)
  - Departments, Suppliers, Manufacturers, Countries
  - Case Types, HCC, Colors, Compatibilities
  - Depot, Hazard Divisions, Nature Options
  - NSN, Primary Purposes, Projectile Materials
  - Propellants, Units, Ranks, Workflow Types

###  Inventory Management
- Warehouse inventory listing
- Inventory item details
- Add/Edit inventory items
- Inventory search functionality
- Warehouse map view
- Inventory detail editing modal

###  Supply Request Management
- Supply request listing with pagination
- Request detail view
- Status management
- RTL-aware pagination controls

###  Workflow Management
- Workflow creation and editing
- Workflow type selection
- Step management
- Workflow listing and details

###  Asset Management
- Asset listing
- Add new assets
- Asset filtering and search
- Asset details view

###  Allowance Management
- Allowance creation
- Department-based allowances
- Ammunition item selection
- Allowance listing

###  Request Management
- New issue request workflow
- Return request functionality
- Discard request functionality
- Request status tracking
- Order details modal

###  Dashboard
- Status cards with statistics
- Quick access to key features
- Permission-based content display

###  Notifications
- Notification center
- Notification detail view
- Real-time notification display

###  Internationalization
- Full English/Arabic translation support
- RTL (Right-to-Left) layout support
- Language switcher
- Dynamic content direction

###  UI Components Library
- Reusable Button component (5 variants)
- Card component
- Modal component
- Confirm Dialog component
- Stepper component
- Toast notification system
- Searchable dropdown component
- Form modals (User, Role, Lookup)

###  Design System
- Custom CSS variables for theming
- Consistent color palette
- Typography system
- Spacing and sizing utilities
- Shadow system
- Border radius tokens
- Transition animations

---

## 📁 Project Structure

```
src/app/
├── core/                    # Core functionality
│   ├── constants/          # Application constants
│   ├── directives/         # Custom directives
│   ├── guards/            # Route guards
│   ├── interceptors/      # HTTP interceptors
│   ├── models/            # TypeScript models/interfaces
│   ├── services/          # Core services
│   └── utils/             # Utility functions
│
├── pages/                  # Feature pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard
│   ├── manage-admins/    # Admin management
│   ├── warehouse/         # Warehouse management
│   ├── inventory/         # Inventory management
│   ├── requests/         # Request management
│   └── ...               # Other feature pages
│
└── shared/                # Shared components
    ├── components/        # Reusable UI components
    └── layouts/           # Layout components
```

---

##  Architecture

### Design Patterns
- **Standalone Components** - Modern Angular architecture
- **Service-Based State Management** - RxJS BehaviorSubjects
- **Dependency Injection** - Angular DI system
- **Lazy Loading** - Route-based code splitting
- **Interceptor Pattern** - HTTP request/response handling
- **Guard Pattern** - Route protection

### Key Services
- `ApiService` - Centralized HTTP client
- `BackendAuthService` - Authentication management
- `BackendUserService` - User operations
- `LookupService` - Generic lookup table operations
- `ToastService` - Notification system
- `TranslationService` - i18n management
- `ConfigService` - Application configuration

### Security
- JWT token-based authentication
- Permission-based route guards
- HTTP interceptors for automatic token injection
- Secure token storage (localStorage)
- Automatic logout on 401 errors

---

##  Getting Started

### Prerequisites
- Node.js 20+ 
- npm 9+ or yarn
- Angular CLI 18

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd EttadFrontEnd
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Copy `src/environments/environment.ts` if needed
   - Update API URL in environment file

4. **Start development server**
   ```bash
   npm start
   # or for local configuration
   npm run start:local
   ```

5. **Access the application**
   - Open browser to `http://localhost:4200`

### Build for Production

```bash
npm run build:prod
```

### Build for Local

```bash
npm run build:local
```

---

## 💻 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server (development config) |
| `npm run start:local` | Start dev server (local config) |
| `npm run start:prod` | Start dev server (production config) |
| `npm run build` | Build for production |
| `npm run build:local` | Build for local environment |
| `npm run build:prod` | Build for production environment |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |

### Code Style
- Follow Angular style guide
- Use TypeScript strict mode
- Standalone components only
- Follow existing naming conventions
- Use TailwindCSS utility classes
- Maintain RTL support for all components

### Environment Configuration

**Development** (`environment.ts`)
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://localhost:7060/api',
  appName: 'ETTAD',
  version: '1.0.0',
  enableLogging: true
};
```

**Local** (`environment.local.ts`)
```typescript
export const environment = {
  production: false,
  apiUrl: 'https://localhost:7148/api',
  // ... other config
};
```

---

##  Features

### Authentication
-  Login with email/password
-  JWT token management
-  Automatic token refresh
-  Session management
-  Logout functionality

### User Management
-  User CRUD operations
-  Role assignment
-  Permission management
-  User search and filtering

### Inventory Management
-  Warehouse listing
-  Inventory item management
-  Search and filter inventory
-  Inventory detail views
-  Add/Edit inventory items

### Request Management
-  Create new issue requests
-  Return requests
-  Discard requests
-  Request status tracking
- Request details view

### Admin Features
-  Lookup table management (18 tables)
-  Admin user management
-  Role and permission configuration
-  System configuration

### UI/UX
-  Responsive design
-  RTL support
-  Loading states
-  Error handling
-  Toast notifications
-  Modal dialogs
-  Form validation

---

##  Notes

- **Sprint 1** completed in 1 week
- All core features are functional
- Some features may have minor TODOs for future sprints
- Testing coverage to be expanded in future sprints
- Documentation will be enhanced as features mature

---

##  Team

Developed by the Flora development team.

---

##  License

[Add license information]

---

**Last Updated:** Sprint 1 Delivery  
**Version:** 1.0.0

