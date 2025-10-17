# Home Page URL Configuration Documentation

## Overview
This document provides a comprehensive guide to configuring the home page URL in the Materialize Next.js Admin Template, based on the [official documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/home-page-url).

## What is Home Page URL?

The home page URL is the address to which users are redirected when they visit the root URL of your website. This is the default landing page that users see when they navigate to your application's base URL.

## Configuration Files

### 1. Theme Configuration (`src/configs/themeConfig.ts`)

The primary configuration for the home page URL is located in the theme configuration file.

#### Type Definition
```typescript
export type Config = {
  // ... other configuration options
  homePageUrl: string
  // ... other configuration options
}
```

#### Configuration Example
```typescript
const themeConfig: Config = {
  // ... other configurations
  homePageUrl: '/dashboards/crm', // Change this to the URL you want to redirect to
  // ... other configurations
}
```

### 2. Next.js Configuration (`next.config.mjs`)

Additionally, you need to update the `destination` variable in the Next.js configuration file to match the home page URL.

```javascript
// next.config.mjs
const nextConfig = {
  // ... other configurations
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboards/crm', // Should match homePageUrl
        permanent: false,
      },
    ]
  },
  // ... other configurations
}
```

## Step-by-Step Configuration

### Step 1: Update Theme Configuration
1. Navigate to `src/configs/themeConfig.ts`
2. Locate the `homePageUrl` property in the `themeConfig` object
3. Change the value to your desired home page URL

**Example:**
```typescript
const themeConfig: Config = {
  homePageUrl: '/dashboard', // Your custom home page
  // ... other configurations
}
```

### Step 2: Update Next.js Configuration
1. Navigate to `next.config.mjs` (or `next.config.js`)
2. Find the `redirects` function
3. Update the `destination` value to match your `homePageUrl`

**Example:**
```javascript
async redirects() {
  return [
    {
      source: '/',
      destination: '/dashboard', // Should match homePageUrl
      permanent: false,
    },
  ]
}
```

### Step 3: Restart Development Server
After making changes to configuration files:
```bash
# Stop the current server (Ctrl+C)
# Restart the development server
pnpm dev
```

## Common Home Page URLs

### Dashboard Pages
```typescript
// CRM Dashboard
homePageUrl: '/dashboards/crm'

// Analytics Dashboard
homePageUrl: '/dashboards/analytics'

// E-commerce Dashboard
homePageUrl: '/dashboards/ecommerce'

// Custom Dashboard
homePageUrl: '/dashboard'
```

### Application-Specific Pages
```typescript
// User Profile
homePageUrl: '/profile'

// Settings Page
homePageUrl: '/settings'

// Main Application Page
homePageUrl: '/app'

// Custom ERP Home
homePageUrl: '/erp/dashboard'
```

## Current Project Configuration

### Current Theme Configuration (`src/configs/themeConfig.ts`)
```typescript
const themeConfig: Config = {
  templateName: 'Materialize',
  homePageUrl: '/home',  // Current home page URL
  settingsCookieName: 'materialize-mui-next-demo-1',
  // ... other configurations
}
```

### Current Next.js Configuration (`next.config.ts`)
```typescript
const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/home',  // Matches homePageUrl
        permanent: true,
        locale: false
      }
    ]
  }
}
```

### Current Setup Analysis
- **Home Page URL**: `/home`
- **Redirect**: Root URL (`/`) redirects to `/home`
- **Status**: ✅ Properly configured and synchronized

## Best Practices

### 1. Keep Configurations Synchronized
Always ensure that `homePageUrl` in `themeConfig.ts` matches the `destination` in `next.config.ts`.

### 2. Use Meaningful URLs
Choose descriptive URLs that reflect the purpose of your home page:
```typescript
// Good examples
homePageUrl: '/dashboard'
homePageUrl: '/erp/overview'
homePageUrl: '/app/home'

// Avoid generic or unclear URLs
homePageUrl: '/page1'
homePageUrl: '/main'
```

### 3. Consider User Experience
- Choose a URL that makes sense to users
- Ensure the target page exists and is accessible
- Test the redirect functionality

### 4. Environment-Specific Configuration
Consider different home pages for different environments:
```typescript
// Development
homePageUrl: '/dev-dashboard'

// Production
homePageUrl: '/dashboard'
```

## Troubleshooting

### Issue: Redirect Not Working
**Symptoms**: Users stay on root URL instead of being redirected
**Solutions**:
1. Check that both files are updated correctly
2. Restart the development server
3. Clear browser cache
4. Verify the destination page exists

### Issue: Infinite Redirect Loop
**Symptoms**: Browser shows "too many redirects" error
**Solutions**:
1. Ensure destination URL is different from source URL
2. Check for conflicting redirect rules
3. Verify the destination page doesn't redirect back to root

### Issue: Home Page URL Not Applied
**Symptoms**: Application doesn't use the configured home page URL
**Solutions**:
1. Verify the configuration is saved correctly
2. Check for typos in the URL
3. Ensure the target page/route exists
4. Restart the application

## Testing the Configuration

### Manual Testing
1. Navigate to `http://localhost:3000`
2. Verify you're redirected to the configured home page
3. Check the URL in the browser address bar

### Automated Testing
```javascript
// Example test for redirect functionality
test('should redirect root to home page', async () => {
  const response = await fetch('http://localhost:3000')
  expect(response.url).toBe('http://localhost:3000/home')
})
```

## Common Use Cases

### ERP Dashboard Home
```typescript
homePageUrl: '/erp/dashboard'
```

### User Dashboard Home
```typescript
homePageUrl: '/user/dashboard'
```

### Admin Panel Home
```typescript
homePageUrl: '/admin/overview'
```

### Application Home
```typescript
homePageUrl: '/app'
```

## Related Documentation

- [Next.js Redirects](https://nextjs.org/docs/api-reference/next.config.js/redirects)
- [Theme Configuration](./FOLDER_STRUCTURE.md#configs-folder)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)

---
**Source**: [Materialize Home Page URL Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/home-page-url)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
read_file
