# Category Sync & AI Testing Guide

## Step 1: Run Database Migration

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to **SQL Editor**

2. **Run the Migration**
   - Open file: `supabase/migrations/20250304_create_categories_tables.sql`
   - Copy the entire SQL content
   - Paste into Supabase SQL Editor
   - Click **Run** or press `Ctrl+Enter`

3. **Verify Tables Created**
   ```sql
   -- Run this to verify tables exist:
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'shoprenter_categories',
     'shoprenter_category_descriptions',
     'shoprenter_product_category_relations',
     'category_description_generations'
   );
   ```

4. **Verify Page Added**
   ```sql
   -- Check if /categories page was added:
   SELECT * FROM public.pages WHERE path = '/categories';
   ```

---

## Step 2: Test Category Sync API

### 2.1 Test Bulk Category Sync

**Using Browser/Postman:**

1. **Get your connection ID**
   - Go to `/connections` page in your app
   - Note the connection ID (UUID) you want to test

2. **Start Bulk Sync**
   ```bash
   # Replace [connectionId] with your actual connection ID
   POST http://localhost:3000/api/connections/[connectionId]/sync-categories
   ```

   **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Category sync started",
     "connectionId": "..."
   }
   ```

3. **Check Progress**
   ```bash
   GET http://localhost:3000/api/connections/[connectionId]/sync-categories
   ```

   **Expected Response:**
   ```json
   {
     "progress": {
       "total": 50,
       "synced": 25,
       "current": 25,
       "status": "syncing",
       "errors": 0,
       "startTime": 1234567890
     }
   }
   ```

4. **Monitor in Browser Console**
   - Open browser DevTools (F12)
   - Check Console tab for sync logs
   - Look for: `[CATEGORY SYNC]` messages

### 2.2 Test Single Category Sync

**Prerequisites:**
- You need at least one category synced first (from bulk sync)

1. **Get a Category ID**
   ```sql
   -- Run in Supabase SQL Editor:
   SELECT id, name, shoprenter_id 
   FROM shoprenter_categories 
   WHERE deleted_at IS NULL 
   LIMIT 1;
   ```

2. **Sync Single Category**
   ```bash
   POST http://localhost:3000/api/categories/[categoryId]/sync
   ```

   **Expected Response:**
   ```json
   {
     "success": true,
     "category": {
       "id": "...",
       "name": "Category Name",
       ...
     }
   }
   ```

---

## Step 3: Verify Synced Data

### 3.1 Check Categories in Database

```sql
-- View all synced categories:
SELECT 
  id,
  name,
  shoprenter_id,
  status,
  sync_status,
  last_synced_at,
  category_url
FROM shoprenter_categories
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
```

### 3.2 Check Category Descriptions

```sql
-- View category descriptions:
SELECT 
  cd.id,
  c.name as category_name,
  cd.name as description_name,
  cd.language_id,
  cd.description,
  cd.meta_description
FROM shoprenter_category_descriptions cd
JOIN shoprenter_categories c ON c.id = cd.category_id
WHERE c.deleted_at IS NULL
LIMIT 10;
```

### 3.3 Check Parent-Child Relationships

```sql
-- View category hierarchy:
SELECT 
  parent.id as parent_id,
  parent.name as parent_name,
  child.id as child_id,
  child.name as child_name
FROM shoprenter_categories parent
JOIN shoprenter_categories child ON child.parent_category_id = parent.id
WHERE parent.deleted_at IS NULL
  AND child.deleted_at IS NULL
LIMIT 10;
```

---

## Step 4: Test AI Category Description Generation

### 4.1 Generate Description via API

**Prerequisites:**
- Category must be synced
- Category should have products (for better results)

1. **Get Category ID with Products**
   ```sql
   -- Find category with products:
   SELECT 
     c.id,
     c.name,
     COUNT(pcr.id) as product_count
   FROM shoprenter_categories c
   LEFT JOIN shoprenter_product_category_relations pcr 
     ON pcr.category_id = c.id 
     AND pcr.deleted_at IS NULL
   WHERE c.deleted_at IS NULL
   GROUP BY c.id, c.name
   HAVING COUNT(pcr.id) > 0
   ORDER BY product_count DESC
   LIMIT 1;
   ```

2. **Generate Description**
   ```bash
   POST http://localhost:3000/api/categories/[categoryId]/generate-description
   Content-Type: application/json
   
   {
     "language": "hu",
     "useProductData": true,
     "temperature": 0.7,
     "maxTokens": 2000
   }
   ```

   **Expected Response:**
   ```json
   {
     "success": true,
     "description": "<h2>Bevezetés</h2><p>...</p>",
     "tokensUsed": 1234,
     "productsAnalyzed": 15
   }
   ```

3. **Check Generation History**
   ```sql
   -- View AI generation history:
   SELECT 
     cdg.id,
     c.name as category_name,
     cdg.tokens_used,
     cdg.source_products_count,
     cdg.created_at,
     LEFT(cdg.generated_description, 100) as description_preview
   FROM category_description_generations cdg
   JOIN shoprenter_categories c ON c.id = cdg.category_id
   ORDER BY cdg.created_at DESC
   LIMIT 5;
   ```

---

## Step 5: Test Product AI with Categories

### 5.1 Verify Category Context in Product AI

1. **Get Product with Categories**
   ```sql
   -- Find product with categories:
   SELECT 
     p.id,
     p.sku,
     p.name,
     COUNT(pcr.id) as category_count
   FROM shoprenter_products p
   LEFT JOIN shoprenter_product_category_relations pcr 
     ON pcr.product_id = p.id 
     AND pcr.deleted_at IS NULL
   WHERE p.deleted_at IS NULL
   GROUP BY p.id, p.sku, p.name
   HAVING COUNT(pcr.id) > 0
   LIMIT 1;
   ```

2. **Generate Product Description**
   - Go to `/products/[productId]` page
   - Click "AI Leírás generálása" button
   - Check if description includes internal links to categories

3. **Verify in Generated Description**
   - Look for `<a href="...">Category Name</a>` links
   - Links should be natural and contextual
   - Should link to category URLs

---

## Step 6: Test Helper Functions

### 6.1 Test via API (if you create test endpoints)

Or test directly in your code:

```typescript
// In a server component or API route:
import { 
  getCategoryById,
  getCategoriesForConnection,
  getProductsInCategory,
  getCategoryHierarchy
} from '@/lib/categories-server'

