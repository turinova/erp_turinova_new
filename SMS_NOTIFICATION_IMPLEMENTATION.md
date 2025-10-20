# SMS Notification Feature Implementation

## Summary
Added SMS notification preference functionality to the customers table, allowing users to opt-in or opt-out of receiving SMS notifications.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20251020_add_sms_notification_to_customers.sql`

- Added `sms_notification` boolean column to `customers` table
- Default value: `false` (customers must opt-in)
- Created index for efficient filtering: `idx_customers_sms_notification`
- Added column comment for documentation

**SQL to run manually:**
```sql
ALTER TABLE public.customers
ADD COLUMN sms_notification BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_customers_sms_notification 
ON public.customers USING btree (sms_notification) 
TABLESPACE pg_default 
WHERE (deleted_at IS NULL);

COMMENT ON COLUMN public.customers.sms_notification IS 'Indicates whether the customer wants to receive SMS notifications';
```

### 2. Customer List Page
**File:** `src/app/(dashboard)/customers/CustomersListClient.tsx`

- Updated `Customer` interface to include `sms_notification: boolean`
- Added "SMS" column to the table header
- Display SMS status as "Igen" or "Nem" text indicator

### 3. Customer Edit Page
**File:** `src/app/(dashboard)/customers/[id]/CustomersEditClient.tsx`

- Updated `Customer` interface to include `sms_notification: boolean`
- Added imports: `FormControlLabel`, `Switch` from MUI
- Added new **"Értesítések"** section after "Számlázási adatok"
- Implemented toggle switch for SMS notifications
- Updated `handleInputChange` to accept `boolean` values

### 4. Customer Create Page
**File:** `src/app/(dashboard)/customers/new/page.tsx`

- Updated `Customer` interface to include `sms_notification: boolean`
- Added imports: `FormControlLabel`, `Switch` from MUI
- Set default value: `sms_notification: false` in initial state
- Added new **"Értesítések"** section after "Számlázási adatok"
- Implemented toggle switch for SMS notifications
- Updated `handleInputChange` to accept `boolean` values

### 5. Export API
**File:** `src/app/api/customers/export/route.ts`

- Added 'SMS' column to Excel export
- Values exported as: `'igen'` (true) or `'nem'` (false)
- Added column width configuration for SMS column (8 characters)

### 6. Import Preview API
**File:** `src/app/api/customers/import/preview/route.ts`

- Parse 'SMS' column from Excel file
- Accepts values: `'igen'`, `'yes'`, `'true'`, `'1'` as true
- Any other value (including empty) defaults to false
- Added `smsNotification` to preview data

### 7. Import API
**File:** `src/app/api/customers/import/route.ts`

- Parse 'SMS' column from Excel file
- Accepts values: `'igen'`, `'yes'`, `'true'`, `'1'` as true
- Any other value (including empty) defaults to false
- Added `sms_notification` to customer data for both insert and update operations

## Excel File Format

### Column Headers (Hungarian)
- Név
- E-mail
- Telefon
- Kedvezmény (%)
- **SMS** ← NEW
- Számlázási név
- Ország
- Város
- Irányítószám
- Utca
- Házszám
- Adószám
- Cégjegyzékszám

### SMS Column Values
- **Export:** `igen` (enabled) or `nem` (disabled)
- **Import:** Accepts `igen`, `yes`, `true`, `1` as enabled; anything else as disabled
- **Default:** `nem` (disabled) if empty or invalid

## UI Changes

### Customer List (`/customers`)
- New "SMS" column showing "Igen" or "Nem"

### Customer Edit (`/customers/[id]`)
- New "Értesítések" section with toggle switch
- Label: "SMS értesítések küldése"
- Located after "Számlázási adatok" section

### Customer Create (`/customers/new`)
- New "Értesítések" section with toggle switch
- Label: "SMS értesítések küldése"
- Default state: OFF (unchecked)
- Located after "Számlázási adatok" section

## Next Steps

### To activate this feature:
1. Run the SQL migration manually in Supabase dashboard
2. Test the functionality on localhost:3000
3. Once Vercel deployment completes, test in production

### For future SMS implementation:
- Query customers with `sms_notification = true` to get opt-in list
- Use Twilio or similar service to send SMS
- Example query:
```sql
SELECT id, name, mobile, email 
FROM customers 
WHERE sms_notification = true 
  AND deleted_at IS NULL
  AND mobile IS NOT NULL
```

## Testing Checklist
- [ ] Run SQL migration in Supabase
- [ ] Create new customer with SMS enabled
- [ ] Create new customer with SMS disabled
- [ ] Edit existing customer to enable SMS
- [ ] Edit existing customer to disable SMS
- [ ] Verify SMS column appears in customer list
- [ ] Export customers and check SMS column
- [ ] Import customers with SMS values (igen/nem)
- [ ] Verify import correctly sets sms_notification field

