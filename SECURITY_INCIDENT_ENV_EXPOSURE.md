# 🚨 Security Incident Report: .env.local Exposure

**Date:** October 22, 2025  
**Severity:** HIGH  
**Status:** MITIGATED (Keys removed from Git, rotation required)

---

## 🔴 What Happened

The `.env.local` file containing Supabase API keys was **accidentally committed to the Git repository** and pushed to GitHub.

### Exposed Credentials

**Supabase Database:** `xgkaviefifbllbmfbyfe.supabase.co`

**Exposed Keys:**
- ❌ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ❌ `SUPABASE_SERVICE_ROLE_KEY` (CRITICAL!)

---

## ✅ Immediate Actions Taken

1. **Removed .env files from repository**
   - Commit: `59da12b8c`
   - Deleted: `.env.local`, `._.env.local`
   - Pushed to main branch

2. **Updated .gitignore**
   - Already contains `.env.local` (was ignored, but files were previously committed)

---

## ⚠️ CRITICAL ACTIONS REQUIRED

### 1. **Rotate ALL Supabase Keys (URGENT!)**

Go to Supabase Dashboard → Project Settings → API:

#### **For Main App Database** (`xgkaviefifbllbmfbyfe.supabase.co`):
1. Click **"Generate new anon key"**
2. Click **"Generate new service_role key"**
3. **SAVE THE NEW KEYS SECURELY**

#### **For Customer Portal Database** (`oatbbtbkerxogzvwicxx.supabase.co`):
1. Click **"Generate new anon key"**
2. **SAVE THE NEW KEY SECURELY**

---

### 2. **Update Vercel Environment Variables**

#### **Main App Project:**
1. Go to Vercel Dashboard → Main App Project
2. **Settings** → **Environment Variables**
3. **Edit/Replace these variables:**
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<new-service-role-key>
   ```
4. **Redeploy** the application

#### **Customer Portal Project:**
1. Go to Vercel Dashboard → Customer Portal Project
2. **Settings** → **Environment Variables**
3. **Edit/Replace this variable:**
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-portal-anon-key>
   ```
4. **Redeploy** the application

---

### 3. **Update Local .env.local Files**

#### **Main App** (`/main-app/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xgkaviefifbllbmfbyfe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<new-service-role-key>
```

#### **Customer Portal** (`/customer-portal/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://oatbbtbkerxogzvwicxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-portal-anon-key>
```

---

### 4. **Check for Unauthorized Access**

1. **Supabase Dashboard** → Project → **Logs**
2. **Check for suspicious activity** between commit time and key rotation
3. **Review database audit logs** if available

---

### 5. **Git History (Optional but Recommended)**

The old keys still exist in **Git history**. To completely remove them:

```bash
# WARNING: This rewrites Git history - coordinate with team first!
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env.local ._.env.local' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (after team coordination)
git push origin --force --all
```

⚠️ **NOTE:** Only do this if you've coordinated with your team, as it will rewrite Git history!

---

## 📋 Prevention Checklist

### Immediate (Done):
- [x] Remove .env files from repository
- [x] Verify .gitignore contains .env patterns

### Urgent (TODO):
- [ ] Rotate Supabase keys
- [ ] Update Vercel environment variables
- [ ] Update local .env.local files
- [ ] Check for unauthorized database access

### Long-term:
- [ ] Set up pre-commit hooks to prevent .env commits
- [ ] Use secret scanning tools (GitHub Advanced Security)
- [ ] Document secure credential management
- [ ] Train team on security best practices

---

## 🛡️ Security Best Practices Going Forward

### 1. **Never Commit Secrets**
```bash
# Always check before committing
git status
git diff

# If you accidentally stage .env files:
git reset HEAD .env.local
```

### 2. **Use Pre-commit Hooks**

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
if git diff --cached --name-only | grep -E '\.env\.local$|\.env$'; then
    echo "❌ ERROR: Attempting to commit .env files!"
    echo "Remove them with: git reset HEAD .env.local"
    exit 1
fi
```

### 3. **Use Environment Variable Management**
- **Development:** Use `.env.local` (never commit)
- **Production:** Use Vercel environment variables
- **Secrets:** Use secret management tools (Vercel, AWS Secrets Manager, etc.)

### 4. **Regular Security Audits**
- Review Git commits for accidental secret exposure
- Rotate keys periodically (every 90 days)
- Monitor database access logs

---

## 📞 Contact

If you have questions about this incident or security procedures:
- Check this document
- Review `DEPLOYMENT_WORKFLOW_GUIDE.md`
- Consult with team lead

---

## 🔒 Summary

**What was exposed:** Supabase API keys (anon + service role)  
**Risk level:** HIGH (service role key has full database access)  
**Status:** Mitigated (removed from Git, rotation required)  
**Next steps:** Rotate keys immediately, update Vercel, verify no unauthorized access

**Remember:** Keys in Git history are **permanently exposed** until you rotate them!

---

**Last Updated:** October 22, 2025  
**Incident ID:** ENV-2025-001
