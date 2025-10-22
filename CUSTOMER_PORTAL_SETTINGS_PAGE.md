# Customer Portal - Settings Page Implementation

## 🎯 Overview
Created a comprehensive settings page where customers can edit their profile information, billing details, company selection, and change their password - matching the main app's `/company` page design exactly.

---

## 📁 Files Created

### 1. **Server Component**
- **Path**: `/customer-portal/app/(dashboard)/settings/page.tsx`
- **Type**: Server-side rendered (SSR)
- **Purpose**: Fetches customer data and companies on the server, passes to client component

**Key Features**:
- Fetches current user from Supabase Auth
- Fetches `portal_customers` record by user ID
- Fetches all active companies for dropdown
- Includes loading skeleton
- Error handling for missing data

### 2. **Client Component**
- **Path**: `/customer-portal/app/(dashboard)/settings/SettingsClient.tsx`
- **Type**: Client component
- **Purpose**: Interactive form for editing customer settings

**Layout** (matches main app `/company` page exactly):
```
┌─────────────────────────────────────────┐
│ Breadcrumbs: Kezdőlap > Beállítások    │
├─────────────────────────────────────────┤
│ Beállítások szerkesztése    [Mentés]   │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Alapadatok                          │ │
│ │ • Név (editable)                    │ │
│ │ • E-mail (read-only, filled)        │ │
│ │ • Telefonszám (editable, formatted) │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Számlázási adatok                   │ │
│ │ • Számlázási név                    │ │
│ │ • Ország                            │ │
│ │ • Város, Irányítószám               │ │
│ │ • Utca, Házszám                     │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Adó- és nyilvántartási adatok       │ │
│ │ • Adószám (auto-formatted)          │ │
│ │ • Cégjegyzékszám (auto-formatted)   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Vállalat és beállítások             │ │
│ │ • Kiválasztott vállalat (dropdown)  │ │
│ │ • SMS értesítések (toggle switch)   │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Metaadatok                          │ │
│ │ • Létrehozva (read-only)            │ │
│ │ • Utolsó módosítás (read-only)      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ Jelszó megváltoztatása              │ │
│ │ • Jelenlegi jelszó (with eye icon)  │ │
│ │ • Új jelszó (with eye icon)         │ │
│ │ • Jelszó megerősítése (with eye)    │ │
│ │ [Jelszó megváltoztatása] (warning)  │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 3. **API Endpoints**

#### `/api/customer-settings/route.ts`
- **GET**: Fetch current logged-in customer's data
- **PATCH**: Update current logged-in customer's data
- Uses `supabase.auth.getUser()` to identify customer
- Updates `portal_customers` table

#### `/api/customer-settings/change-password/route.ts`
- **POST**: Change customer's password
- Verifies current password first
- Updates password via `supabase.auth.updateUser()`

### 4. **Navigation Menu**
- **Path**: `/customer-portal/data/navigation/verticalMenuData.tsx`
- **Updated**: Added "Beállítások" menu item
- **Icon**: `ri-settings-3-line` with purple color (#8E44AD)

---

## 🎨 Design Features (Matching Main App)

### Visual Elements:
1. **Breadcrumbs** - Kezdőlap > Beállítások
2. **Page Header** - "Beállítások szerkesztése" with Save button on right
3. **Paper Cards** - Two separate cards (Settings + Password)
4. **Grid Layout** - Responsive 2-column grid (xs=12, md=6)
5. **Section Headers** - Typography variant="h6" with color="primary"
6. **Dividers** - After each section header
7. **Text Fields** - Full-width with proper labels
8. **Read-only Fields** - variant="filled" for email and metadata
9. **Required Fields** - Marked with asterisk via `required` prop
10. **Error Messages** - Helper text below fields
11. **Toast Notifications** - Success/error messages

### Auto-Formatting:
- **Phone Number**: `+36 30 999 2800` format
- **Tax Number**: `12345678-1-02` format
- **Company Reg**: `01-09-123456` format

### Validation:
- Name: Required
- Mobile: Required
- Tax number: Optional, but must match format if provided
- Company reg: Optional, but must match format if provided
- New password: Minimum 6 characters
- Password confirmation: Must match new password

---

## 📋 Field Mapping

### From `portal_customers` Table:

| Field | Display Name | Type | Editable | Section |
|-------|-------------|------|----------|---------|
| `name` | Név | Text | ✅ Yes | Alapadatok |
| `email` | E-mail | Email | ❌ Read-only | Alapadatok |
| `mobile` | Telefonszám | Phone | ✅ Yes | Alapadatok |
| `billing_name` | Számlázási név | Text | ✅ Yes | Számlázási adatok |
| `billing_country` | Ország | Text | ✅ Yes | Számlázási adatok |
| `billing_city` | Város | Text | ✅ Yes | Számlázási adatok |
| `billing_postal_code` | Irányítószám | Text | ✅ Yes | Számlázási adatok |
| `billing_street` | Utca | Text | ✅ Yes | Számlázási adatok |
| `billing_house_number` | Házszám | Text | ✅ Yes | Számlázási adatok |
| `billing_tax_number` | Adószám | Text | ✅ Yes | Adó adatok |
| `billing_company_reg_number` | Cégjegyzékszám | Text | ✅ Yes | Adó adatok |
| `selected_company_id` | Kiválasztott vállalat | Dropdown | ✅ Yes | Vállalat |
| `sms_notification` | SMS értesítések | Switch | ✅ Yes | Vállalat |
| `discount_percent` | - | - | 🚫 Hidden | - |
| `created_at` | Létrehozva | Date | ❌ Read-only | Metaadatok |
| `updated_at` | Utolsó módosítás | Date | ❌ Read-only | Metaadatok |

### Password Change (Separate Section):
- **Current Password** - Required, password field with visibility toggle
- **New Password** - Required, minimum 6 characters, with visibility toggle
- **Confirm Password** - Required, must match new password, with visibility toggle

---

## 🔐 API Flow

### Fetch Settings (GET):
```
1. User navigates to /settings
2. Server fetches auth user
3. Server fetches portal_customers record
4. Server fetches active companies
5. Data passed to SettingsClient
6. Form populated with current values
```

### Update Settings (PATCH):
```
1. User edits form fields
2. Client validates input
3. Client formats phone/tax/company reg numbers
4. Client sends PATCH to /api/customer-settings
5. Server verifies user authentication
6. Server updates portal_customers table
7. Server returns updated data
8. Client shows success toast
9. Form updated with fresh data
```

### Change Password (POST):
```
1. User enters current/new/confirm passwords
2. Client validates (required, length, match)
3. Client sends POST to /api/customer-settings/change-password
4. Server verifies current password via signInWithPassword
5. Server updates password via auth.updateUser()
6. Server returns success
7. Client clears password fields
8. Client shows success toast
```

---

## 🎯 User Experience

### Navigation:
1. User clicks "Beállítások" in menu
2. Page loads with all current data pre-filled
3. User edits any field
4. Auto-formatting happens on blur/change
5. User clicks "Mentés" button
6. Toast notification confirms save
7. Data refreshed from server

### Password Change:
1. User scrolls to "Jelszó megváltoztatása" section
2. Enters current password
3. Enters new password (min 6 chars)
4. Confirms new password
5. Clicks "Jelszó megváltoztatása" button
6. System verifies current password
7. System updates to new password
8. Fields cleared
9. Toast notification confirms change

---

## 🔒 Security Features

1. **Authentication Required**: Middleware checks session before page load
2. **User Verification**: API endpoints verify user via `auth.getUser()`
3. **Email Immutable**: Email cannot be changed (read-only field)
4. **Password Verification**: Current password verified before change
5. **No User ID Exposure**: API uses authenticated user's ID from session
6. **Auto-timestamps**: `updated_at` automatically updated on save

---

## 📊 Data Flow Diagram

```
Customer Portal Settings Page
│
├── Server Side (page.tsx)
│   ├── createClient() → Get auth user
│   ├── Fetch portal_customers by user.id
│   ├── Fetch active companies
│   └── Pass to SettingsClient
│
├── Client Side (SettingsClient.tsx)
│   ├── Display form with current data
│   ├── Handle input changes
│   ├── Auto-format phone/tax/company numbers
│   ├── Validate on save
│   └── Submit to API
│
└── API Routes
    ├── GET /api/customer-settings
    │   └── Return customer data for auth user
    ├── PATCH /api/customer-settings
    │   └── Update customer data for auth user
    └── POST /api/customer-settings/change-password
        └── Verify current + update to new password
