# Performance Testing Guide

**Date:** January 27, 2025  
**Purpose:** Test and validate performance optimizations for quote system  
**Status:** Ready for Testing  

---

## Changes Made

### Phase 1: Database Indexes ✅
**File:** `create_quote_performance_indexes.sql`

**New Indexes Created:**
1. Foreign key indexes (18 new indexes)
2. Breakdown table indexes (2 indexes)
3. Quote materials pricing index (1 index)

**Total:** 21 new indexes + ANALYZE on 7 tables

### Phase 2: Query Optimization ✅
**File:** `src/lib/supabase-server.ts`

**Changes:**
- Converted sequential queries to `Promise.all()` (6 queries in parallel)
- Before: Query 1 → wait → Query 2 → wait → Query 3... (waterfall)
- After: All 6 queries execute simultaneously (parallel)

**Expected Impact:**
- Before: ~10-1683ms (sum of all queries)
- After: ~3-200ms (max of slowest query)
- **Improvement: 60-80% faster**

---

## Testing Procedure

### Step 1: Run SQL Indexes (MANUAL)

1. Open Supabase SQL Editor
2. Copy contents of `create_quote_performance_indexes.sql`
3. Execute the SQL
4. Verify output shows all indexes created
5. Check for any errors

**Expected Output:**
```
CREATE INDEX
CREATE INDEX
...
(21 times)
ANALYZE
...
(verification query results)
```

---

### Step 2: Baseline Performance Test (BEFORE)

**Test Quote Detail Page:**

1. Open terminal and watch for `[PERF]` logs
2. Navigate to: `http://localhost:3002/quotes/3e822478-6c09-4f42-9390-01fcd611c656`
3. Note the timing logs:

```
[PERF] Quote DB Query: X.XXms
[PERF] Panels DB Query: X.XXms
[PERF] Pricing DB Query: X.XXms
[PERF] Fees DB Query: X.XXms
[PERF] Accessories DB Query: X.XXms
[PERF] Company DB Query: X.XXms
[PERF] Quote Fetch Total: X.XXms  ← RECORD THIS
```

4. Refresh page 3-5 times and average the total time
5. **Record baseline:** `Quote Fetch Total: _____ms (average)`

---

### Step 3: Performance Test (AFTER Optimization)

**After code changes are deployed:**

1. Navigate to same quote: `http://localhost:3002/quotes/3e822478-6c09-4f42-9390-01fcd611c656`
2. Look for new log line:
```
[SSR] Fetching quote {id} - OPTIMIZED
[PERF] Parallel Queries Complete: X.XXms  ← NEW LOG
[PERF] Quote data: OK
[PERF] Panels: X records
[PERF] Pricing: X records
[PERF] Fees: X records
[PERF] Accessories: X records
[PERF] Company: OK
[PERF] Quote Fetch Total: X.XXms (OPTIMIZED)  ← COMPARE THIS
```

3. Refresh 3-5 times and average
4. **Record optimized:** `Quote Fetch Total: _____ms (average)`

---

### Step 4: Calculate Improvement

```
Baseline:   _____ms (from Step 2)
Optimized:  _____ms (from Step 3)
Improvement: ((Baseline - Optimized) / Baseline) × 100 = _____%
```

**Expected Results:**
- If baseline was 100ms → optimized should be ~30-50ms (50-70% faster)
- If baseline was 500ms → optimized should be ~150-250ms (50-70% faster)
- If baseline was 1000ms → optimized should be ~300-500ms (50-70% faster)

---

### Step 5: Test Full User Flow

**Test the complete workflow:**

1. **Start:** Go to `/quotes`
   - Check load time
   - Should be fast (already optimized with pagination)

2. **Click on a quote:** Navigate to `/quotes/[id]`
   - Check load time (should be faster)
   - Verify all data loads correctly:
     - ✓ Company info displays
     - ✓ Customer & billing info displays
     - ✓ Materials table shows data
     - ✓ Services table shows data
     - ✓ Summary calculations correct
     - ✓ Fees table shows data (if any)
     - ✓ Accessories table shows data (if any)

3. **Click "Opti szerkesztés":** Navigate to `/opti?quote_id=[id]`
   - Check load time
   - Verify quote data loads:
     - ✓ Customer info pre-filled
     - ✓ Panels display in table
     - ✓ Materials pre-selected
     - ✓ Edge materials pre-selected

4. **Make changes and save:** Click "Árajánlat frissítése"
   - Check save time
   - Verify redirect works
   - Check load time of quote detail page after redirect

5. **Test Excel Export:** Click "Export Excel"
   - Check generation time
   - Verify file downloads
   - Open Excel and verify data

