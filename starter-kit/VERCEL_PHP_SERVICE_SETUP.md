# Vercel Environment Variable Setup for PHP Service

## Required Environment Variable

You need to add the Railway PHP service URL to Vercel environment variables.

### 1. Get Railway PHP Service URL

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Find your PHP service** (the one you just deployed)
3. **Click on the service**
4. **Go to "Settings" tab**
5. **Copy the "Domain" URL** (it should look like `https://php-service-production.up.railway.app`)

### 2. Add Environment Variable in Vercel

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project** (turinova)
3. **Go to "Settings" tab**
4. **Click on "Environment Variables"**
5. **Add new variable**:
   - **Name**: `NEXT_PUBLIC_PHP_SERVICE_URL`
   - **Value**: `https://your-railway-php-service-url.up.railway.app/test_optimization.php`
   - **Environment**: Production (and Preview if you want)
6. **Click "Save"**

### 3. Redeploy

After adding the environment variable:
1. **Vercel will automatically redeploy** your application
2. **Wait for deployment to complete** (2-3 minutes)
3. **Test the optimization** on https://turinova.hu/opti

### 4. Example Configuration

```bash
# Environment Variable Name
NEXT_PUBLIC_PHP_SERVICE_URL

# Environment Variable Value (replace with your actual Railway URL)
https://php-service-production.up.railway.app/test_optimization.php
```

### 5. Verification

After deployment, the optimization should work:
1. **Login** to https://turinova.hu/opti
2. **Add some panels** to the optimization
3. **Click "Optimize"**
4. **Should now work** without "Failed to fetch" errors

## Troubleshooting

### If optimization still fails:
1. **Check Railway PHP service** is running
2. **Verify the URL** is correct in Vercel environment variables
3. **Check browser console** for any CORS errors
4. **Ensure Railway PHP service** has the correct endpoint (`/test_optimization.php`)

### Common Issues:
- **Wrong URL format**: Make sure to include `/test_optimization.php` at the end
- **CORS errors**: Railway should handle CORS automatically
- **Service not running**: Check Railway dashboard for service status

---

**Next Steps**: After adding this environment variable, your optimization should work perfectly on the live server! 🚀
