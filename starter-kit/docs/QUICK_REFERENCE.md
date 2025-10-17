# Quick Reference Guide

Fast access to common information, commands, and troubleshooting.

---

## 🚀 Essential Commands

### Development Server
```bash
# Start server (standard)
cd /Volumes/T7/erp_turinova_new/starter-kit && pnpm dev

# Clear cache and restart (fixes most issues)
cd /Volumes/T7/erp_turinova_new/starter-kit && rm -rf .next && pnpm dev

# Kill process on port 3000 and restart
cd /Volumes/T7/erp_turinova_new/starter-kit && lsof -ti:3000 | xargs kill -9 2>/dev/null; pnpm dev
```

### Git Workflow
```bash
# Check status
git status

# Stage all changes
git add -A

# Commit with message
git commit -m "feat: description"

# Push to GitHub
git push origin main

# View recent commits
git log --oneline --graph -10

# Undo last commit (keep changes)
git reset --soft HEAD~1
```

### Database
```bash
# Connect to Supabase via psql (set credentials in .env.local)
psql [connection-string]

# Run migration
psql [connection-string] -f add_active_field_to_materials.sql

# Check table
SELECT * FROM materials WHERE deleted_at IS NULL;

# Verify active field
SELECT name, active FROM materials LIMIT 10;
```

---

## 📍 Key URLs

### Local Development
- **Home**: http://localhost:3000
- **Login**: http://localhost:3000/login
- **Materials**: http://localhost:3000/materials
- **Media**: http://localhost:3000/media
- **Opti**: http://localhost:3000/opti
- **Partners**: http://localhost:3000/partners

### Production
- **Live Site**: https://turinova.hu

### Supabase
- **Dashboard**: https://supabase.com/dashboard
- **Project**: [Your project URL]

---

## 🗂️ File Locations

### Pages
```
src/app/(dashboard)/
├── home/page.tsx
├── materials/
│   ├── page.tsx (list)
│   ├── new/page.tsx
│   └── [id]/edit/page.tsx
├── media/page.tsx
├── opti/page.tsx
└── partners/page.tsx
```

### API Routes
```
src/app/api/
├── materials/
│   ├── route.ts (GET, POST)
│   ├── [id]/route.ts (GET, PATCH, DELETE)
│   ├── [id]/price-history/route.ts
│   ├── export/route.ts
│   └── import/
│       ├── preview/route.ts
│       └── route.ts
└── media/
    ├── route.ts (GET, DELETE)
    ├── upload/route.ts
    └── migrate/route.ts
```

### Components
```
src/components/
├── ImageUpload.tsx - Drag & drop image upload
├── MediaLibraryModal.tsx - Image picker from library
└── [other components]
```

### Configuration
```
starter-kit/
├── .env.local - Environment variables (NOT in git)
├── next.config.ts - Next.js configuration
├── package.json - Dependencies
└── tsconfig.json - TypeScript config
```

---

## 🔧 Common Issues & Quick Fixes

### Issue: Server Won't Start
```bash
# Solution 1: Clear cache
rm -rf .next && pnpm dev

# Solution 2: Kill existing process
lsof -ti:3000 | xargs kill -9; pnpm dev

# Solution 3: Reinstall dependencies
rm -rf node_modules && pnpm install
```

### Issue: Hydration Mismatch
**Symptom**: "Hydration failed because server rendered HTML didn't match client"

