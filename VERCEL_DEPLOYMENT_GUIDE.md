# Vercel CLI Deployment Guide

## 🚀 **Quick Deployment Commands**

### **Step 1: Navigate to Project Directory**
```bash
cd /Volumes/T7/erp_turinova_new/starter-kit
```

### **Step 2: Link to Correct Project (if needed)**
```bash
vercel link --project erp-turinova-admin --yes
```

### **Step 3: Deploy to Production**
```bash
vercel --prod --yes
```

## 📋 **Complete Deployment Process**

### **For Optimization Updates Only:**
```bash
# 1. Copy working files from backup
cp /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit/src/app/api/optimize/route.ts /Volumes/T7/erp_turinova_new/starter-kit/src/app/api/optimize/route.ts

# 2. Copy updated OptiClient
cp /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit/src/app/\(dashboard\)/opti/OptiClient.tsx /Volumes/T7/erp_turinova_new/starter-kit/src/app/\(dashboard\)/opti/OptiClient.tsx

# 3. Copy optimization library files
cp -r /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit/src/lib/optimization/* /Volumes/T7/erp_turinova_new/starter-kit/src/lib/optimization/

# 4. Copy types
cp /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit/src/types/optimization.ts /Volumes/T7/erp_turinova_new/starter-kit/src/types/optimization.ts

# 5. Deploy
cd /Volumes/T7/erp_turinova_new/starter-kit
vercel --prod --yes
```

## 🎯 **Project Information**

### **Correct Project:**
- **Project Name:** `erp-turinova-admin`
- **Live URL:** `https://erp-turinova-admin-davids-projects-9c80df74.vercel.app`

### **Wrong Project (DO NOT USE):**
- **Project Name:** `starter-kit`
- **URL:** `https://starter-kit-davids-projects-9c80df74.vercel.app`

## 🔧 **Troubleshooting**

### **If deployment fails:**
```bash
# Check current project link
cat .vercel/project.json

# Re-link to correct project
vercel link --project erp-turinova-admin --yes

# Try deployment again
vercel --prod --yes
```

### **If files are corrupted:**
```bash
# Use backup directory as source
cd /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit
vercel --prod --yes
```

## 📁 **Key Files for Optimization**

### **Files that need to be deployed for optimization:**
1. `src/app/api/optimize/route.ts` - Node.js API endpoint
2. `src/types/optimization.ts` - TypeScript interfaces
3. `src/lib/optimization/classes.ts` - Rectangle & Bin classes
4. `src/lib/optimization/algorithms.ts` - Core algorithms
5. `src/lib/optimization/cutCalculations.ts` - Cut length calculations
6. `src/app/(dashboard)/opti/OptiClient.tsx` - Updated client (uses `/api/optimize`)

### **Critical OptiClient Setting:**
```javascript
// MUST use this URL for Node.js API:
const response = await fetch('/api/optimize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(request)
})

// NEVER use PHP service URL:
// fetch('http://localhost:8000/test_optimization.php', {
```

## 🌐 **Environment Setup**

### **Local Development:**
- **URL:** `http://localhost:3000`
- **Backup Directory:** `/Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit`
- **Main Directory:** `/Volumes/T7/erp_turinova_new/starter-kit`

### **Production:**
- **URL:** `https://erp-turinova-admin-davids-projects-9c80df74.vercel.app`
- **Project:** `erp-turinova-admin`

## ✅ **Verification Steps**

### **After deployment, verify:**
1. **Go to live URL:** `https://erp-turinova-admin-davids-projects-9c80df74.vercel.app/opti`
2. **Login** with credentials
3. **Add panels** and test optimization
4. **Check Network tab** - should show `/api/optimize` calls
5. **Check console** - should show Node.js optimization logs

### **Success indicators:**
- ✅ No `localhost:8000` errors
- ✅ No PHP service calls
- ✅ Optimization results appear
- ✅ No CORS errors

## 🚨 **Common Mistakes to Avoid**

1. **❌ Don't deploy to `starter-kit` project**
2. **❌ Don't use PHP service URL in OptiClient**
3. **❌ Don't deploy from corrupted main directory**
4. **❌ Don't forget to copy optimization files**

## 📝 **Deployment Log Example**

```bash
$ vercel --prod --yes
Vercel CLI 39.1.1
Retrieving project…
Deploying davids-projects-9c80df74/erp-turinova-admin
Uploading [====================] (113.1KB/113.1KB)
https://erp-turinova-admin-xxxxx-davids-projects-9c80df74.vercel.app
Production: https://erp-turinova-admin-xxxxx-davids-projects-9c80df74.vercel.app [4s]
Queued
Building
Completing
```

---

## 🎯 **Quick Reference Card**

```bash
# One-liner for optimization deployment:
cd /Volumes/T7/erp_turinova_new/starter-kit && cp /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit/src/app/api/optimize/route.ts src/app/api/optimize/ && cp /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit/src/app/\(dashboard\)/opti/OptiClient.tsx src/app/\(dashboard\)/opti/ && cp -r /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit/src/lib/optimization/* src/lib/optimization/ && cp /Volumes/T7/erp_turinova_new_backup_20250930_095141/starter-kit/src/types/optimization.ts src/types/ && vercel --prod --yes
```

**Live URL:** `https://erp-turinova-admin-davids-projects-9c80df74.vercel.app`
