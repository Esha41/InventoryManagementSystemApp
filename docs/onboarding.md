# Developer Onboarding Guide

**Document Version**: 1.0

## Getting Started (30 minutes)

### 1. Clone & Install (5 min)

```bash
git clone <repo-url>
cd ettadfrontend
npm install
```

**Troubleshooting**:
- If install fails: Delete node_modules, package-lock.json, run npm install again
- Node version mismatch: Use Node 18.x or 20.x

### 2. Configure Backend API (5 min)

Edit `src/environments/environment.ts`:
```typescript
apiUrl: 'https://your-backend-api:7148/api',
notificationHubUrl: 'https://your-backend-api:7148/hubs/notification',
```

Verify backend is running and accessible.

### 3. Start Dev Server (5 min)

```bash
npm start
```

Navigate to http://localhost:4200

**You should see**: Login page
**Expected**: Backend must be accessible and returning responses

### 4. Verify Setup (5 min)

- [ ] Login page loads without errors
- [ ] No 404 or CORS errors in browser console
- [ ] Backend API responds to requests
- [ ] HMR (hot module reloading) works: Edit a template, page auto-refreshes

---

## Project Structure (15 min read)

### Directory Layout

```
src/
├── app/
│   ├── core/              # Auth, services, models, guards, interceptors
│   ├── features/          # 16 lazy-loaded domain modules
│   ├── shared/            # Reusable UI components
│   └── shell/             # App layout
├── environments/          # Dev, local, prod configs
├── assets/                # i18n files, static assets
└── main.ts                # Bootstrap
```

### Key Concepts

