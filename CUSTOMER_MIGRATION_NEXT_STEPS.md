# Customer Migration - Next Steps: Testing & Development

## Step 1: Verify Database Migration ✅

### Run these SQL queries to verify migration:

```sql
-- Check person migration
SELECT 
  (SELECT COUNT(*) FROM customer_entities WHERE entity_type = 'person' AND deleted_at IS NULL) as old_persons,
  (SELECT COUNT(*) FROM customer_persons WHERE deleted_at IS NULL) as new_persons;

-- Check company migration
SELECT 
  (SELECT COUNT(*) FROM customer_entities WHERE entity_type = 'company' AND deleted_at IS NULL) as old_companies,
  (SELECT COUNT(*) FROM customer_companies WHERE deleted_at IS NULL) as new_companies;

-- Check addresses migration
SELECT 
  COUNT(*) FILTER (WHERE person_id IS NOT NULL) as person_addresses,
  COUNT(*) FILTER (WHERE company_id IS NOT NULL) as company_addresses,
  COUNT(*) FILTER (WHERE customer_entity_id IS NOT NULL) as old_addresses
FROM customer_addresses
WHERE deleted_at IS NULL;

-- Check bank accounts migration
SELECT 
  COUNT(*) FILTER (WHERE person_id IS NOT NULL) as person_bank_accounts,
  COUNT(*) FILTER (WHERE company_id IS NOT NULL) as company_bank_accounts,
  COUNT(*) FILTER (WHERE customer_entity_id IS NOT NULL) as old_bank_accounts
FROM customer_bank_accounts
WHERE deleted_at IS NULL;

-- Check platform mappings migration
SELECT 
  COUNT(*) FILTER (WHERE person_id IS NOT NULL) as person_mappings,
  COUNT(*) FILTER (WHERE company_id IS NOT NULL) as company_mappings
FROM customer_platform_mappings;
```

**✅ If counts match, migration is successful!**

---

## Step 2: Development Plan

### Phase 1: API Endpoints (CRITICAL - Do First) 🔴

**Priority: HIGH** - Without working APIs, UI won't work

#### 2.1 Create New API Structure

**New endpoints needed:**
- `/api/customers/persons/route.ts` - List/create persons
- `/api/customers/persons/[id]/route.ts` - Get/update/delete person
- `/api/customers/companies/route.ts` - List/create companies
- `/api/customers/companies/[id]/route.ts` - Get/update/delete company
- `/api/customers/persons/[id]/addresses/route.ts` - Person addresses
- `/api/customers/companies/[id]/addresses/route.ts` - Company addresses
- `/api/customers/persons/[id]/bank-accounts/route.ts` - Person bank accounts
- `/api/customers/companies/[id]/bank-accounts/route.ts` - Company bank accounts
- `/api/customers/persons/[id]/relationships/route.ts` - Person-company relationships
- `/api/customers/companies/[id]/relationships/route.ts` - Company-person relationships
- `/api/customers/persons/[id]/sync/route.ts` - Sync person to webshop
- `/api/customers/companies/[id]/sync/route.ts` - Sync company to webshop

**Files to update:**
- `/api/connections/[id]/sync-customers/route.ts` - Update to use new tables

#### 2.2 Testing API Endpoints

**Test checklist:**
- [ ] GET `/api/customers/persons` - List persons
- [ ] POST `/api/customers/persons` - Create person
- [ ] GET `/api/customers/persons/[id]` - Get person with addresses/bank accounts
- [ ] PUT `/api/customers/persons/[id]` - Update person
- [ ] DELETE `/api/customers/persons/[id]` - Soft delete person
- [ ] GET `/api/customers/companies` - List companies
- [ ] POST `/api/customers/companies` - Create company
- [ ] GET `/api/customers/companies/[id]` - Get company with addresses/bank accounts
- [ ] PUT `/api/customers/companies/[id]` - Update company
- [ ] DELETE `/api/customers/companies/[id]` - Soft delete company
- [ ] POST `/api/customers/persons/[id]/relationships` - Link person to company
- [ ] GET `/api/customers/companies/[id]/relationships` - Get company's linked persons

---

### Phase 2: UI Components 🟡

**Priority: MEDIUM** - After APIs work

#### 2.1 Create New Pages

**New pages needed:**
- `/customers/persons/page.tsx` - Persons list
- `/customers/persons/new/page.tsx` - Create person
- `/customers/persons/[id]/page.tsx` - Person detail/edit
- `/customers/companies/page.tsx` - Companies list
- `/customers/companies/new/page.tsx` - Create company
- `/customers/companies/[id]/page.tsx` - Company detail/edit

**Components needed:**
- `PersonsTable.tsx` - Table for persons
- `CompaniesTable.tsx` - Table for companies
- `PersonEditForm.tsx` - Edit person form
- `CompanyEditForm.tsx` - Edit company form
- `PersonCompanyRelationshipsCard.tsx` - Manage relationships
- `CompanyContactPersonsCard.tsx` - Show linked persons for company

#### 2.2 Update Navigation Menu

**File:** `shop-portal/src/data/navigation/verticalMenuData.tsx`

**Change:**
- Remove: `/customers` (unified)
- Add: `/customers/persons` and `/customers/companies`

---

### Phase 3: Sync Logic 🟢