// Test getting category
const category = await getCategoryById(categoryId)

// Test getting categories for connection
const categories = await getCategoriesForConnection(connectionId)

// Test getting products in category
const products = await getProductsInCategory(categoryId)

// Test getting hierarchy
const hierarchy = await getCategoryHierarchy(categoryId)
```

---

## Step 7: Common Issues & Troubleshooting

### Issue: Sync Returns 401 Unauthorized
**Solution:**
- Make sure you're logged in
- Check if your session is valid
- Try logging out and back in

### Issue: Sync Returns 404 Connection Not Found
**Solution:**
- Verify connection ID is correct
- Check if connection exists in database
- Verify connection_type is 'shoprenter'

### Issue: Sync Progress Shows 0/0
**Solution:**
- Check ShopRenter API credentials
- Verify API URL is correct
- Check browser console for errors
- Verify rate limiting is working (should see delays)

### Issue: AI Generation Fails
**Solution:**
- Check ANTHROPIC_API_KEY is set in environment
- Verify category has products (if useProductData=true)
- Check browser console for error messages
- Verify category exists in database

### Issue: No Categories Synced
**Solution:**
- Check ShopRenter API response
- Verify categories exist in ShopRenter
- Check sync_error column in database:
  ```sql
  SELECT id, name, sync_status, sync_error 
  FROM shoprenter_categories 
  WHERE sync_status = 'error';
  ```

---

## Step 8: Performance Testing

### 8.1 Test Rate Limiting

1. **Monitor Request Rate**
   - Should see ~2.5 requests/second (400ms delays)
   - Check browser Network tab
   - Verify no 429 errors (rate limit exceeded)

2. **Test Large Sync**
   - Sync connection with many categories (100+)
   - Monitor progress
   - Check total time
   - Verify all categories synced

### 8.2 Test Batch Processing

1. **Verify Batch Size**
   - Check logs for batch size (should be 200)
   - Verify batch API is used
   - Check for batch errors

---

## Step 9: Database Verification Queries

### Check Sync Status
```sql
SELECT 
  sync_status,
  COUNT(*) as count
FROM shoprenter_categories
WHERE deleted_at IS NULL
GROUP BY sync_status;
```

### Check Categories with Descriptions
```sql
SELECT 
  c.id,
  c.name,
  COUNT(cd.id) as description_count
FROM shoprenter_categories c
LEFT JOIN shoprenter_category_descriptions cd ON cd.category_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name
ORDER BY description_count DESC;
```

### Check Product-Category Relations
```sql
SELECT 
  COUNT(*) as total_relations,
  COUNT(DISTINCT product_id) as unique_products,
  COUNT(DISTINCT category_id) as unique_categories
FROM shoprenter_product_category_relations
WHERE deleted_at IS NULL;
```

---

## Step 10: Next Steps After Testing

Once testing is successful:

1. ✅ **UI Implementation**
   - Create categories list page
   - Create category edit page
   - Add sync buttons to connections page

2. ✅ **Production Deployment**
   - Run migration on production
   - Test with production data
   - Monitor sync performance

3. ✅ **Documentation**
   - Document category management workflow
   - Create user guide for AI generation
   - Document API endpoints

---

## Quick Test Checklist

- [ ] Migration runs successfully
- [ ] Tables created correctly
- [ ] Bulk sync starts and completes
- [ ] Progress tracking works
- [ ] Single category sync works
- [ ] Categories appear in database
- [ ] Category descriptions synced
- [ ] Parent-child relationships work
- [ ] AI generation works
- [ ] Product AI includes category links
- [ ] Rate limiting respected (no 429 errors)
- [ ] Error handling works

---

## Test Data Requirements

For comprehensive testing, you need:

1. **ShopRenter Connection**
   - Valid API credentials
   - Connection with categories
   - Categories with products (for AI testing)

2. **User Account**
   - Authenticated user
   - Permission to `/categories` page (for management)

3. **Environment Variables**
   - `ANTHROPIC_API_KEY` (for AI generation)
   - Supabase credentials

---

## Need Help?

If you encounter issues:

1. Check browser console for errors
2. Check Supabase logs
3. Verify API credentials
4. Check database for sync errors
5. Review the implementation summary document

Good luck with testing! 🚀
