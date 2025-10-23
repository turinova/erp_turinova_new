# Comment System Documentation

## Overview

The Comment System allows users to add internal notes/comments to quotes and orders. This feature is available in both the **Main Application** (for admins) and the **Customer Portal** (for customers), with comments seamlessly synced when a customer submits a quote.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Main Application](#main-application)
4. [Customer Portal](#customer-portal)
5. [Comment Synchronization](#comment-synchronization)
6. [API Endpoints](#api-endpoints)
7. [User Interface](#user-interface)
8. [Security & Access Control](#security--access-control)
9. [Validation Rules](#validation-rules)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER PORTAL                              │
│                                                                   │
│  1. Customer creates quote with comment                          │
│  2. Comment stored in portal_quotes.comment                      │
│  3. Customer clicks "Megrendelés" (Submit)                       │
│  4. Comment copied to company DB quotes.comment                  │
│                                                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MAIN APPLICATION                             │
│                                                                   │
│  5. Admin sees quote with customer's comment                     │
│  6. Admin can edit comment                                       │
│  7. Comment visible throughout quote lifecycle                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

- ✅ **250 character limit** enforced in both apps
- ✅ **Plain text only** (no formatting)
- ✅ **Line breaks preserved** in display
- ✅ **Real-time validation** with character counter
- ✅ **Access control** based on user permissions
- ✅ **Status-based editing** (draft = editable, submitted/ready/finished = read-only)
- ✅ **Automatic sync** from customer portal to main app

---

## Database Schema

### Main App: `quotes` Table

```sql
-- quotes table already exists, just add comment field
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS comment text NULL;

-- Optional index for search functionality
CREATE INDEX IF NOT EXISTS idx_quotes_comment 
ON public.quotes USING btree (comment) 
TABLESPACE pg_default
WHERE (comment IS NOT NULL AND deleted_at IS NULL);

-- Add column documentation
COMMENT ON COLUMN public.quotes.comment IS 
  'Internal comment/note for the quote or order (max 250 characters enforced in app)';
```

### Customer Portal: `portal_quotes` Table

```sql
-- portal_quotes table already exists, just add comment field
ALTER TABLE public.portal_quotes 
ADD COLUMN IF NOT EXISTS comment text NULL;

-- Optional index for search functionality
CREATE INDEX IF NOT EXISTS idx_portal_quotes_comment 
ON public.portal_quotes USING btree (comment) 
TABLESPACE pg_default
WHERE (comment IS NOT NULL);

-- Add column documentation
COMMENT ON COLUMN public.portal_quotes.comment IS 
  'Customer comment/note for the quote (max 250 characters enforced in app)';
```

### Field Specifications

| Property | Value |
|----------|-------|
| **Field Name** | `comment` |
| **Data Type** | `text` |
| **Nullable** | `YES` |
| **Default** | `NULL` |
| **Max Length** | 250 characters (enforced in application) |
| **Encoding** | UTF-8 |
| **Line Breaks** | Allowed (preserved in display) |

---

## Main Application

### File Structure

```
main-app/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   └── quotes/
│   │   │       └── [quote_id]/
│   │   │           ├── QuoteDetailClient.tsx   # Main quote detail component
│   │   │           └── CommentModal.tsx        # Comment edit modal
│   │   └── api/
│   │       └── quotes/
│   │           └── [id]/
│   │               └── comment/
│   │                   └── route.ts            # API endpoint for comment CRUD
│   └── lib/
│       └── supabase-server.ts                  # SSR data fetching
└── supabase/
    └── migrations/
        └── 20251023_add_comment_to_quotes.sql  # Database migration
```

### Implementation Details

#### 1. Data Fetching (SSR)

**File**: `main-app/src/lib/supabase-server.ts`

```typescript
export async function getQuoteById(quoteId: string) {
  // ... existing code ...
  
  const { data: quote } = await supabaseServer
    .from('quotes')
    .select(`
      id,
      quote_number,
      // ... other fields ...
      comment,  // ✅ Added
      // ... rest of fields ...
    `)
    .eq('id', quoteId)
    .single()
  
  // ... rest of function ...
  
  return {
    // ... other fields ...
    comment: quote.comment || null,  // ✅ Added
    // ... rest of fields ...
  }
}
```

#### 2. API Endpoint

**File**: `main-app/src/app/api/quotes/[id]/comment/route.ts`

**Endpoint**: `PATCH /api/quotes/[id]/comment`

**Request Body**:
```json
{
  "comment": "This is a comment (max 250 chars)"
}
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Megjegyzés sikeresen mentve"
}
```

**Response** (Error):
```json
{
  "error": "A megjegyzés maximum 250 karakter lehet"
}
```

**Security**:
- ✅ User must be authenticated
- ✅ All users can edit comments (no restriction)
- ✅ No status-based restriction on API level (enforced in UI)

#### 3. User Interface

**Location**: Quote Detail Page → Right Sidebar → Below "Kedvezmény" button

**Button States**:

| Quote Status | Button State | Reason |
|--------------|--------------|--------|
| `draft` | ✅ Enabled | Editable |
| `ordered` | ✅ Enabled | Editable |
| `in_production` | ✅ Enabled | Editable |
| `ready` | 🔒 Disabled | Production finished |
| `finished` | 🔒 Disabled | Order completed |
| `cancelled` | ✅ Enabled | Editable |

**Comment Button**:
```tsx
<Button
  variant="outlined"
  color="primary"
  startIcon={<EditIcon />}
  onClick={handleEditComment}
  fullWidth
  disabled={isOrderView && ['ready', 'finished'].includes(quoteData.status)}
>
  Megjegyzés {isOrderView && ['ready', 'finished'].includes(quoteData.status) && '🔒'}
</Button>
```

**Comment Display Card**:
- **Location**: Before "Szabásjegyzék" (Cutting List) section
- **Visibility**: Only shown if comment exists (non-empty)
- **Layout**: Card with grey background for distinction

```tsx
{quoteData.comment && (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Megjegyzés
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="body2">
          {quoteData.comment}
        </Typography>
      </Paper>
    </CardContent>
  </Card>
)}
```

#### 4. Comment Modal

**Features**:
- ✅ Multiline textarea (6 rows)
- ✅ Live character counter: `125/250`
- ✅ Red warning when over limit
- ✅ Save button disabled when over limit
- ✅ Auto-focus on textarea when opened
- ✅ Shows existing comment for editing
- ✅ Empty comment = delete (stores NULL)

**Modal Layout**:
```
┌────────────────────────────────────┐
│ Megjegyzés                          │
│ Q-2025-029                          │
├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │
│ │ [Textarea 6 rows]              │ │
│ │                                │ │
│ │                                │ │
│ └────────────────────────────────┘ │
│                                     │
│ Maximum 250 karakter      125/250  │
├────────────────────────────────────┤
│            [Mégse]  [Mentés]       │
└────────────────────────────────────┘
```

---

## Customer Portal

### File Structure

```
customer-portal/
├── app/
│   ├── (dashboard)/
│   │   └── saved/
│   │       └── [quote_id]/
│   │           ├── PortalQuoteDetailClient.tsx   # Main quote detail component
│   │           └── CommentModal.tsx              # Comment edit modal (copied from main app)
│   └── api/
│       └── portal-quotes/
│           ├── [id]/
│           │   └── comment/
│           │       └── route.ts                  # API endpoint for comment CRUD
│           └── submit/
│               └── route.ts                      # Quote submission (copies comment)
├── lib/
│   └── supabase-server.ts                        # SSR data fetching
└── supabase/
    └── migrations/
        └── add_comment_to_portal_quotes.sql      # Database migration
```

### Implementation Details

#### 1. Data Fetching (SSR)

**File**: `customer-portal/lib/supabase-server.ts`

```typescript
export async function getPortalQuoteById(quoteId: string) {
  // ... existing code ...
  
  const { data: quote } = await supabase
    .from('portal_quotes')
    .select(`
      id,
      quote_number,
      // ... other fields ...
      comment,  // ✅ Added
      // ... rest of fields ...
    `)
    .eq('id', quoteId)
    .eq('portal_customer_id', user.id)  // Security: only own quotes
    .single()
  
  // ... rest of function ...
  
  return {
    ...quote,  // Automatically includes comment field
    panels: enrichedPanels,
    pricing: pricing || []
  }
}
```

#### 2. API Endpoint

**File**: `customer-portal/app/api/portal-quotes/[id]/comment/route.ts`

**Endpoint**: `PATCH /api/portal-quotes/[id]/comment`

**Request Body**:
```json
{
  "comment": "This is a customer comment"
}
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Megjegyzés sikeresen mentve"
}
```

**Response** (Error - Not Draft):
```json
{
  "error": "Csak piszkozat státuszú árajánlathoz lehet megjegyzést hozzáadni"
}
```

**Security Checks**:
1. ✅ User must be authenticated
2. ✅ Quote must belong to user (`portal_customer_id = auth.uid()`)
3. ✅ Quote must be in `draft` status
4. ✅ 250 character limit enforced

#### 3. User Interface

**Location**: Quote Detail Page → Right Sidebar → Below "Opti szerkesztés" button

**Button States**:

| Quote Status | Button State | Reason |
|--------------|--------------|--------|
| `draft` | ✅ Enabled | Customer can edit |
| `submitted` | 🔒 Disabled | Already sent to company |

**Comment Button**:
```tsx
<Button
  variant="outlined"
  color="primary"
  startIcon={<EditIcon />}
  onClick={handleEditComment}
  disabled={quoteData.status !== 'draft'}
  fullWidth
>
  Megjegyzés {quoteData.status === 'submitted' && '🔒'}
</Button>
```

**Comment Display Card**:
- **Location**: Before "Szabásjegyzék" (Cutting List) section
- **Visibility**: Only shown if comment exists
- **Same layout** as main app

#### 4. Differences from Main App

| Aspect | Main App | Customer Portal |
|--------|----------|-----------------|
| **API Path** | `/api/quotes/[id]/comment` | `/api/portal-quotes/[id]/comment` |
| **Table** | `quotes` | `portal_quotes` |
| **Auth** | Any authenticated user | Must own the quote |
| **Editable When** | Not `ready` or `finished` | Only `draft` status |
| **Security** | Basic auth check | Quote ownership + status check |

---

## Comment Synchronization

### How Comments Transfer from Portal to Main App

**Flow**:

```
1. Customer Portal (Draft Quote)
   ↓
   Customer adds comment: "Please use extra padding"
   ↓
   Comment stored in: portal_quotes.comment
   ↓
2. Customer Clicks "Megrendelés" (Submit)
   ↓
   API: /api/portal-quotes/submit
   ↓
3. Quote Created in Company Database
   ↓
   quotes.comment = portal_quotes.comment  ← SYNC HERE
   ↓
4. Main App
   ↓
   Admin sees comment on quote detail page
```

### Implementation

**File**: `customer-portal/app/api/portal-quotes/submit/route.ts`

```typescript
// Step 5: Create quote in company database
const { data: companyQuote } = await companySupabase
  .from('quotes')
  .insert([{
    customer_id: companyCustomerId,
    quote_number: companyQuoteNumber,
    status: 'draft',
    source: 'customer_portal',
    comment: portalQuote.comment || null,  // ✅ COPY COMMENT
    total_net: portalQuote.total_net,
    // ... rest of fields ...
    created_by: CUSTOMER_PORTAL_SYSTEM_USER_ID
  }])
  .select('id, quote_number')
  .single()
```

### Key Points

- ✅ Comment is copied **exactly as-is** (no modification)
- ✅ If no comment exists, `NULL` is stored
- ✅ After submission, customer portal comment becomes **read-only**
- ✅ Main app can still edit the comment after receiving it
- ✅ Changes in main app **do not sync back** to customer portal

---

## API Endpoints

### Main App API

#### PATCH `/api/quotes/[id]/comment`

**Purpose**: Update comment for a quote in main app

**Authentication**: Required (any authenticated user)

**Request Headers**:
```
Content-Type: application/json
Cookie: sb-access-token=...
```

**Request Body**:
```json
{
  "comment": "String up to 250 characters or null"
}
```

**Response Codes**:
- `200 OK`: Comment updated successfully
- `400 Bad Request`: Comment exceeds 250 characters
- `401 Unauthorized`: User not authenticated
- `404 Not Found`: Quote not found or deleted
- `500 Internal Server Error`: Database error

**Example Request**:
```javascript
const response = await fetch('/api/quotes/abc-123/comment', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    comment: 'Customer requested express delivery'
  })
})
```

---

### Customer Portal API

#### PATCH `/api/portal-quotes/[id]/comment`

**Purpose**: Update comment for a portal quote

**Authentication**: Required (portal customer)

**Additional Security**:
- Must own the quote (`portal_customer_id = auth.uid()`)
- Quote must be in `draft` status

**Request Headers**:
```
Content-Type: application/json
Cookie: sb-access-token=...
```

**Request Body**:
```json
{
  "comment": "String up to 250 characters or null"
}
```

**Response Codes**:
- `200 OK`: Comment updated successfully
- `400 Bad Request`: Comment exceeds 250 characters
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: Quote is not in draft status
- `404 Not Found`: Quote not found or not owned by user
- `500 Internal Server Error`: Database error

**Example Request**:
```javascript
const response = await fetch('/api/portal-quotes/xyz-789/comment', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    comment: 'Please call before delivery'
  })
})
```

---

## User Interface

### Main App UI Components

#### 1. Comment Button

**Location**: Quote Detail Page → Right Sidebar → Below "Kedvezmény" button

**Visual Design**:
- **Style**: Outlined button with primary color
- **Icon**: Edit icon (pencil)
- **Full Width**: Yes
- **Spacing**: 1rem margin bottom

**States**:
```tsx
// Enabled (default)
<Button variant="outlined" color="primary">
  Megjegyzés
</Button>

// Disabled (ready/finished status)
<Button variant="outlined" color="primary" disabled>
  Megjegyzés 🔒
</Button>
```

**Tooltip** (when disabled):
```
A megjegyzés nem szerkeszthető, ha a megrendelés készen van vagy lezárva
```

#### 2. Comment Display Card

**Location**: Before "Szabásjegyzék" section in main content area

**Visual Design**:
- **Container**: Material-UI Card with default elevation
- **Title**: "Megjegyzés" (h6 variant)
- **Content Background**: Grey (#f5f5f5)
- **Border**: 1px outlined
- **Padding**: 16px (2 spacing units)

**Conditional Rendering**:
```tsx
{quoteData.comment && (
  <Card sx={{ mb: 3 }}>
    {/* Card content */}
  </Card>
)}
```

**Hidden when**:
- Comment is `null`
- Comment is empty string `""`
- Comment is only whitespace

#### 3. Comment Modal

**Dimensions**:
- **Max Width**: `sm` (600px)
- **Full Width**: Yes
- **Border Radius**: 2 spacing units (16px)

**Content**:

**Header**:
```
┌────────────────────────────────────┐
│ Megjegyzés                   [X]    │  ← DialogTitle
│ Q-2025-029                          │  ← Quote number (caption)
└────────────────────────────────────┘
```

**Body**:
```
┌────────────────────────────────────┐
│ ┌────────────────────────────────┐ │
│ │ [6-row textarea]               │ │
│ │ Placeholder: "Írj megjegyzést │ │
│ │ az árajánlathoz..."            │ │
│ └────────────────────────────────┘ │
│                                     │
│ Maximum 250 karakter      125/250  │  ← Character counter
└────────────────────────────────────┘
```

**Footer**:
```
┌────────────────────────────────────┐
│              [Mégse]  [Mentés]      │  ← Actions
└────────────────────────────────────┘
```

**Character Counter Colors**:
- **0-140 chars**: Normal grey text
- **141-160 chars**: Warning (optional, currently same)
- **161+ chars**: Error red, Save button disabled

---

### Customer Portal UI Components

#### Differences from Main App

| Component | Main App | Customer Portal |
|-----------|----------|-----------------|
| **Button Tooltip** | "...ha készen van vagy lezárva" | "...csak piszkozat státuszban szerkeszthető" |
| **Textarea Placeholder** | "...árajánlathoz/megrendeléshez..." | "...árajánlathoz..." |
| **Console Log Prefix** | `[MODAL]` / `[CLIENT]` | `[PORTAL MODAL]` / `[PORTAL CLIENT]` |

**Everything else is identical** (same design, same behavior, same validation)

---

## Security & Access Control

### Main App Security

#### Authentication
- ✅ All users must be authenticated via Supabase Auth
- ✅ Session validated via `supabase.auth.getUser()`

#### Authorization
- ✅ **No role-based restrictions** - all authenticated users can edit comments
- ✅ Comments can be edited on quotes in any status (enforced in UI, not API)
- ✅ No ownership checks - any user can edit any quote's comment

#### RLS (Row Level Security)
- Existing RLS policies on `quotes` table apply
- Comment field covered by existing UPDATE policies
- No special RLS policy needed for comment field

---

### Customer Portal Security

#### Authentication
- ✅ Portal customers must be authenticated via Supabase Auth
- ✅ Session validated via `supabase.auth.getUser()`

#### Authorization Layers

**1. Quote Ownership**:
```typescript
.eq('portal_customer_id', user.id)  // Must own the quote
```

**2. Status Check**:
```typescript
if (existingQuote.status !== 'draft') {
  return NextResponse.json({ error: '...' }, { status: 403 })
}
```

**3. Double Security in Update**:
```typescript
.update({ comment })
.eq('id', quoteId)
.eq('portal_customer_id', user.id)  // Extra security check
```

#### RLS (Row Level Security)
- Existing RLS policies on `portal_quotes` table apply:
  ```sql
  -- Customers can update their own quotes
  CREATE POLICY "Portal customers can update their own quotes"
  ON portal_quotes
  FOR UPDATE
  TO authenticated
  USING (portal_customer_id = auth.uid())
  WITH CHECK (portal_customer_id = auth.uid());
  ```

---

## Validation Rules

### Character Limit

**Maximum**: 250 characters

**Enforcement**:
1. ✅ Client-side (real-time) - Save button disabled
2. ✅ Server-side (API) - Returns 400 error
3. ✅ Visual feedback - Character counter turns red

**Validation Code**:
```typescript
if (comment !== null && typeof comment === 'string' && comment.length > 250) {
  return NextResponse.json(
    { error: 'A megjegyzés maximum 250 karakter lehet' },
    { status: 400 }
  )
}
```

### Content Restrictions

**Allowed**:
- ✅ Any UTF-8 characters (including Hungarian: á, é, ó, ö, ő, ú, ü, ű)
- ✅ Line breaks (`\n`)
- ✅ Special characters (!, @, #, etc.)
- ✅ Numbers and symbols
- ✅ Emoji (counts as multiple characters)

**Not Allowed**:
- ❌ HTML tags (stored as plain text)
- ❌ Rich text formatting
- ❌ Images or attachments

**Sanitization**:
- No sanitization performed (plain text only)
- Stored exactly as entered
- Displayed with `whiteSpace: 'pre-wrap'` to preserve line breaks

### Empty Comment Handling

**Empty String** (`""`):
- Converted to `NULL` before storing
- Removes comment completely

**NULL**:
- Comment field is optional (nullable)
- `NULL` = no comment exists

**Whitespace Only** (e.g., `"   "`):
- Stored as-is (not trimmed)
- Still counts toward 250 char limit

---

## Testing

### Test Checklist

#### Main App Testing

**1. Comment Creation**:
- [ ] Open quote detail page (draft status)
- [ ] Click "Megjegyzés" button
- [ ] Modal opens with empty textarea
- [ ] Type 125 characters
- [ ] Character counter shows "125/250"
- [ ] Click "Mentés"
- [ ] Success toast: "Megjegyzés sikeresen mentve"
- [ ] Page refreshes
- [ ] Comment card appears before cutting list

**2. Comment Editing**:
- [ ] Click "Megjegyzés" button again
- [ ] Modal shows existing comment
- [ ] Modify comment
- [ ] Save
- [ ] Comment card updates

**3. Character Limit Validation**:
- [ ] Type exactly 250 characters → counter shows "250/250" (green/normal)
- [ ] Type 251 characters → counter shows "251/250" (red), button disabled
- [ ] Delete one character → button re-enables

**4. Comment Deletion**:
- [ ] Open modal
- [ ] Delete all text (empty)
- [ ] Save
- [ ] Comment card disappears

**5. Button States**:
- [ ] Draft quote → button enabled
- [ ] Ordered quote → button enabled
- [ ] In production quote → button enabled
- [ ] Ready quote → button disabled with 🔒
- [ ] Finished quote → button disabled with 🔒

**6. Line Breaks**:
- [ ] Add comment with multiple lines
- [ ] Save
- [ ] Comment card preserves line breaks

**7. Special Characters**:
- [ ] Add comment with Hungarian chars: "Ügyfél kérése: éáőű"
- [ ] Save
- [ ] Characters display correctly

---

#### Customer Portal Testing

**1. Comment Creation (Draft)**:
- [ ] Open portal quote (draft status)
- [ ] Click "Megjegyzés" button
- [ ] Add comment
- [ ] Save successfully
- [ ] Comment displays on page

**2. Button Disabled After Submission**:
- [ ] Quote in draft → button enabled
- [ ] Submit quote (Megrendelés)
- [ ] Button shows 🔒 and is disabled
- [ ] Cannot click button

**3. Security - Other User's Quote**:
- [ ] Try to access another customer's quote URL
- [ ] Should show error or redirect
- [ ] Cannot view/edit other customer's comments

**4. Security - Edit Submitted Quote**:
- [ ] Try API call to edit submitted quote comment
- [ ] Should return 403 Forbidden error

**5. Comment Sync to Main App**:
- [ ] Customer creates draft quote
- [ ] Add comment: "Test comment for sync"
- [ ] Submit quote
- [ ] Log into main app
- [ ] Find submitted quote
- [ ] Verify comment is visible
- [ ] Verify comment is editable in main app

---

### Automated Testing

#### API Endpoint Tests

**Main App** (`/api/quotes/[id]/comment`):

```typescript
describe('PATCH /api/quotes/[id]/comment', () => {
  test('should update comment successfully', async () => {
    const response = await fetch('/api/quotes/test-id/comment', {
      method: 'PATCH',
      body: JSON.stringify({ comment: 'Test comment' })
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'Megjegyzés sikeresen mentve'
    })
  })

  test('should reject comment over 250 chars', async () => {
    const longComment = 'a'.repeat(251)
    const response = await fetch('/api/quotes/test-id/comment', {
      method: 'PATCH',
      body: JSON.stringify({ comment: longComment })
    })
    expect(response.status).toBe(400)
  })

  test('should require authentication', async () => {
    // Without auth token
    const response = await fetch('/api/quotes/test-id/comment', {
      method: 'PATCH',
      body: JSON.stringify({ comment: 'Test' })
    })
    expect(response.status).toBe(401)
  })
})
```

**Customer Portal** (`/api/portal-quotes/[id]/comment`):

```typescript
describe('PATCH /api/portal-quotes/[id]/comment', () => {
  test('should update comment for draft quote', async () => {
    const response = await fetch('/api/portal-quotes/test-id/comment', {
      method: 'PATCH',
      body: JSON.stringify({ comment: 'Test' })
    })
    expect(response.status).toBe(200)
  })

  test('should reject comment for submitted quote', async () => {
    // Quote with status='submitted'
    const response = await fetch('/api/portal-quotes/submitted-id/comment', {
      method: 'PATCH',
      body: JSON.stringify({ comment: 'Test' })
    })
    expect(response.status).toBe(403)
  })

  test('should reject comment for other user\'s quote', async () => {
    // Quote owned by different user
    const response = await fetch('/api/portal-quotes/other-user-id/comment', {
      method: 'PATCH',
      body: JSON.stringify({ comment: 'Test' })
    })
    expect(response.status).toBe(404)
  })
})
```

---

## Troubleshooting

### Common Issues

#### Issue 1: "Quote not found or access denied" Error

**Symptoms**:
```
[Customer Portal SSR] Quote not found or access denied: {}
```

**Causes**:
1. Database migration not run (comment column doesn't exist)
2. User trying to access another customer's quote
3. Quote ID is invalid

**Solutions**:
```sql
-- 1. Run migration
ALTER TABLE public.portal_quotes 
ADD COLUMN IF NOT EXISTS comment text NULL;

-- 2. Verify quote ownership
SELECT id, portal_customer_id, comment 
FROM portal_quotes 
WHERE id = 'your-quote-id';

-- 3. Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'portal_quotes';
```

---

#### Issue 2: Comment Not Saving

**Symptoms**:
- Click "Mentés" (Save)
- Success toast appears
- But comment not in database

**Causes**:
1. Route file in wrong directory (`[quote_id]` instead of `[id]`)
2. RLS policy blocking update
3. Database connection error

**Solutions**:

**Check route file location**:
```bash
# Main app - MUST be in [id] directory
main-app/src/app/api/quotes/[id]/comment/route.ts  ✅

# Customer portal - MUST be in [id] directory
customer-portal/app/api/portal-quotes/[id]/comment/route.ts  ✅
```

**Check server logs**:
```bash
# Look for these logs
[COMMENT API] Updating quote: abc-123
[COMMENT API] Update result - data: [...]
[COMMENT API] Update result - error: null
```

**Verify RLS**:
```sql
-- Test update permission
UPDATE quotes 
SET comment = 'Test' 
WHERE id = 'your-quote-id';
```

---

#### Issue 3: Button Not Disabling for Ready/Finished Status

**Symptoms**:
- Quote status is "ready"
- "Megjegyzés" button still enabled

**Cause**:
- Missing `isOrderView` check or incorrect status check

**Solution**:
```typescript
// Main app - correct implementation
disabled={isOrderView && ['ready', 'finished'].includes(quoteData.status)}

// Customer portal - correct implementation
disabled={quoteData.status !== 'draft'}
```

---

#### Issue 4: Character Counter Not Updating

**Symptoms**:
- Type in textarea
- Counter stays at "0/250"

**Cause**:
- State not updating correctly

**Solution**:
```typescript
// Verify state is set up correctly
const [comment, setComment] = useState(initialComment || '')

// Verify onChange handler
<TextField
  value={comment}
  onChange={(e) => setComment(e.target.value)}
/>

// Verify counter calculation
const charCount = comment.length
```

---

#### Issue 5: Comment Not Syncing from Portal to Main App

**Symptoms**:
- Customer adds comment in portal
- Submits quote
- Comment not visible in main app

**Cause**:
- Submit API not copying comment field

**Solution**:
```typescript
// File: customer-portal/app/api/portal-quotes/submit/route.ts
// Line ~206

.insert([{
  customer_id: companyCustomerId,
  quote_number: companyQuoteNumber,
  status: 'draft',
  source: 'customer_portal',
  comment: portalQuote.comment || null,  // ✅ MUST INCLUDE THIS
  total_net: portalQuote.total_net,
  // ... rest
}])
```

**Verify**:
```sql
-- Check portal quote has comment
SELECT id, quote_number, comment 
FROM portal_quotes 
WHERE id = 'portal-quote-id';

-- Check company quote received comment
SELECT id, quote_number, comment, source 
FROM quotes 
WHERE source = 'customer_portal' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

#### Issue 6: HTML/XSS in Comments

**Symptoms**:
- User enters `<script>alert('XSS')</script>`
- Script executes or shows as HTML

**Cause**:
- Improper rendering (using `dangerouslySetInnerHTML`)

**Solution**:
```typescript
// ✅ CORRECT - Renders as plain text
<Typography variant="body2">
  {quoteData.comment}
</Typography>

// ❌ WRONG - Would execute HTML
<Typography 
  dangerouslySetInnerHTML={{ __html: quoteData.comment }}
/>
```

---

### Debug Mode

Enable detailed logging for troubleshooting:

**Client Side** (Browser Console):
```javascript
// Look for these log prefixes
[MODAL]         // CommentModal component
[CLIENT]        // Main app client
[PORTAL MODAL]  // Customer portal modal
[PORTAL CLIENT] // Customer portal client
```

**Server Side** (Terminal):
```javascript
// Look for these log prefixes
[COMMENT API]        // Main app API
[PORTAL COMMENT API] // Customer portal API
[Portal Quote Submit] // Quote submission
```

**Enable full logging**:
```typescript
// Add to API route
console.log('[COMMENT API] Request body:', body)
console.log('[COMMENT API] User:', user)
console.log('[COMMENT API] Quote ID:', quote_id)
console.log('[COMMENT API] Update data:', { comment, updated_at })
console.log('[COMMENT API] Result:', { data, error })
```

---

## Best Practices

### For Developers

1. **Always use `[id]` for API routes**, not `[quote_id]`
   - Next.js matches routes by directory name
   - Using wrong name causes 404 errors

2. **Include `comment` in all SELECT queries**
   - Main app: `getQuoteById`
   - Customer portal: `getPortalQuoteById`

3. **Handle NULL values gracefully**
   ```typescript
   comment: quote.comment || null  // Not undefined
   ```

4. **Use consistent logging prefixes**
   - Makes debugging much easier
   - Clearly identifies source of logs

5. **Test character counter edge cases**
   - Exactly 250 chars
   - 251 chars (should disable button)
   - Empty string
   - Only whitespace

### For Users

1. **Keep comments concise**
   - 250 characters is roughly 2-3 sentences
   - Focus on essential information

2. **Use line breaks for clarity**
   - Separate different points
   - Makes long comments easier to read

3. **Avoid special formatting**
   - No bold, italics, etc.
   - Plain text only

4. **Update comments as needed**
   - Comments are editable (except after certain statuses)
   - Keep information current

---

## Migration Guide

### Adding Comment to Existing System

**Step 1: Backup Database**
```sql
-- Main app
pg_dump -U postgres -d your_main_db > backup_main.sql

-- Customer portal
pg_dump -U postgres -d your_portal_db > backup_portal.sql
```

**Step 2: Run Migrations**
```sql
-- Main app (run on company database)
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS comment text NULL;

-- Customer portal (run on portal database)
ALTER TABLE public.portal_quotes 
ADD COLUMN IF NOT EXISTS comment text NULL;
```

**Step 3: Deploy Code**
```bash
# Deploy main app
cd main-app && npm run build && vercel --prod

# Deploy customer portal
cd customer-portal && npm run build && vercel --prod
```

**Step 4: Verify**
```sql
-- Check column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quotes' AND column_name = 'comment';

-- Test insert
UPDATE quotes SET comment = 'Test comment' WHERE id = 'test-id';
SELECT comment FROM quotes WHERE id = 'test-id';
```

---

## Conclusion

The Comment System provides a simple yet powerful way for users to add contextual notes to quotes and orders. With seamless synchronization between the customer portal and main application, proper validation, and robust security, it enhances communication and record-keeping throughout the quote-to-order lifecycle.

### Key Takeaways

✅ **Simple Integration** - Single text field, no complex schema  
✅ **Secure by Design** - Proper authentication and authorization  
✅ **User-Friendly** - Intuitive UI with real-time validation  
✅ **Seamless Sync** - Automatic transfer from portal to main app  
✅ **Status-Aware** - Respects quote lifecycle and editing permissions  

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-23  
**Author**: Development Team  
**Related Documentation**:
- [SMS Notification System](./SMS_NOTIFICATION_SYSTEM.md)
- [Customer Portal Guide](./CUSTOMER_PORTAL.md)
- [Main App User Guide](./MAIN_APP.md)