- **Standalone Components**: No NgModules. @Component({ standalone: true, imports: [...] })
- **Lazy Loading**: Features loaded on-demand, not at startup
- **Observable State**: RxJS for state, no Redux
- **Path Aliases**: @services/*, @models/*, @features/* for clean imports

---

## Common Development Tasks

### Adding a New Page

1. Create component in feature: `features/warehouse/pages/my-page/`
2. Create route in `features/warehouse/warehouse.routes.ts`:
```typescript
{
  path: 'my-path',
  loadComponent: () => import('./pages/my-page/my-page.component')
    .then(m => m.MyPageComponent),
  canActivate: [permissionGuard],
  data: { permissions: ['warehouse.view'] }
}
```
3. Add navigation link in navbar or sidebar

### Adding a Service

1. Create in `features/[feature]/services/my.service.ts`
2. Mark @Injectable({ providedIn: 'root' })
3. Inject in components: `constructor(private myService: MyService)`

### Modifying a Form

1. Use Reactive Forms (FormBuilder, FormGroup)
2. Define validation rules
3. Bind to FormGroup: `[formGroup]="form"`
4. Display errors: `{{ form.get('field')?.errors }}`

### Calling the Backend API

1. Inject ApiService: `constructor(private api: ApiService)`
2. Call: `this.api.get<MyType>('/endpoint').subscribe(...)`
3. Token auto-attached by authInterceptor

---

## Code Conventions

### Naming

| Type | Pattern | Example |
|------|---------|---------|
| Component | feature.component.ts | user-form.component.ts |
| Service | feature.service.ts | warehouse.service.ts |
| Model | entity.model.ts | asset.model.ts |
| Route file | feature.routes.ts | warehouse.routes.ts |

### Imports

```typescript
// ✅ Use path aliases
import { AuthService } from '@services/auth.service';
import { Asset } from '@models/asset.model';

// ❌ Avoid relative paths
import { AuthService } from '../../../core/services/auth.service';
```

### Components

```typescript
@Component({
  selector: 'app-my-component',
  standalone: true,  // Always standalone
  imports: [CommonModule, ReactiveFormsModule],
  template: `...`,
  styles: [`...`]
})
export class MyComponentComponent {
  // Use dependency injection
  constructor(private service: MyService) {}
}
```

### Services

```typescript
@Injectable({ providedIn: 'root' })  // Singleton
export class MyService {
  constructor(private http: HttpClient) {}
  
  getData() {
    return this.http.get<MyType>('/api/endpoint');
  }
}
```

---

## Common Pitfalls

### 1. Relative Imports
**Problem**: Typing ../../../core/services/... is error-prone
**Solution**: Use path aliases: `import { X } from '@services/x.service'`

### 2. Forgetting standalone: true
**Problem**: @Component without standalone: true fails with errors
**Solution**: All new components must have `standalone: true`

### 3. Manual Subscriptions
**Problem**: Forgetting to unsubscribe causes memory leaks
**Solution**: Use `async` pipe in templates: `{{ observable$ | async }}`

### 4. Modifying State Directly
**Problem**: BehaviorSubject state is mutable
**Solution**: Use immutable patterns; create new objects rather than mutating

### 5. Feature Importing Feature
**Problem**: Violates architecture; causes circular dependencies
**Solution**: Cross-feature communication via Core services only

### 6. Hardcoded API URLs
**Problem**: API endpoint varies per environment
**Solution**: Use `environment.apiUrl` from environment files

### 7. Forgetting Permission Guards
**Problem**: Routes accessible without permission checks
**Solution**: Add `canActivate: [permissionGuard]` and `data: { permissions: [...] }`

---

## Development Workflow

### 1. Start Feature Branch

```bash
git checkout develop
git pull
git checkout -b feature/my-feature-name
```

### 2. Implement Changes

Edit files, save, HMR reloads automatically.

### 3. Test Changes

```bash
npm test  # Run unit tests
npm run lint  # Check code style
```

### 4. Commit & Push

```bash
git add .
git commit -m "feat(feature-name): description"
git push origin feature/my-feature-name
```

### 5. Create PR

Push to GitHub, open PR to `develop` branch.

### 6. Code Review

Address feedback, update commits, push.

### 7. Merge

Once approved, squash & merge to `develop`.

---

## Essential Commands

```bash
npm start              # Dev server (localhost:4200)
npm run lint           # ESLint check
npm test               # Run tests
npm run build          # Production build
npm run watch          # Build in watch mode
```

---

## IDE Setup (VS Code Recommended)

### Extensions

- Angular Language Service
- Prettier (Code Formatter)
- ESLint
- TypeScript Vue Plugin (if using Vue patterns)

### Settings (.vscode/settings.json)

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "angular.enable-strict-mode-prompt": false
}
```

---

## Debugging

### Browser DevTools

1. Press F12
2. Go to Sources tab
3. Set breakpoints in source code
4. Execute code, breakpoint triggers
5. Inspect variables, step through code

### Console Logging

```typescript
console.log('Value:', myValue);  // Dev only (disabled in prod)
```

### Network Tab

1. F12 → Network tab
2. Observe HTTP requests/responses
3. Check headers, body, status

---

## Getting Help

1. **Code Comments**: Refer to inline documentation in key files
2. **Architecture Doc**: See `docs/architecture.md`
3. **Module Docs**: See `docs/modules/` for specific module guides
4. **Topaz signature pad**: See `docs/topaz-signature-setup.md` for SigWeb install at supply desk
5. **Git History**: `git log --oneline` shows recent changes
6. **Teammate**: Ask on Slack/Teams

---

## First Tasks (Day 1-2)

1. ✅ Set up environment (this guide)
2. ✅ Read architecture.md
3. ✅ Explore one small feature (e.g., notifications)
4. ✅ Make a small code change (fix typo, update UI label)
5. ✅ Create a test branch, commit, push
6. ✅ Open a PR (even if trivial, to practice workflow)
7. ✅ Ask senior dev to review

---

## Milestones

| Week | Goal |
|------|------|
| Week 1 | Environment setup, codebase familiarity, first PR merged |
| Week 2-3 | Implement small feature or bug fix |
| Week 4 | Own a sub-feature, create/review PRs independently |

Welcome to the team!
