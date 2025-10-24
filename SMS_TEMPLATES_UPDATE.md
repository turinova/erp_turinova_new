# SMS Templates Update - Implementation Summary

## 📋 Overview
Updated the SMS notifications system to support multiple templates with specific names. The system now supports:
1. **Készre jelentés** - Used when an order is marked as "Kész" (ready)
2. **Tárolás figyelmeztetés** - Used to warn customers about orders that have been ready for too long

**🐛 Bug Fix:** Also fixed the missing SMS confirmation modal on the `/orders` page. The modal was not appearing when marking orders as "Gyártás kész", preventing SMS notifications from being sent.

---

## 🗄️ Database Changes

### Migration File
**Location:** `/Volumes/T7/erp_turinova_new/supabase/migrations/20251024_add_template_name_to_sms_settings.sql`

**What it does:**
- Adds `template_name` column to `sms_settings` table
- Updates existing record to "Készre jelentés"
- Inserts new "Tárolás figyelmeztetés" template
- Adds unique constraint on `template_name`

**⚠️ IMPORTANT: You need to run this migration manually in your Supabase database!**

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/20251024_add_template_name_to_sms_settings.sql
```

---

## 📝 Template Details

### Template 1: Készre jelentés
**Used for:** Orders marked as "Kész" (ready) in the `/orders` page
**Available variables:**
- `{customer_name}` - Customer name
- `{order_number}` - Order number
- `{company_name}` - Company name
- `{material_name}` - List of unique materials used

**Default template:**
```
Kedves {customer_name}! Az On {order_number} szamu rendelese elkeszult es atvehetο. Udvozlettel, {company_name}
```

### Template 2: Tárolás figyelmeztetés
**Used for:** Warning customers about orders ready for multiple days
**Available variables:**
- `{customer_name}` - Customer name
- `{order_number}` - Order number
- `{company_name}` - Company name
- `{days}` - Number of days the order has been ready

**Default template:**
```
Kedves {customer_name}! Az On {order_number} szamu rendelese mar {days} napja kesz es athvehetο. Kerem, vegye fel velunk a kapcsolatot! Udvozlettel, {company_name}
```

---

## 🔧 Code Changes

### 1. Server Functions (`main-app/src/lib/supabase-server.ts`)
- ✅ Added `getAllSmsSettings()` - Fetches all SMS templates
- ✅ Updated `getSmsSettings()` - Kept for backward compatibility

### 2. API Route (`main-app/src/app/api/sms-settings/route.ts`)
- ✅ Updated GET endpoint to return all templates
- ✅ Updated PATCH endpoint to accept `id` parameter for specific template updates

### 3. Notifications Page (`main-app/src/app/(dashboard)/notifications/page.tsx`)
- ✅ Updated to fetch all templates using `getAllSmsSettings()`
- ✅ Passes `initialTemplates` array to client component

### 4. Notifications Client (`main-app/src/app/(dashboard)/notifications/NotificationsClient.tsx`)
- ✅ Added template selector dropdown
- ✅ Dynamic variable display based on selected template
- ✅ Template-specific default reset functionality
- ✅ Updates correct template when saving

### 5. Twilio Integration (`main-app/src/lib/twilio.ts`)
- ✅ Updated to specifically fetch "Készre jelentés" template
- ✅ This ensures the correct template is used for the "Gyártás kész" modal on `/orders` page

### 6. Orders Page (`main-app/src/app/(dashboard)/orders/OrdersListClient.tsx`) - **BUG FIX + NEW FEATURE**
- ✅ **Fixed missing SMS modal** - The SMS confirmation modal was not appearing
- ✅ Added `handleMarkAsReady()` function to check SMS eligibility
- ✅ Added `handleSmsConfirmation()` function to handle user selection
- ✅ Updated bulk status update to accept `smsOrderIds` parameter
- ✅ Added SMS notification results toast messages
- ✅ Integrated `SmsConfirmationModal` component
- ✅ Connected "Gyártás kész" button to SMS eligibility check
- ✅ **NEW: Added "SMS emlékeztető" button** for storage reminders
- ✅ Added `handleSendReminder()` function to filter "Kész" orders
- ✅ Added `handleReminderConfirmation()` function to send reminder SMS
- ✅ Integrated `StorageReminderModal` component

### 7. Storage Reminder Modal (`main-app/src/app/(dashboard)/orders/StorageReminderModal.tsx`) - **NEW**
- ✅ Created new modal component for storage reminders
- ✅ Similar to SmsConfirmationModal but with custom text
- ✅ Buttons: "Mégse" (cancel) and "Emlékeztető küldés" (send reminder)
- ✅ Shows customers with mobile numbers from "Kész" orders

### 8. Storage Reminder API (`main-app/src/app/api/orders/send-reminder/route.ts`) - **NEW**
- ✅ Created new endpoint `/api/orders/send-reminder`
- ✅ Filters for orders with status = 'ready' (Kész)
- ✅ Sends SMS to ALL customers with mobile numbers (no sms_notification check)
- ✅ Uses "Tárolás figyelmeztetés" template
- ✅ Calculates storage days from `production_date` or `updated_at`
- ✅ Replaces `{days}` variable in template
- ✅ Returns count of sent/failed SMS

---

## 🎯 How It Works

### On the Notifications Page (`/notifications`)
1. User sees a dropdown to select template type
2. Dropdown shows: "Készre jelentés" and "Tárolás figyelmeztetés"
3. When a template is selected, the form loads its current message
4. Available variables update dynamically based on template type
5. User can edit and save the template
6. Reset button provides template-specific defaults

### On the Orders Page (`/orders`)

**For "Gyártás kész" button:**
1. When marking an order as "Kész" (ready), the SMS modal appears
2. The system automatically fetches the "Készre jelentés" template
3. It replaces variables: `{customer_name}`, `{order_number}`, `{company_name}`, `{material_name}`
4. SMS is sent to customers with `sms_notification = true`

**For "SMS emlékeztető" button (NEW):**
1. Select orders and click "SMS emlékeztető"
2. System filters for orders with status "Kész" (ready) and mobile numbers
3. Modal shows eligible customers (ALL with mobile numbers, no sms_notification check)
4. Click "Emlékeztető küldés" to send
5. System uses "Tárolás figyelmeztetés" template
6. Calculates storage days from production_date/updated_at
7. Replaces variables: `{customer_name}`, `{order_number}`, `{company_name}`, `{days}`
8. SMS is sent to selected customers
9. Order status remains unchanged (still "Kész")

### Future: Storage Warning Feature
- The "Tárolás figyelmeztetés" template is ready for future implementation
- It will use the `{days}` variable to show how long an order has been ready
- This can be triggered manually or automatically based on storage duration

---

## ✅ Testing Checklist

After running the migration:

1. **Notifications Page** (`http://localhost:3000/notifications`)
   - [ ] Template dropdown appears
   - [ ] Both templates are listed
   - [ ] Selecting "Készre jelentés" shows current template
   - [ ] Selecting "Tárolás figyelmeztetés" shows its template
   - [ ] Variables update correctly for each template
   - [ ] Can edit and save each template independently
   - [ ] Reset button works with template-specific defaults

