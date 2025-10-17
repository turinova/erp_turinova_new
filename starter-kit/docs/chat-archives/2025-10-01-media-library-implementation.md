# Chat Archive - 2025-10-01: Media Library Implementation

## Session Overview
**Date:** October 1, 2025  
**Focus:** Media library page, SSR conversion, Excel import/export integration  
**Status:** ✅ Complete and deployed to GitHub

---

## Major Features Implemented

### 1. Media Library Page (`/media`)
- **Purpose**: Central hub for managing all material images
- **Location**: Under "Törzsadatok" menu
- **Features**:
  - List all uploaded images from `materials` bucket
  - Upload multiple .webp files (max 1 MB each)
  - Bulk delete functionality
  - Search by filename
  - Click image to view full-size in modal
  - Copy filename button for easy Excel integration

### 2. Database Schema: `media_files` Table
- **Problem**: Supabase Storage renames files with UUIDs, losing original filenames
- **Solution**: Track original filenames in database
- **Schema**:
  ```sql
  CREATE TABLE media_files (
    id UUID PRIMARY KEY,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL UNIQUE,
    storage_path TEXT NOT NULL,
    full_url TEXT NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    mimetype TEXT DEFAULT 'image/webp',
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

### 3. Media Library Modal Component
- **File**: `src/components/MediaLibraryModal.tsx`
- **Purpose**: Reusable image picker for material edit/new pages
- **Integration**: "Média könyvtárból választás" button on material pages
- **Features**:
  - Grid view of all images
  - Search functionality
  - Select and insert into material record
  - Works alongside existing drag & drop upload

### 4. Excel Import/Export Enhancement
- **Export**: Added "Kép fájlnév" column with original filename
- **Import**: 
  - Validates filename exists in `media_files` table
  - Auto-updates `image_url` if filename provided
  - Leaves existing image unchanged if column empty

### 5. SSR Conversion
- **Before**: Client-side fetch with loading spinner
- **After**: Server-side rendering via `getAllMediaFiles()`
- **Performance**: 3-220ms (SSR) vs 1000ms+ (client fetch)
- **Files Changed**:
  - `src/lib/supabase-server.ts` - Added `getAllMediaFiles()`
  - `src/app/(dashboard)/media/page.tsx` - Fetch data server-side
  - `src/app/(dashboard)/media/MediaClient.tsx` - Accept `initialMediaFiles` prop

---

## Technical Decisions

### Why Create `media_files` Table?
**Problem**: Supabase Storage automatically renames files with UUIDs (e.g., `abc-123-def.webp`), but Excel import needs original filenames.

**Options Considered**:
1. ❌ Parse filenames from storage paths (unreliable)
2. ❌ Store filenames in material records (not centralized)
3. ✅ **Create dedicated table** (single source of truth)

**Benefits**:
- Enables filename-based import matching
- Allows Media library page to show readable names
- Provides metadata (size, upload date, uploader)
- Future-proof for advanced features (tags, categories)

### Why Remove Migration Button?
- Migration was one-time operation to populate `media_files` from existing storage
- After successful migration (15 files), button is no longer needed
- Keeps UI clean and prevents accidental re-runs

### Why Copy Filename Instead of URL?
- Excel import matches by filename, not URL
- Easier workflow: copy filename → paste directly into Excel
- URL can be reconstructed from filename if needed

---

## API Endpoints Created

### `/api/media` (GET)
- Fetches from `media_files` table
- Returns: `id`, `name`, `storedName`, `path`, `fullUrl`, `size`, `created_at`, `updated_at`
- Used by: Media page (SSR), client-side refresh after upload/delete

### `/api/media` (DELETE)
- Accepts `fileIds` (array of UUIDs)
- Deletes from both Supabase Storage AND `media_files` table
- Returns success count

### `/api/media/upload` (POST)
- Uploads to `materials` bucket (`materials/` folder)
- Inserts record into `media_files` table
- Rollback if database insert fails
- Returns upload results (success count, failures)

### `/api/media/migrate` (POST)
- One-time migration from storage to database
- Lists all files in `materials/materials/` folder
- Extracts original filename from UUID-based storage name
- Inserts into `media_files` table
- Handles conflicts (skips existing)

---

## Files Modified

### New Files
1. `src/app/(dashboard)/media/page.tsx` - SSR wrapper
2. `src/app/(dashboard)/media/MediaClient.tsx` - UI component
3. `src/app/api/media/route.ts` - List & delete
4. `src/app/api/media/upload/route.ts` - Upload handler
5. `src/app/api/media/migrate/route.ts` - Migration endpoint
6. `src/components/MediaLibraryModal.tsx` - Reusable picker
7. `create_media_files_table.sql` - Database schema
8. `add_media_page.sql` - Permissions setup
9. `migrate_existing_media_files.sql` - Migration docs

### Modified Files
1. `src/data/navigation/verticalMenuData.tsx` - Added Media menu item
2. `src/hooks/useNavigation.ts` - Bypass permissions for `/media`
3. `src/hooks/useSimpleNavigation.ts` - Added `/media` to admin check
4. `src/app/(dashboard)/materials/[id]/edit/MaterialsEditClient.tsx` - Integrated MediaLibraryModal
5. `src/app/(dashboard)/materials/new/NewMaterialClient.tsx` - Integrated MediaLibraryModal
6. `src/app/api/materials/export/route.ts` - Added "Kép fájlnév" column
7. `src/app/api/materials/import/preview/route.ts` - Validate image filename
8. `src/app/api/materials/import/route.ts` - Set image_url from filename
9. `src/lib/supabase-server.ts` - Added `getAllMediaFiles()`

---

## Issues Encountered & Solutions

### Issue 1: HTML Nesting Error
**Error**: `<h6>` cannot be child of `<h2>` (DialogTitle contains Typography h6)
**Solution**: Remove Typography wrapper, use text directly in DialogTitle

### Issue 2: Hydration Mismatch
**Error**: "Média könyvtárból választás" button causing SSR/client mismatch
**Solution**: Wrap button in `{mounted && ...}` conditional

### Issue 3: Foreign Key Constraint
**Error**: `relation "users" does not exist` when creating `media_files` table
**Solution**: Remove `REFERENCES users(id)` from `uploaded_by` column

### Issue 4: Migration 401 Unauthorized
**Error**: `/api/media/migrate` failing with 401 when called from client
**Solution**: Remove `supabaseServer.auth.getUser()` call (permissions bypassed)

### Issue 5: Delete Not Working
**Error**: Files remaining in table after delete
**Solution**: Fix storage path (`materials/filename.webp` not `materials/materials/filename.webp`)

---

## Performance Metrics

### Media Page Load Times
- **SSR (current)**: 3-220ms
- **Client-side (before)**: 1000ms+
- **Improvement**: ~80% faster

### Database Query Performance
```
[PERF] Media Files DB Query: 2.54ms (fetched 15 records)
[PERF] Media Files Total: 2.69ms (returned 15 records)
[PERF] Media Page SSR: 2.77ms
```

---

## Git Commits

### Commit 1: `863cb85`
**Message**: "feat: Add Media library page with image management and integrate with materials"
**Changes**: 17 files (+1,303 insertions, -10 deletions)
**Includes**:
- Media page creation
- MediaLibraryModal component
- Excel import/export integration
- Price history tracking on import
- Hydration fixes
- Breadcrumb cleanup

### Commit 2: `4752191`
**Message**: "feat: Convert Media page to SSR for better performance"
**Changes**: 3 files (+51 insertions, -10 deletions)
**Includes**:
- `getAllMediaFiles()` in supabase-server.ts
- SSR data fetching in Media page.tsx
- Remove client-side useEffect

---

## Future Considerations

### Potential Enhancements
1. **Image Optimization**: Automatic resizing/compression on upload
2. **Batch Operations**: Tag multiple images, move to folders
3. **Advanced Search**: Filter by size, date, dimensions
4. **Image Metadata**: Store dimensions, color palette
5. **Usage Tracking**: Show which materials use each image
6. **Direct Upload**: Upload from material page → auto-add to Media library

### Database Migrations
- `media_files` table is production-ready
- Consider adding indexes if library grows beyond 1000 images
- Potential future columns: `tags`, `category`, `dimensions`, `usage_count`

---

## How to Use This System

### For Users
1. **Upload Images**: Go to `/media` → "Képek feltöltése" → Select .webp files
2. **Select for Material**: On material edit/new → "Média könyvtárból választás"
3. **Excel Import**: Copy filename from Media page → Paste into "Kép fájlnév" column

### For Developers
1. **Add to Material**: Use `MediaLibraryModal` component
2. **Access Files**: Query `media_files` table or use `getAllMediaFiles()`
3. **Upload New**: POST to `/api/media/upload` with FormData
4. **Delete**: DELETE to `/api/media` with `fileIds` array

---

## Related Documentation
- `development_documentation/SUPABASE_FILES_INDEX.md` - Supabase file structure
- `development_documentation/NEW_PAGE_GENERATION.md` - Page creation guide
- `create_media_files_table.sql` - Database schema
- `add_media_page.sql` - Permissions setup

---

## Notes
- Permissions currently bypassed (same as `/materials` page)
- When permission system is re-enabled, run `add_media_page.sql`
- Migration endpoint can be removed in future cleanup
- All images must be .webp format, max 1 MB

