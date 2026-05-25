# Documentation Index

**Complete Documentation for Ettad Frontend v1.3.0**

---

## For New Developers - Start Here

1. [../README.md](../README.md) - Quick overview and setup (10 min)
2. [onboarding.md](onboarding.md) - Developer onboarding guide (30 min)
3. [architecture.md](architecture.md) - Project structure and design patterns (30 min)

## For Understanding the System

- [architecture.md](architecture.md) - Architecture, layers, data flow, patterns
- [modules.md](modules.md) - All 16 feature modules and their purposes
- [routing.md](routing.md) - Route structure, guards, lazy loading
- [services.md](services.md) - 22 core services and their roles
- [environment.md](environment.md) - Configuration and environments

## For Development

- [onboarding.md](onboarding.md) - Setup, workflow, conventions, common pitfalls
- [topaz-signature-setup.md](topaz-signature-setup.md) - Topaz SigWeb install and signature capture at supply desk
- [routing.md](routing.md) - Adding routes, using guards, navigation
- [modules.md](modules.md) - Creating modules, module structure
- [environment.md](environment.md) - Configuring different environments

## For Deployment

- [deployment.md](deployment.md) - Build process, platform deployments
- [environment.md](environment.md) - Production configuration

---

## Document Overview

| Document | Purpose | Audience | Time |
|----------|---------|----------|------|
| [../README.md](../README.md) | Quick start, tech stack, setup | Everyone | 10 min |
| [onboarding.md](onboarding.md) | New developer setup | Developers | 30 min |
| [architecture.md](architecture.md) | Design, layers, patterns | Architects | 30 min |
| [routing.md](routing.md) | Routes, guards, navigation | Developers | 15 min |
| [services.md](services.md) | Core services list | Developers | 10 min |
| [modules.md](modules.md) | Feature modules | Feature developers | 20 min |
| [environment.md](environment.md) | Configuration, environments | DevOps/Developers | 15 min |
| [deployment.md](deployment.md) | Build and deployment | DevOps | 20 min |

---

## Key Info

**Tech Stack**: Angular 21.1.0 + TypeScript 5.9.0 + RxJS 7.8.1 + DevExtreme 25.2.3

**Architecture**: Feature-based modular with lazy loading and standalone components

**State Management**: RxJS Observables (no Redux/NgRx)

**16 Feature Modules**: Admin, Auth, Assets, Dashboard, Department, Forecast, Help, Inventory, Notifications, Onboarding, Profile, Reports, Requests, Settings, Warehouse, Workflow

**22 Core Services**: Authentication, API, Config, Storage, Idle, Role, File Upload, Excel, Monitoring, Theme, Toast, and more

**Route Guards**: authGuard (session), permissionGuard (RBAC)

---

## Commands

```bash
npm start               # Dev server on localhost:4200
npm run build:prod     # Production build
npm run lint           # ESLint check
npm test               # Unit tests
```

---

## Path Aliases (Use These!)

@core, @services, @models, @guards, @constants, @features, @shared, @shell

Feature-specific: @auth, @warehouse, @requests, @admin, etc.

---

## Next Steps

- Read README.md
- Follow onboarding.md
- Review architecture.md
- Explore the codebase
- Create your first feature

Welcome to the team!
