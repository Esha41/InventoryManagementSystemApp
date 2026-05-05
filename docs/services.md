# Core Services Documentation

**Document Version**: 1.0

## 22 Core Services

All located in src/app/core/services/

### Authentication Services

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| auth-session.service.ts | Session state, BehaviorSubjects | getAuthState(), setAuthenticatedUser() |
| auth-flow.service.ts | Login/logout workflow | login(), logout(), selectRole() |
| backend-auth.service.ts | Backend API auth calls | isAuthenticated(), restoreSessionSilently() |
| token-refresh.service.ts | JWT refresh token handling | refreshToken(), getAccessToken() |
| auth-cross-tab-sync.service.ts | Sync auth across tabs | Subscribes to storage events |
| session-heartbeat.service.ts | Periodic keep-alive | Pings backend periodically |

### Core Application Services

| Service | Purpose |
|---------|---------|
| api.service.ts | Generic HTTP client wrapper for API calls |
| config.service.ts | Load app config at startup (environment + runtime-config.json) |
| storage.service.ts | Abstraction over localStorage/sessionStorage |
| idle.service.ts | Idle timer and auto-logout on inactivity |
| role.service.ts | User role and permission queries |
| user-context.service.ts | Current user context (department, roles) |

### Utility Services

| Service | Purpose |
|---------|---------|
| file-upload.service.ts | File upload handling |
| excel.service.ts | Excel export/import utilities |
| monitoring.service.ts | App monitoring and error tracking |
| logging.service.ts | Structured logging with redaction |
| translation.service.ts | Translation/i18n helpers |
| theme.service.ts | Light/dark mode switching |
| toast.service.ts | Toast notification service |
| lookup.service.ts | Lookup table data caching |

## Injection Pattern

All services marked @Injectable({ providedIn: 'root' })

Inject in components:

constructor(private authService: AuthSessionService) {}

Or use functional style:

const authService = inject(AuthSessionService);
