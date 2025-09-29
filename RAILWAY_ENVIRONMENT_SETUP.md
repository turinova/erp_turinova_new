# Railway Environment Variables Setup Guide

## Required Environment Variables for Railway Deployment

Railway needs these Supabase environment variables to be configured:

### 1. Supabase Project Configuration
- **Project Reference**: `xgkaviefifbllbmfbyfe`
- **Project URL**: `https://xgkaviefifbllbmfbyfe.supabase.co`

### 2. Required Environment Variables

You need to add these environment variables in Railway:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xgkaviefifbllbmfbyfe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. How to Get the Keys

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard/project/xgkaviefifbllbmfbyfe
2. **Navigate to Settings > API**
3. **Copy the following values**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. How to Add Environment Variables in Railway

1. **Go to your Railway project dashboard**
2. **Click on your service** (the Next.js app)
3. **Go to the "Variables" tab**
4. **Add each environment variable**:
   - Click "New Variable"
   - Enter the variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - Enter the variable value (e.g., `https://xgkaviefifbllbmfbyfe.supabase.co`)
   - Click "Add"

### 5. Environment Variables to Add

Add these 3 variables in Railway:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xgkaviefifbllbmfbyfe.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase service role key |

### 6. After Adding Variables

1. **Railway will automatically redeploy** your application
2. **The build should now succeed** without Supabase errors
3. **Your application will be able to connect** to Supabase

### 7. Verification

After deployment, you can verify the setup by:
1. **Checking Railway logs** - should show "Supabase configured" messages
2. **Testing API endpoints** - should work without "Supabase not configured" errors
3. **Accessing your application** - should load properly

## Important Notes

- **Never commit these keys** to your repository
- **The keys are safe to use** in Railway environment variables
- **Railway encrypts environment variables** for security
- **Changes take effect** after the next deployment

## Troubleshooting

If you still get "Supabase not configured" errors:
1. **Double-check the variable names** (case-sensitive)
2. **Verify the values** are copied correctly
3. **Wait for Railway to redeploy** after adding variables
4. **Check Railway logs** for any error messages

---

**Next Steps**: After adding these environment variables, Railway should deploy successfully and your application will work properly with Supabase.
