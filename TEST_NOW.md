# 🧪 Test the Restructured Apps Now!

## ✅ Restructure Complete

Both apps are now running independently. Time to test!

---

## 🚀 Start Both Apps

### Terminal 1: Main App
```bash
cd /Volumes/T7/erp_turinova_new/main-app
npm run dev
```
**Expected**: Server starts on `http://localhost:3000`

### Terminal 2: Customer Portal
```bash
cd /Volumes/T7/erp_turinova_new/customer-portal
npm run dev
```
**Expected**: Server starts on `http://localhost:3001`

---

## 🧪 Test Sequence

### 1️⃣ Test Main App (localhost:3000)

1. **Open**: `http://localhost:3000`
   - ✅ Should see landing page
   - ✅ Single button: "Belépés vállalkozásoknak"

2. **Click** "Belépés vállalkozásoknak"
   - ✅ Should go to `/login`
   
3. **Login** with company staff credentials
   - ✅ Should redirect to `/home`
   - ✅ Dashboard loads
   - ✅ All features work

**Main app status**: ✅ Working!

---

### 2️⃣ Test Customer Portal (localhost:3001)

1. **Open**: `http://localhost:3001`
   - ✅ Should see landing page
   - ✅ Two buttons: "Bejelentkezés" and "Regisztráció"

2. **Click** "Regisztráció"
   - ✅ Should go to `/register`
   - ✅ 3-step form appears
   
3. **Complete Registration**:
   - **Step 1** (Account):
     - Name: Test Customer
     - Email: test@customer.com
     - Phone: +36 30 123 4567
     - Password: test123
     - Confirm: test123
   - Click "Következő"
   
   - **Step 2** (Billing) - Skip or fill
   - Click "Következő"
   
   - **Step 3** (Settings):
     - Select company: "Turinova ERP"
     - SMS toggle: optional
   - Click "Regisztráció"
   
   - ✅ Should show success toast
   - ✅ Should redirect to `/login`

4. **Login** with customer credentials:
   - Email: test@customer.com
   - Password: test123
   - Click "Bejelentkezés"
   - ✅ Should redirect to `/home`
   - ✅ Dashboard shows with welcome message

5. **Click** "Kijelentkezés"
   - ✅ Should redirect to `/login`

**Customer portal status**: ✅ Working!

---

## ✅ Success Checklist

After testing, verify:

### Both Apps Running
- [ ] Main app on port 3000
- [ ] Customer portal on port 3001
- [ ] No port conflicts
- [ ] Both accessible simultaneously

### Main App
- [ ] Landing page loads
- [ ] Login works
- [ ] Dashboard works
- [ ] No errors in console
- [ ] All features intact

### Customer Portal
- [ ] Landing page loads
- [ ] Registration works (3 steps)
- [ ] Company dropdown populates
- [ ] Login works
- [ ] Home dashboard loads
- [ ] Logout works
- [ ] No errors in console

### Database
- [ ] Check customer-portal-prod auth.users table - new user exists
- [ ] Check portal_customers table - customer record exists
- [ ] IDs match between auth.users and portal_customers

---

## 🐛 Common Issues

### "Port 3000 already in use"
**Solution**: That's for main app. Customer portal should use 3001.

### "Can't access localhost:3001"
**Solution**: Make sure you started customer portal: `cd customer-portal && npm run dev`

### "Company dropdown empty"
**Solution**: Verify companies exist in customer-portal-prod database:
```sql
SELECT * FROM companies WHERE is_active = true;
```

### "Login fails"
**Solution**: Make sure you registered first. Customer portal has separate auth.

---

## 📊 Verification SQL

Run in **customer-portal-prod** Supabase:

```sql
-- Check companies
SELECT id, name, slug, is_active FROM companies;

-- Check registered customers
SELECT id, name, email, created_at FROM portal_customers ORDER BY created_at DESC;

-- Check auth users
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Verify IDs match
SELECT 
  au.id, au.email,
  pc.name, pc.mobile
FROM auth.users au
LEFT JOIN portal_customers pc ON au.id = pc.id
ORDER BY au.created_at DESC;
```

---

## 🎯 What's Next?

Once both apps are tested and working:

### Phase 2: Customer Features
1. Create customer settings page
2. Implement quote creation (/opti clone)
3. Quote detail and management
4. Quote submission to company
5. Order tracking

### Deployment
1. Deploy main app to Vercel
2. Deploy customer portal to Vercel
3. Configure rewrites
4. Test production URLs

---

## 📞 Need Help?

If you encounter errors:
1. Check terminal logs for both apps
2. Check browser console
3. Verify .env.local files exist in both folders
4. Ensure databases are accessible

---

**Test both apps now!** 🚀

**Main App**: `http://localhost:3000`  
**Customer Portal**: `http://localhost:3001`