**Priority: MEDIUM** - After APIs and basic UI work

#### 3.1 Update ShopRenter Sync (PULL)

**File:** `/api/connections/[id]/sync-customers/route.ts`

**Changes needed:**
- Determine if ShopRenter customer is person or company
- Create in appropriate table (`customer_persons` or `customer_companies`)
- Update platform mappings to use new table structure

#### 3.2 Update ShopRenter Sync (PUSH)

**Files:**
- `/api/customers/persons/[id]/sync/route.ts`
- `/api/customers/companies/[id]/sync/route.ts`

**Changes needed:**
- Read from `customer_persons` or `customer_companies`
- Use new `customer_platform_mappings` table
- Handle person vs company data correctly

---

## Step 3: Testing Strategy

### 3.1 Database Testing
```sql
-- Test 1: Create a person
INSERT INTO customer_persons (firstname, lastname, email) 
VALUES ('Test', 'Person', 'test@example.com') 
RETURNING id;

-- Test 2: Create a company
INSERT INTO customer_companies (name, email) 
VALUES ('Test Company', 'company@example.com') 
RETURNING id;

-- Test 3: Link person to company
INSERT INTO customer_person_company_relationships (person_id, company_id, role)
VALUES (
  (SELECT id FROM customer_persons WHERE email = 'test@example.com'),
  (SELECT id FROM customer_companies WHERE email = 'company@example.com'),
  'contact_person'
);

-- Test 4: Verify relationship
SELECT 
  p.firstname || ' ' || p.lastname as person_name,
  c.name as company_name,
  r.role
FROM customer_person_company_relationships r
JOIN customer_persons p ON r.person_id = p.id
JOIN customer_companies c ON r.company_id = c.id
WHERE r.deleted_at IS NULL;
```

### 3.2 API Testing

**Use Postman or curl:**

```bash
# Test person creation
curl -X POST http://localhost:3000/api/customers/persons \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "János",
    "lastname": "Kovács",
    "email": "janos@example.com"
  }'

# Test company creation
curl -X POST http://localhost:3000/api/customers/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Kft.",
    "email": "info@abc.hu",
    "tax_number": "12345678-1-23"
  }'

# Test relationship creation
curl -X POST http://localhost:3000/api/customers/persons/{person_id}/relationships \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "{company_id}",
    "role": "contact_person",
    "is_primary": true
  }'
```

### 3.3 UI Testing

**Manual testing checklist:**
- [ ] Navigate to `/customers/persons` - Should show persons list
- [ ] Click "Új személy" - Should open create form
- [ ] Create a person - Should save and redirect
- [ ] Edit a person - Should load and save changes
- [ ] Navigate to `/customers/companies` - Should show companies list
- [ ] Create a company - Should save correctly
- [ ] Link person to company - Should create relationship
- [ ] View company's contact persons - Should show linked persons

---

## Step 4: Development Order (Recommended)

### Week 1: APIs
1. ✅ Day 1-2: Create person APIs (CRUD)
2. ✅ Day 3-4: Create company APIs (CRUD)
3. ✅ Day 5: Create relationship APIs
4. ✅ Day 6: Update sync logic (PULL)
5. ✅ Day 7: Update sync logic (PUSH)

### Week 2: UI
1. ✅ Day 1-2: Create persons pages (list, new, edit)
2. ✅ Day 3-4: Create companies pages (list, new, edit)
3. ✅ Day 5: Create relationship management UI
4. ✅ Day 6: Update navigation menu
5. ✅ Day 7: Testing and bug fixes

### Week 3: Polish & Cleanup
1. ✅ Day 1-2: Edge cases and error handling
2. ✅ Day 3: Performance optimization
3. ✅ Day 4: Final testing
4. ✅ Day 5: Run cleanup script (drop old tables)

---

## Quick Start: What to Do Right Now

### Option A: Start with APIs (Recommended)
1. Create `/api/customers/persons/route.ts` (GET, POST)
2. Test with Postman/curl
3. Create `/api/customers/companies/route.ts` (GET, POST)
4. Test with Postman/curl
5. Continue with detail endpoints

### Option B: Start with UI (Faster to see results)
1. Create `/customers/persons/page.tsx` (simple list)
2. Create `/customers/companies/page.tsx` (simple list)
3. Update navigation menu
4. Test basic navigation
5. Then build APIs

---

## Important Notes

⚠️ **DO NOT run cleanup script yet!**
- Keep `customer_entities` table until everything is migrated
- Old APIs will still work (they use `customer_entities`)
- New APIs will use new tables
- Gradually migrate users to new pages

✅ **Migration is backward compatible**
- Old code still works (uses `customer_entities`)
- New code uses new structure
- Can migrate gradually

---

## Questions to Answer Before Starting

1. **Should we keep old `/customers` page working?**
   - Yes: Keep for backward compatibility
   - No: Redirect to new pages

2. **How to handle existing UI?**
   - Option A: Create new pages, keep old ones
   - Option B: Replace old pages immediately

3. **Sync logic priority?**
   - High: If you need webshop sync working
   - Low: If you can test without sync first

---

## Ready to Start?

**Recommended first step:**
1. Verify migration with SQL queries above
2. Create `/api/customers/persons/route.ts` (GET, POST)
3. Test with Postman
4. Continue from there

**Need help?** Ask me to implement any specific part!
