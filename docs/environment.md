# Environment Configuration

**Document Version**: 1.0

## Configuration Files

All environment configs are TypeScript files (not .env):

src/environments/
- environment.interface.ts - Config shape/types
- environment.ts - Development
- environment.local.ts - Local with debug mode
- environment.prod.ts - Production

## Environment Interface

```typescript
export interface Environment {
  production: boolean;
  apiUrl: string;
  appName: string;
  enableLogging: boolean;
  version: string;
  notificationHubUrl?: string;
  fileBaseUrl?: string;
  debugMode?: boolean;
  mockData?: boolean;
  idleWarningAfterMinutes?: number;
  idleLogoutCountdownSeconds?: number;
  persistAuthAcrossSessions?: boolean;
  enableOnboardingTour?: boolean;
}
```

## Development (environment.ts)

```typescript
apiUrl: 'https://localhost:7148/api'
appName: 'Ettad (Dev)'
enableLogging: true
version: '1.4.0'
idleWarningAfterMinutes: 15
enableOnboardingTour: false
```

Used by: npm start

## Local (environment.local.ts)

```typescript
apiUrl: 'https://localhost:7148/api'
appName: 'Ettad (Local)'
enableLogging: true
debugMode: true
mockData: false
version: '1.4.0'
```

Used by: npm run start:local

Additional debug logging enabled.

## Production (environment.prod.ts)

```typescript
production: true
apiUrl: 'https://api.example.com/api'
appName: 'Ettad'
enableLogging: false
persistAuthAcrossSessions: true
enableOnboardingTour: true
```

Used by: npm run build:prod, npm run start:prod

- Console logging disabled at compile time
- API URL must be updated
- Session persistence enabled
- Onboarding tours enabled

## Runtime Configuration (runtime-config.json)

Override environment at runtime without rebuild:

src/assets/config/runtime-config.json:

```json
{
  "apiUrl": "https://staging-api.example.com/api",
  "notificationHubUrl": "https://staging-api.example.com/hubs/notification"
}
```

Loaded at app startup via ConfigService.

Allows changing API endpoints for different deployments.

## Selecting Configuration

npm start - Development
npm run start:local - Local with debug
npm run start:prod - Production config
npm run build - Build default
npm run build:prod - Build production
npm run build:local - Build local

## Key Properties

| Property | Purpose |
|----------|---------|
| production | Enable Angular optimizations |
| apiUrl | Backend API base URL |
| appName | Application title |
| enableLogging | Console logs (disabled in prod) |
| notificationHubUrl | SignalR hub for notifications |
| debugMode | Additional debug output |
| mockData | Use mock data instead of API |
| idleWarningAfterMinutes | Idle warning delay |
| idleLogoutCountdownSeconds | Auto-logout countdown |
| persistAuthAcrossSessions | Keep session across browser close |
| enableOnboardingTour | Show onboarding tour |

## Accessing Config in Code

### Compile-Time (environment object)

```typescript
import { environment } from '@environments/environment';

apiUrl = environment.apiUrl;
```

### Runtime (ConfigService)

```typescript
constructor(private configService: ConfigService) {
  const apiUrl = this.configService.get('apiUrl');
}
```

## Production Deployment

1. Update environment.prod.ts with production URLs
2. Build: npm run build:prod
3. Deploy dist/ettad-frontend/browser/ to static host
4. Or use runtime-config.json to override without rebuild

## Troubleshooting

- Wrong API endpoint: Check environment.ts and runtime-config.json
- Console logs in production: Verify enableLogging: false in prod
- Session lost on refresh: Set persistAuthAcrossSessions: true
