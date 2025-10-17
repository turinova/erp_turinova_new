# Decision: Create `media_files` Database Table for Image Metadata

**Date**: 2025-10-01  
**Status**: Accepted ✅  
**Deciders**: Development team  
**Tags**: #database #media #excel-integration

---

## Context

**Problem**: Need to track original filenames for material images to enable Excel import/export functionality.

**Current State**:
- Images uploaded to Supabase Storage (`materials` bucket)
- Supabase automatically renames files with UUIDs (e.g., `abc-123-def.webp`)
- Original filenames lost after upload
- Cannot match images by filename in Excel import

**Business Driver**:
- Users want to export/import materials with image associations
- Excel workflow requires human-readable filenames
- Need Media library page to show original filenames

**Constraints**:
- Cannot change Supabase Storage behavior (UUID renaming)
- Must maintain existing image URLs (no breaking changes)
- Need solution that works with current authentication setup

---

## Options Considered

### Option 1: Parse Filenames from Storage Paths
**Description**: Extract original filename from storage path or metadata

**Pros**:
- ✅ No database changes needed
- ✅ Simple implementation

**Cons**:
- ❌ Unreliable (Supabase may change naming convention)
- ❌ No way to store original filename if pattern changes
- ❌ Requires API call to storage for every image
- ❌ Poor performance (slow metadata fetch)

**Effort**: Low  
**Risk**: High (brittle, depends on Supabase internals)

---

### Option 2: Store Filenames in Material Records
**Description**: Add `original_image_filename` column to `materials` table

**Pros**:
- ✅ Simple schema change
- ✅ Filename lives with material data

**Cons**:
- ❌ Not centralized (one image used by multiple materials?)
- ❌ Duplicates data if same image reused
- ❌ Doesn't help Media library page (needs separate query)
- ❌ Tight coupling between materials and images

**Effort**: Low  
**Risk**: Medium (not scalable)

---

### Option 3: Create Dedicated `media_files` Table ← **CHOSEN**
**Description**: Track all uploaded images in separate database table

**Pros**:
- ✅ Single source of truth for all images
- ✅ Enables Media library page
- ✅ Centralized metadata (size, upload date, uploader)
- ✅ Supports image reuse across materials
- ✅ Future-proof (can add tags, categories, etc.)
- ✅ Clean separation of concerns

**Cons**:
- ❌ Requires database migration
- ❌ Two-phase upload (storage + database)
- ❌ Need to keep storage and database in sync

**Effort**: Medium  
**Risk**: Low (standard pattern)

---

## Decision

**We decided to**: Create a dedicated `media_files` table to track image metadata.

**Rationale**:
1. **Scalability**: Supports future features like image tagging, advanced search, usage tracking
2. **Data Integrity**: Single source of truth prevents inconsistencies
3. **Decoupling**: Images independent of materials (reusable)
4. **User Experience**: Enables Media library page with readable filenames
5. **Standard Pattern**: Common approach in file management systems

**Key factors**:
- **User Workflow**: Excel import requires original filenames
- **Future Features**: Media library page needs centralized image list
- **Maintainability**: Clear separation between storage and business logic

---

## Consequences

### What Becomes Easier
- ✅ Build Media library page (list all images)
- ✅ Excel import/export with filename matching
- ✅ Track image metadata (size, upload date)
- ✅ Reuse images across multiple materials
- ✅ Add advanced features (tags, categories, search)
- ✅ Monitor storage usage and cleanup unused files

### What Becomes Harder
- ⚠️ Two-phase upload process (storage → database)
- ⚠️ Need to maintain sync between storage and database
- ⚠️ Rollback complexity (delete from both on failure)
- ⚠️ Migration required for existing files

### Technical Debt
- None significant
- Migration endpoint can be removed after production migration

---

## Implementation

### Database Schema
```sql
CREATE TABLE media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX idx_media_files_original_filename ON media_files(original_filename);
CREATE INDEX idx_media_files_stored_filename ON media_files(stored_filename);
CREATE INDEX idx_media_files_uploaded_by ON media_files(uploaded_by);
```

### Files Changed
```
✅ NEW: create_media_files_table.sql
✅ NEW: src/app/api/media/route.ts (GET, DELETE)
✅ NEW: src/app/api/media/upload/route.ts (POST)
✅ NEW: src/app/api/media/migrate/route.ts (one-time migration)
✅ NEW: src/app/(dashboard)/media/page.tsx
✅ NEW: src/app/(dashboard)/media/MediaClient.tsx
✅ MODIFIED: src/app/api/materials/export/route.ts (add "Kép fájlnév" column)
✅ MODIFIED: src/app/api/materials/import/route.ts (validate filename, set image_url)
```

### Upload Flow
1. User selects .webp file
2. Frontend POSTs to `/api/media/upload`
3. API uploads to Supabase Storage (gets UUID filename)
4. API inserts record to `media_files` table
5. If database insert fails → delete from storage (rollback)
6. Return success response with file metadata

### Delete Flow
1. User selects files to delete
2. Frontend DELETEs to `/api/media` with `fileIds`
3. API fetches `storage_path` from database
4. API deletes from Supabase Storage
5. API deletes records from `media_files` table
6. Return success count

---

## References

### Related Decisions
- Future: Image optimization strategy
- Future: Storage quota management

### External Resources
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Next.js File Upload Best Practices](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#formdata)

### Chat Archive
- `docs/chat-archives/2025-10-01-media-library-implementation.md`

### Database Migration
- `create_media_files_table.sql`
- `migrate_existing_media_files.sql`

---

## Review & Updates

### When to Review
- [x] After 1 week - Validated in production ✅
- [ ] After 1 month
- [ ] Before adding image optimization features
- [ ] If storage costs become concern

### Update Log
- 2025-10-01: Initial decision and implementation
- 2025-10-01: SSR added to Media page for performance

---

**Created**: October 1, 2025  
**Last Updated**: October 1, 2025  
**Next Review**: November 1, 2025