```

---

## ✅ Testing Checklist

- [ ] Navigate to http://localhost:3001/settings (after login)
- [ ] Verify all fields populated with current data
- [ ] Email field is read-only (filled variant)
- [ ] Edit name and save - should update successfully
- [ ] Edit mobile number - should auto-format
- [ ] Edit billing fields - should save
- [ ] Edit tax number - should auto-format (12345678-1-02)
- [ ] Edit company reg - should auto-format (01-09-123456)
- [ ] Change selected company - should update
- [ ] Toggle SMS notification - should update
- [ ] Change password with correct current password - should succeed
- [ ] Change password with wrong current password - should fail
- [ ] New password < 6 chars - should show error
- [ ] Passwords don't match - should show error
- [ ] Check created_at and updated_at are read-only
- [ ] Save button shows "Mentés..." while saving
- [ ] Toast notifications appear for success/error
- [ ] Breadcrumbs navigate back to Kezdőlap

---

## 🎉 Summary

The settings page is now complete and matches the main app's `/company` page design exactly:
- ✅ Same layout structure
- ✅ Same Paper cards
- ✅ Same Grid spacing
- ✅ Same section headers
- ✅ Same input field styling
- ✅ Same breadcrumbs
- ✅ Same save button placement
- ✅ Same validation logic
- ✅ Same auto-formatting
- ✅ Plus password change functionality

**Ready for testing!** 🚀

