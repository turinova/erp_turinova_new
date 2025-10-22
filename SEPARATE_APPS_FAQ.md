# Separate Apps Architecture - FAQ

## ❓ Frequently Asked Questions

### General Questions

#### Q: Why do we need two separate apps?
**A**: To avoid conflicts between:
- Different Supabase databases (main app vs customer portal)
- Different authentication systems (staff vs customers)
- Different middleware logic
- Different route structures

With separate apps, each can be developed, tested, and deployed independently.

---

#### Q: Will this make development harder?
**A**: No! Benefits outweigh the minimal overhead:
- ✅ Cleaner code (no mixed concerns)
- ✅ Faster development (no conflicts)
- ✅ Easier debugging (isolated issues)
- ✅ Better performance (no unnecessary middleware)
- ⚠️ Need to run 2 terminals (minor inconvenience)

---

#### Q: Do I need two Git repositories?
**A**: No! Both apps live in **one repository**:
```
erp_turinova_new/
├── main-app/
└── customer-portal/
```
Single commit, single push, same workflow.

---

### Git & Version Control

#### Q: How do I commit changes?
**A**: Exactly the same as before!

```bash
# Commit changes to both apps
git add .
git commit -m "feat: update branding"
git push origin main

# Commit only main app
git add main-app/
git commit -m "fix: quote calculation"
git push origin main

# Commit only customer portal
git add customer-portal/
git commit -m "feat: add settings page"
git push origin main
```

---

#### Q: Can I create feature branches?
**A**: Yes! Works the same way:

```bash
git checkout -b feature/customer-quotes
# Make changes to customer-portal/
git add customer-portal/
git commit -m "feat: implement quote creation"
git push origin feature/customer-quotes
# Create PR as usual
```

---

#### Q: How do I revert changes?
**A**: Same as before:

```bash
# Revert last commit
git revert HEAD
git push origin main

# Revert specific commit
git revert <commit-hash>
git push origin main
```

---

### Development

#### Q: How do I start development?
**A**: Run both apps in separate terminals:

```bash
# Terminal 1
cd main-app
npm run dev
# → localhost:3000

# Terminal 2
cd customer-portal
npm run dev
# → localhost:3001
```

---

#### Q: Can they run on the same port?
**A**: No, in development they need different ports. But in production, they'll both use port 443 (HTTPS) with rewrites.

---

#### Q: What if I only want to work on one app?
**A**: Just start that app! They're independent.

```bash
# Only work on main app
cd main-app && npm run dev

# Only work on customer portal
cd customer-portal && npm run dev
```

---

#### Q: Do I need to install dependencies twice?
**A**: Yes, each app has its own `node_modules/`:

```bash
# Main app dependencies
cd main-app && npm install

# Customer portal dependencies
cd customer-portal && npm install
```

But they share many packages, so it's not double the size.

---

### Deployment

#### Q: How many Vercel projects do I need?
**A**: Two Vercel projects, but both connected to the same Git repo:

1. **turinova-main-app** (Root: main-app/)
2. **turinova-customer-portal** (Root: customer-portal/)

---

#### Q: How does deployment work?
**A**: Automatic! When you push to Git:

```
git push origin main
      ↓
Vercel detects changes
      ↓
   Changes in main-app/? → Deploy main app
   Changes in customer-portal/? → Deploy customer portal
   Changes in both? → Deploy both
```

---

#### Q: Can customers access the portal at turinova.hu/customer/?
**A**: Yes! Using Vercel rewrites:

```
User visits: turinova.hu/customer/home
      ↓
Vercel rewrites to: customer-portal.vercel.app/home
      ↓
URL stays: turinova.hu/customer/home
```

Customer never knows they're on a different app!

---

#### Q: What if I want separate domains?
**A**: That's even easier! No rewrites needed:

```
Main App: erp.turinova.hu
Customer Portal: portal.turinova.hu
```

Just point DNS and you're done.

---

### URLs & Routing

#### Q: How do URLs work in development vs production?

**Development:**
```
Main App:        localhost:3000/home
Customer Portal: localhost:3001/home
```

**Production (with rewrites):**
```
Main App:        turinova.hu/home
Customer Portal: turinova.hu/customer/home
```

**Production (with subdomains):**
```
Main App:        erp.turinova.hu/home
Customer Portal: portal.turinova.hu/home
```

---

#### Q: Do I need to change my code for production URLs?
**A**: No! The apps don't know about the `/customer` prefix. Vercel handles it:

```typescript
// In customer portal code
<Link href="/home">Home</Link>

// In development
→ localhost:3001/home

// In production (with rewrites)
→ turinova.hu/customer/home

// The app doesn't know about /customer prefix!
```

---

### Database & Data

#### Q: Can the customer portal access the main app database?
**A**: Yes, for read-only data! When a customer needs to see materials or prices:

```typescript
// customer-portal/lib/company-api.ts
export async function fetchMaterials(companyId: string) {
  // Get company Supabase credentials from portal DB
  const company = await getCompany(companyId)
  
  // Create client for that company's database
  const companySupabase = createClient(
    company.supabase_url,
    company.supabase_anon_key
  )
  
  // Fetch materials
  return await companySupabase
    .from('materials')
    .select('*')
    .eq('active', true)
}
```

---

#### Q: How does quote submission work?
**A**: Quote is copied from portal DB to main app DB:

```
1. Customer creates quote in portal_quotes
2. Customer clicks "Submit"
3. API copies entire quote to main app's quotes table
4. Sets source='customer_portal' in main app
5. Sets status='submitted' in portal
6. Links both via submitted_to_company_quote_id
```

---

#### Q: What if main app database changes?
**A**: Customer portal is isolated! Schema changes in main app don't break customer portal. Only the quote submission API needs updating if quote structure changes.

---

### Code Sharing

#### Q: Can I share components between apps?
**A**: Best practice: **Copy don't share**

```bash
# Copy a component
cp main-app/src/components/SomeComponent.tsx customer-portal/components/

# Then modify as needed for customer portal
```

**Why copy instead of import?**
- No tight coupling
- Each app can evolve independently
- Easier to understand and debug
- No complex build configurations

---

#### Q: What about shared utilities like optimization?
**A**: Copy them once during setup:

```bash
cp -r main-app/src/lib/optimization/ customer-portal/lib/
```

If the algorithm updates, copy again. But this is rare (maybe 2-3 times per year).

---

#### Q: Isn't duplicating code bad?
**A**: In this case, **duplication is better than coupling**:
- ✅ Each app is self-contained
- ✅ Changes don't break the other app
- ✅ Easier to maintain
- ✅ Better for different teams (if you scale)

---

### Production & Performance

#### Q: Will rewrites slow down the customer portal?
**A**: No! Rewrites happen at the edge (Vercel's CDN):
- Latency: <10ms additional
- Transparent to users
- Full HTTPS encryption
- Cached efficiently

---

#### Q: Can I have different versions in production?
**A**: Yes! Each app deploys independently:

```
Main App: v2.5.0 (turinova.hu)
Customer Portal: v1.2.0 (turinova.hu/customer)
```

You can update one without touching the other.

---

#### Q: What about database migrations?
**A**: Each app manages its own:

```
Main App:
└── supabase/migrations/
    └── 20251020_add_source_column.sql

Customer Portal:
└── supabase/migrations/
    └── 20251020_create_portal_tables.sql
```

Run them separately in their respective Supabase projects.

---

### Troubleshooting

#### Q: I get "Port 3000 already in use" for customer portal
**A**: Good! Customer portal should use port 3001:

```bash
cd customer-portal
npm run dev  # Uses port 3001
```

---

#### Q: I can't access /customer/home in development
**A**: In development, use port 3001 directly:

```
Development: localhost:3001/home
Production: turinova.hu/customer/home
```

The `/customer` prefix only exists in production via rewrites.

---

#### Q: Sessions don't persist across apps
**A**: Correct! They're separate apps with separate auth:
- Main app: Staff login
- Customer portal: Customer login
- Different Supabase projects
- Different sessions
- **This is intentional!**

---

#### Q: I made changes but customer portal didn't update
**A**: Make sure you're editing the right app:

```bash
# Check which app you're in
pwd
# Should show: /Volumes/T7/erp_turinova_new/customer-portal

# If in main-app/ by mistake, navigate to customer-portal/
cd ../customer-portal
```

---

### Migration & Scaling

#### Q: Can I migrate back to a single app later?
**A**: Yes, but not recommended. The separation provides benefits:
- Cleaner code
- Better performance
- Easier to scale
- Different teams can work on each

---

#### Q: What if I want to add a mobile app later?
**A**: Easy! The customer portal already exposes APIs:

```
erp_turinova_new/
├── main-app/          (Web - Staff)
├── customer-portal/   (Web - Customers)
└── mobile-app/        (React Native - Customers)
                       Uses customer-portal APIs!
```

---

#### Q: Can I have multiple customer portal instances?
**A**: Yes! For white-labeling:

```
erp_turinova_new/
├── main-app/
├── customer-portal/        (Turinova customers)
├── customer-portal-abc/    (ABC Corp customers)
└── customer-portal-xyz/    (XYZ Corp customers)
```

Each with its own branding and database.

---

### Cost & Resources

#### Q: Does this cost more?
**A**: No additional cost:

**Vercel:**
- Hobby: Free for 2 projects
- Pro: $20/month (unlimited projects)

**Supabase:**
- Already planned: 2 projects ($50/month)
- No change

---

#### Q: Does this use more resources?
**A**: In development: Yes (2 Node processes)
In production: No (Vercel manages resources)

---

## 🎯 Decision Matrix

### When to Use Separate Apps

✅ **Use Separate Apps If:**
- Different user types (staff vs customers)
- Different databases
- Different authentication systems
- Different deployment schedules
- Different scaling requirements

❌ **Use Single App If:**
- Same users
- Same database
- Same authentication
- Simple application
- Shared routes

**Your case**: Perfect fit for separate apps! ✅

---

## 📚 Additional Resources

- [Next.js Monorepo Guide](https://nextjs.org/docs/advanced-features/multi-zones)
- [Vercel Rewrites Documentation](https://vercel.com/docs/concepts/projects/project-configuration#rewrites)
- [Supabase Multi-tenant Architecture](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ Recommendation

**Proceed with separate apps architecture** because:

1. ✅ Solves all current authentication issues
2. ✅ No changes to Git workflow
3. ✅ Maintains unified production URL
4. ✅ Better long-term maintainability
5. ✅ Easier to scale
6. ✅ Cleaner codebase

**Estimated time**: 2 hours for complete restructure and testing.

---

Ready to implement? Follow the **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** step by step! 🚀