6. **Test Print:** Click "Nyomtatás"
   - Check print dialog opens
   - Verify 2-page layout
   - Check if layout is correct

---

## Performance Metrics to Track

### Quote Detail Page Load
```
Metric                      | Before | After | Improvement
----------------------------|--------|-------|------------
Total query time            | ___ms  | ___ms | ___%
Number of sequential queries| 6-7    | 0     | N/A
Number of parallel queries  | 0      | 6     | N/A
Page render time            | ___ms  | ___ms | ___%
```

### Opti Page Load (with quote_id)
```
Metric                      | Before | After | Improvement
----------------------------|--------|-------|------------
Total load time             | ___ms  | ___ms | ___%
getQuoteById() time         | ___ms  | ___ms | ___%
```

### Quote Save & Redirect
```
Metric                      | Before | After | Improvement
----------------------------|--------|-------|------------
Save API time               | ___ms  | ___ms | ___%
Redirect + reload time      | ___ms  | ___ms | ___%
Total roundtrip             | ___ms  | ___ms | ___%
```

---

## What to Look For

### Good Signs ✅
- "OPTIMIZED" appears in logs
- "Parallel Queries Complete" log shows
- Total time significantly reduced
- No errors in console
- All data displays correctly
- User experience feels snappier

### Bad Signs ❌
- Errors in console
- Missing data
- "OPTIMIZED" doesn't appear
- Total time unchanged or slower
- Data inconsistencies

---

## Troubleshooting

### If Performance Didn't Improve

1. **Check if indexes were created:**
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'quote_panels' 
   AND indexname LIKE 'idx_%';
   ```

2. **Check if ANALYZE ran:**
   ```sql
   SELECT last_analyze FROM pg_stat_user_tables 
   WHERE relname IN ('quote_panels', 'quote_materials_pricing', 'quotes');
   ```

3. **Check if optimized code is running:**
   - Look for "OPTIMIZED" in console logs
   - Look for "Parallel Queries Complete" log

### If Data is Missing

1. Check console for error logs
2. Verify all queries in Promise.all() are returning data
3. Check the individual `[PERF]` logs for each data type

### If Queries Are Still Sequential

1. Verify `Promise.all()` is being used (not `await` in sequence)
2. Check for any dependencies between queries
3. Restart development server

---

## Rollback Plan

### If Optimizations Cause Issues

**Rollback Code:**
```bash
# Restore original file
git checkout HEAD -- src/lib/supabase-server.ts
```

**Remove Indexes (if needed):**
```sql
-- Only if indexes cause issues (unlikely)
DROP INDEX IF EXISTS idx_quote_materials_pricing_quote_id;
DROP INDEX IF EXISTS idx_quote_edge_materials_breakdown_pricing_id;
DROP INDEX IF EXISTS idx_quote_services_breakdown_pricing_id;
-- ... (drop other new indexes)
```

---

## Success Criteria

### Must Pass (Critical)
- [  ] No errors in console
- [  ] All quote data displays correctly
- [  ] Fees and accessories load
- [  ] Materials and services show
- [  ] Summary calculations accurate
- [  ] Excel export works
- [  ] Print function works
- [  ] Quote save/update works

### Should Pass (Performance)
- [  ] Total query time reduced by >40%
- [  ] Page feels noticeably faster
- [  ] No regressions in functionality
- [  ] "OPTIMIZED" logs appear

### Nice to Have (Bonus)
- [  ] Improvement >60%
- [  ] Sub-100ms total query time
- [  ] Smooth navigation between pages

---

## Performance Comparison Table

Fill this in during testing:

| Test Scenario | Before (ms) | After (ms) | Improvement (%) |
|---------------|-------------|------------|-----------------|
| Quote detail load (small quote <5 panels) | | | |
| Quote detail load (medium quote 10-20 panels) | | | |
| Quote detail load (large quote >50 panels) | | | |
| Opti page load (new quote) | | | |
| Opti page load (edit existing) | | | |
| Quote save & redirect | | | |
| Excel export | | | |

---

## Next Steps After Testing

1. **If successful:** Commit changes to git
2. **If issues:** Debug and fix
3. **If marginal improvement:** Consider Phase 3 optimizations (caching)

---

## Notes

- The "unused index" warnings are OK - they'll be used after the queries run
- Some indexes may never be used (that's fine, they're for edge cases)
- ANALYZE updates query planner statistics (helps Postgres choose best execution plan)
- The parallel query optimization is the biggest win (60-80% improvement expected)

**Remember:** Real-world performance depends on:
- Network latency to Supabase
- Database server load
- Number of records in tables
- Complexity of individual queries

Always test with realistic data! 🚀

