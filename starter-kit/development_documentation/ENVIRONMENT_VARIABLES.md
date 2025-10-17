# Environment Variables Documentation

## Overview
This document provides a comprehensive guide to environment variables in the Materialize Next.js Admin Template, based on the [official documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/environment-variables).

## What Are Environment Variables?

Environment variables are key-value pairs used to configure your application outside of your code. They are essential for:

- **Security**: Keeping sensitive data like passwords and API keys out of source code
- **Flexibility**: Different settings for development, testing, and production environments
- **Convenience**: Easy configuration changes without code modifications

## Setup Instructions

### 1. Create Environment File
```bash
# Copy the example file
cp .env.example .env
```

### 2. Configure Required Values
Fill in the required values in the `.env` file.

### 3. Generate NextAuth Secret
Generate a secure `NEXTAUTH_SECRET` using [NextAuth.js secret generator](https://generate-secret.vercel.app/32).

### 4. Optional: Google Authentication
If using Google OAuth, add your Google credentials:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 5. Repository Inclusion (Optional)
To include `.env` in your repository, remove the `.env` statement from `.gitignore`.

## Environment Variables Reference

### Core Application Variables

```bash
# Base path for the application (usually empty for root)
BASEPATH=

# API URL for backend calls
API_URL=http://localhost:3000${BASEPATH}/api

# Public application URL (accessible in browser)
NEXT_PUBLIC_APP_URL=http://localhost:3000${BASEPATH}
```

### Authentication Variables

```bash
# NextAuth Configuration
NEXTAUTH_BASEPATH=${BASEPATH}/api/auth
NEXTAUTH_URL=http://localhost:3000${BASEPATH}/api/auth
NEXTAUTH_SECRET=your-secret-key-here

# Google OAuth 2.0 Credentials (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Authentication Variable Descriptions:**
- `NEXTAUTH_URL` - Application URL for NextAuth.js callback URLs and redirects
- `NEXTAUTH_SECRET` - Used to encrypt cookies and tokens
- `GOOGLE_CLIENT_ID` - Google OAuth 2.0 client ID for authentication
- `GOOGLE_CLIENT_SECRET` - Google OAuth 2.0 client secret for authentication

### Database Variables

```bash
# Database Configuration
DATABASE_URL=file:./dev.db
```

**Database Variable Descriptions:**
- `DATABASE_URL` - Database connection string or file path

### Private Variables

```bash
# Node Environment
NODE_ENV=development
```

**Usage Example:**
```javascript
if (process.env.NODE_ENV === 'production') {
  analytics.disable()
}
```

## Current Project Configuration

### Current .env File
Based on the current project setup:

```bash
# Materialize Next.js Admin Template Environment Variables

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# NextAuth Configuration (if using authentication)
# NEXTAUTH_SECRET=your-secret-key-here
# NEXTAUTH_URL=http://localhost:3000

# Google OAuth (if using Google authentication)
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database Configuration (if using database)
# DATABASE_URL=your-database-connection-string

# Other environment variables can be added here as needed
```

## Environment Variable Types

### Public Variables (NEXT_PUBLIC_*)
- Accessible in the browser
- Used for client-side code
- Example: `NEXT_PUBLIC_APP_URL`

### Private Variables
- Only accessible on the server
- Used for sensitive data
- Example: `NEXTAUTH_SECRET`, `DATABASE_URL`

## Best Practices

### Security
1. **Never commit sensitive data** to version control
2. **Use strong secrets** for authentication
3. **Keep API keys private** (don't use NEXT_PUBLIC_ prefix)
4. **Use different values** for different environments

### Organization
1. **Group related variables** together
2. **Use descriptive names** for clarity
3. **Document variable purposes** in comments
4. **Keep .env.example updated** with all required variables

### Development
1. **Use .env.local** for local overrides
2. **Test with different environments** (dev, staging, prod)
3. **Validate required variables** on application startup
4. **Use environment-specific configurations**

## Common Issues and Solutions

### Issue: Environment Variables Not Loading
**Solution**: 
1. Ensure `.env` file is in the project root
2. Restart the development server
3. Check variable naming (case-sensitive)

### Issue: NEXT_PUBLIC_ Variables Not Accessible
**Solution**:
1. Ensure variable starts with `NEXT_PUBLIC_`
2. Restart the development server
3. Check browser console for errors

### Issue: Authentication Not Working
**Solution**:
1. Verify `NEXTAUTH_SECRET` is set
2. Check `NEXTAUTH_URL` matches your domain
3. Ensure Google credentials are correct (if using Google OAuth)

## Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=file:./dev.db
```

### Production
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
DATABASE_URL=your-production-database-url
```

## Validation Script Example

```javascript
// utils/validateEnv.js
const requiredEnvVars = [
  'NEXTAUTH_SECRET',
  'NEXT_PUBLIC_APP_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}
```

## Quick Reference Commands

### Check Environment Variables
```bash
# List all environment variables
env

# Check specific variable
echo $NEXT_PUBLIC_APP_URL
```

### Generate Secrets
```bash
# Generate random secret (32 characters)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Related Documentation

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [NextAuth.js Configuration](https://next-auth.js.org/configuration/options)
- [Prisma Environment Variables](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#env)

---
**Source**: [Materialize Environment Variables Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/environment-variables)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