2. **Orders Page** (`http://localhost:3000/orders?page=1`)
   - [ ] Mark an order as "Kész" (ready)
   - [ ] SMS modal appears
   - [ ] Preview shows the "Készre jelentés" template
   - [ ] Variables are correctly replaced
   - [ ] SMS sends successfully

---

## 📦 Files Modified

### Created:
- `supabase/migrations/20251024_add_template_name_to_sms_settings.sql`
- `SMS_TEMPLATES_UPDATE.md` (this file)
- `main-app/src/app/api/orders/send-reminder/route.ts` (NEW - Storage reminder API)
- `main-app/src/app/(dashboard)/orders/StorageReminderModal.tsx` (NEW - Reminder modal)

### Modified:
- `main-app/src/lib/supabase-server.ts`
- `main-app/src/app/(dashboard)/notifications/page.tsx`
- `main-app/src/app/(dashboard)/notifications/NotificationsClient.tsx`
- `main-app/src/app/api/sms-settings/route.ts`
- `main-app/src/lib/twilio.ts`
- `main-app/src/app/(dashboard)/orders/OrdersListClient.tsx` (Fixed SMS modal + Added reminder button)
- `main-app/src/app/api/orders/bulk-status/route.ts` (Added require_in_production flag)
- `main-app/src/app/(dashboard)/scanner/ScannerClient.tsx` (Added require_in_production flag)

---

## 🚀 Next Steps

1. **Run the migration** in Supabase SQL Editor:
   ```bash
   # Copy contents of:
   # /Volumes/T7/erp_turinova_new/supabase/migrations/20251024_add_template_name_to_sms_settings.sql
   # And run in Supabase SQL Editor
   ```

2. **Test the notifications page** to ensure dropdown works

3. **Test the orders page** to ensure "Készre jelentés" template is used

4. **When ready to deploy**, commit and push the changes

---

## 💡 Notes

- The system is backward compatible - if templates aren't found, it uses defaults
- Each template can be edited independently
- The "Tárolás figyelmeztetés" template is ready but not yet implemented in the UI
- All changes follow the existing SMS character limit validation (160 characters)

---

**Status:** ✅ Ready for testing after migration is run
**NOT committed to Git** - awaiting your approval to commit

