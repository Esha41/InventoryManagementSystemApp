# Deployment Guide

**Document Version**: 1.0

## Build Process

### Development Build

```bash
npm run build
```

Output: dist/ettad-frontend/
- Unoptimized (for debugging)
- Source maps included
- Slower bundle, larger size

### Production Build

```bash
npm run build:prod
```

Output: dist/ettad-frontend/browser/
- Optimized and minified
- Source maps disabled (remove for smaller bundle)
- Faster startup, smaller bundle

**Build Configuration** (angular.json):

```json
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "4mb",
      "maximumError": "8mb"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "80kb",
      "maximumError": "120kb"
    }
  ]
}
```

Build fails if bundle exceeds error limits.

## Build Artifacts

After build, check dist/ettad-frontend/browser/:

```
dist/ettad-frontend/browser/
├── assets/                    # Static files
│   ├── i18n/                 # Translation files
│   ├── config/               # runtime-config.json
│   └── ...
├── main-[hash].js            # Main bundle
├── polyfills-[hash].js       # Polyfills (zone.js)
├── styles-[hash].css         # Global styles
└── index.html                # Entry point
```

## Static Site Hosting

### Nginx

```nginx
server {
  listen 80;
  server_name example.com;
  
  root /var/www/html;
  index index.html;
  
  # SPA routing fallback (important!)
  location / {
    try_files $uri $uri/ /index.html;
  }
  
  # Cache busting for hashed files
  location ~* \.(js|css)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  
  # Don't cache index.html
  location = /index.html {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
}
```

### Apache

```apache
<VirtualHost *:80>
  ServerName example.com
  DocumentRoot /var/www/html
  
  <Directory /var/www/html>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
  </Directory>
  
  <FilesMatch "\.(js|css)$">
    Header set Cache-Control "max-age=31536000, public, immutable"
  </FilesMatch>
  
  <Files "index.html">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </Files>
</VirtualHost>
```

## Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM node:20 as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

# Serve stage
FROM nginx:latest
COPY --from=build /app/dist/ettad-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Build & Run

```bash
docker build -t ettad-frontend .
docker run -p 80:80 ettad-frontend
```

## Cloud Deployment

### Azure Static Web Apps

1. Build locally: npm run build:prod
2. Upload dist/ettad-frontend/browser/ to Azure Portal
3. Or configure CI/CD pipeline
4. Configure fallback route to index.html
5. Deploy runtime-config.json to override API URLs

### AWS S3 + CloudFront

1. Build: npm run build:prod
2. Upload dist/ettad-frontend/browser/ to S3
3. Create CloudFront distribution
4. Set S3 as origin
5. Configure error responses (404 → index.html)
6. Set Cache-Control headers on index.html

### Vercel / Netlify

```bash
# Package.json
{
  "scripts": {
    "build": "ng build"
  }
}
```

Both platforms auto-detect Angular and handle SPA routing.

## Environment-Specific Deployment

### Strategy 1: Build Once, Deploy Everywhere

Build with default config:
```bash
npm run build:prod
```

At deployment, replace runtime-config.json:

- Dev: /assets/config/runtime-config.json (dev API)
- Staging: /assets/config/runtime-config.json (staging API)
- Prod: /assets/config/runtime-config.json (prod API)

**Advantage**: One artifact deployed to all environments
**Disadvantage**: Requires runtime config override

### Strategy 2: Build Per Environment

Build separately for each environment:

```bash
# Dev
ng build --configuration=development

# Staging
ng build --configuration=local

# Prod
ng build --configuration=production
```

Deploy to separate environments.

**Advantage**: Everything fixed at compile time
**Disadvantage**: Different artifacts per environment

## Pre-Deployment Checklist

- [ ] npm run lint passes
- [ ] npm test passes
- [ ] npm run build:prod succeeds
- [ ] Bundle size under 8MB (initial), 120KB per component
- [ ] environment.prod.ts has correct API URLs
- [ ] No hardcoded environment-specific values in code
- [ ] runtime-config.json ready for deployment
- [ ] CORS configured on backend
- [ ] SSL certificate installed (https required)

## Health Checks

After deployment:

```bash
# Check homepage loads
curl https://example.com

# Verify API connectivity
curl https://example.com/assets/config/runtime-config.json

# Check no console errors
# Open https://example.com, press F12, check Console tab
```

## Performance Optimization

### Bundle Analysis

```bash
npm run build:prod -- --stats-json
```

Analyze with Webpack Bundle Analyzer:

```bash
npm install -g webpack-bundle-analyzer
webpack-bundle-analyzer dist/ettad-frontend/browser/stats.json
```

### Cache Strategy

- Hashed bundle files (main-[hash].js): Cache 1 year
- index.html: No cache (no-cache, must-revalidate)
- Translation files: Cache 1 month
- API responses: Cache per endpoint

### Compression

Enable gzip in Nginx:

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;
```

## Rollback

If deployment goes wrong:

1. Revert nginx/server to previous config
2. Restore previous build artifacts
3. Check logs for errors
4. Redeploy with fixes

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build:prod
      - uses: actions/upload-artifact@v2
        with:
          name: build
          path: dist/ettad-frontend/browser/
```

## Monitoring

After deployment:

- Monitor error logs
- Check API connectivity
- Verify auth/token refresh working
- Monitor performance (bundle load time, API latency)
- Watch browser console for JavaScript errors