**Solutions**:
1. Wrap client-only code in `{mounted && ...}`
2. Use SSR for initial data (don't fetch in useEffect)
3. Clear `.next` cache and restart
4. Check for `Date.now()`, `Math.random()`, or conditional rendering

### Issue: Import Failed
**Common Causes**:
- Missing required fields → Check validation in preview (includes "Aktív")
- Invalid "Aktív" value → Must be "Igen" or "Nem"
- Invalid brand → Check brands exist or will be auto-created
- Image filename not in Media library → Upload image first

### Issue: Price History Not Showing
**Solutions**:
1. Check if `material.id` is defined
2. Verify SSR data passed to client component
3. Check console for API errors
4. Restart server to clear cache

### Issue: Permission Denied
**Quick Fix**:
- Currently bypassed for `/materials` and `/media`
- Check `useNavigation.ts` for temporary bypasses
- Future: Run `add_media_page.sql` when permissions re-enabled

---

## 📊 Database Quick Reference

### Key Tables
```sql
-- Materials
SELECT * FROM materials WHERE deleted_at IS NULL;

-- Material Settings
SELECT * FROM material_settings WHERE material_id = '[id]';

-- Brands
SELECT * FROM brands ORDER BY name;

-- Currencies
SELECT * FROM currencies;

-- VAT Rates
SELECT * FROM vat;

-- Price History
SELECT * FROM material_price_history 
WHERE material_id = '[id]' 
ORDER BY changed_at DESC LIMIT 10;

-- Media Files
SELECT * FROM media_files ORDER BY created_at DESC;
```

### Useful Queries
```sql
-- Find materials without images
SELECT id, name FROM materials 
WHERE (image_url IS NULL OR image_url = '') 
AND deleted_at IS NULL;

-- Find inactive materials
SELECT id, name, active FROM materials 
WHERE active = FALSE 
AND deleted_at IS NULL;

-- Count active vs inactive materials
SELECT 
  active,
  COUNT(*) as count
FROM materials 
WHERE deleted_at IS NULL
GROUP BY active;

-- Count images in Media library
SELECT COUNT(*) FROM media_files;

-- Recent price changes
SELECT 
  m.name,
  mph.old_price,
  mph.new_price,
  mph.changed_at
FROM material_price_history mph
JOIN materials m ON m.id = mph.material_id
ORDER BY mph.changed_at DESC
LIMIT 20;

-- Storage usage by material
SELECT 
  m.name,
  mf.size,
  mf.original_filename
FROM materials m
JOIN media_files mf ON m.image_url LIKE '%' || mf.stored_filename || '%'
WHERE m.deleted_at IS NULL
ORDER BY mf.size DESC;
```

---

## 🎨 UI Component Patterns

### Standard Page Structure
```tsx
// page.tsx (Server Component)
export default async function Page() {
  const data = await fetchServerSideData()
  return <ClientComponent initialData={data} />
}

// ClientComponent.tsx
'use client'
export default function ClientComponent({ initialData }) {
  const [data, setData] = useState(initialData)
  // ... rest of component
}
```

### Form Validation Pattern
```tsx
const handleSave = async () => {
  // Validate all required fields
  if (!formData.field.trim()) {
    toast.error('Kérjük, töltse ki a mezőt!')
    return
  }
  
  // Save...
}
```

### API Error Handling
```tsx
try {
  const response = await fetch('/api/endpoint')
  if (!response.ok) {
    const error = await response.json()
    toast.error(error.message || 'Hiba történt')
    return
  }
  const data = await response.json()
  toast.success('Sikeres mentés!')
} catch (error) {
  console.error('Error:', error)
  toast.error('Hiba történt a művelet során')
}
```

---

## 📦 Package Management

### Add New Package
```bash
pnpm add [package-name]
pnpm add -D [dev-package] # Dev dependency
```

### Update Packages
```bash
pnpm update # Update all
pnpm update [package-name] # Update specific
```

### Check Installed Versions
```bash
pnpm list [package-name]
```

---

## 🔍 Debugging Tips

### Check Server Logs
Look for these log patterns:
```
[PERF] - Performance metrics
Middleware - Auth and routing info
Fetching material [id] - API calls
Error: - Errors with stack traces
```

### Common Log Messages
```
"Module not found" → Check imports, may need server restart
"Hydration failed" → SSR/client mismatch, wrap in {mounted}
"500 Internal Server Error" → Check server logs for details
"401 Unauthorized" → Auth issue, check Supabase session
```

### Browser Console
```javascript
// Check if client-side data loaded
console.log('Materials:', materials)

// Force re-render
window.location.reload()

// Clear localStorage
localStorage.clear()
```

---

## 🎯 Feature Flags & Toggles

### Current Bypasses
- **Permissions**: Bypassed for `/materials` and `/media` pages
  - Location: `src/hooks/useNavigation.ts`
  - Reason: Database permission system not fully active
  - Future: Remove bypass when permissions re-enabled

### Environment Variables
```bash
# .env.local (not in git)
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-key]
```

---

## 📚 Documentation Locations

### This Repository
```
docs/
├── README.md - Documentation system overview
├── CHANGELOG.md - Feature history
├── QUICK_REFERENCE.md - This file
├── chat-archives/ - Cursor session exports
└── decisions/ - Architectural decisions

development_documentation/
├── AUTHENTICATION_DOCUMENTATION.md
├── CRUD_FUNCTIONALITY_GUIDE.md
├── PERFORMANCE_OPTIMIZATION_GUIDE.md
└── [many more...]
```

### External
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **MUI Docs**: https://mui.com/material-ui/getting-started/

---

## 🆘 Emergency Procedures

### Server Crashed
```bash
# Step 1: Check if process running
lsof -ti:3000

# Step 2: Kill if needed
lsof -ti:3000 | xargs kill -9

# Step 3: Clear cache
rm -rf .next

# Step 4: Restart
pnpm dev
```

### Database Corrupted
```bash
# Restore from backup (if available)
psql [connection] -f restore_database.sql

# Or check Supabase dashboard → Database → Backups
```

### Lost All Changes
```bash
# Check git status
git status

# Discard unstaged changes
git restore [file]

# Restore from last commit
git reset --hard HEAD

# Restore from specific commit
git reset --hard [commit-hash]
```

### Deployment Failed
```bash
# Check Vercel logs
vercel logs

# Redeploy
vercel --prod

# Or via git push (triggers auto-deploy)
git push origin main
```

---

## 📞 Support Contacts

### Services
- **Supabase**: Dashboard → Support
- **Vercel**: Dashboard → Help
- **GitHub**: Repository → Issues

### Documentation
- Check `development_documentation/` folder first
- Search chat archives: `grep -r "keyword" docs/chat-archives/`
- Review git history: `git log --all --grep="keyword"`

---

**Last Updated**: October 1, 2025  
**Version**: 1.0  
**Maintained By**: Development team

