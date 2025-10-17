# Customer Data Editing on Opti Page

**Date:** January 28, 2025  
**Feature:** Editable customer data with validation and database updates  
**Status:** Complete

---

## Overview

Enhanced the `/opti` page to allow editing of customer data when a customer is selected from the dropdown. Previously, all fields were disabled when a customer was selected, now they are fully editable and update the database when saving quotes/orders.

---

## Features Implemented

### 1. **Editable Customer Fields**
- ✅ Removed `disabled={!!selectedCustomer}` from all customer input fields
- ✅ All fields now editable: email, phone, discount, billing information
- ✅ Customer name field remains non-editable (as requested)
- ✅ Updated status message: "Adatok automatikusan kitöltve - szerkeszthető"

### 2. **Customer Name Uniqueness Validation**
- ✅ Real-time validation with 500ms debounce
- ✅ API endpoint: `/api/customers/check-name`
- ✅ Error message: "Ez az ügyfél név már létezik"
- ✅ Validation skipped if editing existing customer with same name
- ✅ Error cleared when selecting customer from dropdown

### 3. **Database Updates**
- ✅ Customer data updated in database when saving quotes/orders
- ✅ Updates `updated_at` timestamp automatically
- ✅ Handles both new customer creation and existing customer updates
- ✅ All fields updated: email, mobile, discount_percent, billing fields

### 4. **Error Handling**
- ✅ Toast error messages for validation failures
- ✅ Prevents saving when customer name validation error exists
- ✅ API error handling with detailed messages
- ✅ Graceful fallback for API failures

---

## Technical Implementation

### Frontend Changes (`OptiClient.tsx`)

#### State Management
```typescript
// Added customer validation state
const [customerValidationError, setCustomerValidationError] = useState<string | null>(null)
```

#### Validation Function
```typescript
const validateCustomerName = async (name: string) => {
  // Skip validation for empty names or unchanged existing customer names
  // API call to check uniqueness
  // Set error state based on response
}
```

#### Field Updates
- Removed `disabled={!!selectedCustomer}` from all TextField components
- Added error display to customer name field
- Updated status message to indicate fields are editable

#### Save Validation
```typescript
// Added validation check before saving
if (customerValidationError) {
  toast.error('Kérem javítsa ki az ügyfél név hibáját a mentés előtt!')
  return
}
```

### Backend Changes

#### API Route (`/api/customers/check-name/route.ts`)
```typescript
// New endpoint to check customer name uniqueness
export async function GET(request: NextRequest) {
  // Query customers table for existing name
  // Return { exists: boolean }
}
```

#### Quotes API (`/api/quotes/route.ts`)
```typescript
// Enhanced customer handling
if (customerData.name) {
  if (!customerId) {
    // Create new customer
  } else {
    // Update existing customer with all fields
    // Update updated_at timestamp
  }
}
```

---

## User Experience

### Workflow
1. **Select Customer**: Choose from dropdown → fields auto-populate
2. **Edit Fields**: All fields become editable (except name)
3. **Real-time Validation**: Name uniqueness checked as you type
4. **Save Quote**: Customer data updated in database
5. **Error Handling**: Clear error messages for validation failures

### Visual Feedback
- ✅ Error state on customer name field when validation fails
- ✅ Helper text shows validation error message
- ✅ Toast notifications for save errors
- ✅ Status message indicates fields are editable

---

## Database Schema

### Customers Table
```sql
create table public.customers (
  id uuid not null default gen_random_uuid (),
  name character varying not null,                    -- Unique constraint
  email character varying not null,
  mobile character varying null,
  discount_percent numeric(5, 2) null default 0,
  billing_name character varying null,
  billing_country character varying null default 'Magyarország',
  billing_city character varying null,
  billing_postal_code character varying null,
  billing_street character varying null,
  billing_house_number character varying null,
  billing_tax_number character varying null,
  billing_company_reg_number character varying null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),  -- Auto-updated
  deleted_at timestamp with time zone null,
  constraint customers_pkey primary key (id),
  constraint customers_email_key unique (email)
);
```

### Constraints
- ✅ `customers_name_unique_active`: Unique name constraint (excluding soft-deleted)
- ✅ `update_customers_updated_at`: Trigger to update `updated_at` on changes

---

## Error Scenarios Handled

### 1. **Duplicate Customer Name**
- **Scenario**: User types existing customer name
- **Response**: Red error state with "Ez az ügyfél név már létezik"
- **Action**: User must change name or select existing customer

### 2. **API Validation Failure**
- **Scenario**: Customer name check API fails
- **Response**: "Hiba a név ellenőrzése során"
- **Action**: User can still proceed (graceful degradation)

### 3. **Database Update Failure**
- **Scenario**: Customer update fails during quote save
- **Response**: Toast error with specific details
- **Action**: User can retry or contact support

### 4. **Save with Validation Error**
- **Scenario**: User tries to save with name validation error
- **Response**: "Kérem javítsa ki az ügyfél név hibáját a mentés előtt!"
- **Action**: User must fix validation error first

---

## Testing Checklist

- ✅ Select existing customer → fields populate and editable
- ✅ Edit customer fields → changes persist
- ✅ Type duplicate customer name → validation error appears
- ✅ Select customer from dropdown → validation error clears
- ✅ Save quote with edited customer data → database updates
- ✅ Save quote with validation error → prevented with toast
- ✅ API failures → graceful error handling

---

## Files Modified

1. **`starter-kit/src/app/(dashboard)/opti/OptiClient.tsx`**
   - Removed disabled states from customer fields
   - Added customer name validation
   - Enhanced error handling
   - Updated status messages

2. **`starter-kit/src/app/api/customers/check-name/route.ts`**
   - New API endpoint for name uniqueness validation

3. **`starter-kit/src/app/api/quotes/route.ts`**
   - Enhanced customer update logic
   - Added existing customer update functionality

---

## Benefits

### For Users
- ✅ **Flexibility**: Edit customer data without creating duplicates
- ✅ **Efficiency**: Update customer info during quote creation
- ✅ **Validation**: Prevent duplicate customer names
- ✅ **Feedback**: Clear error messages and visual indicators

### For System
- ✅ **Data Integrity**: Unique customer names maintained
- ✅ **Audit Trail**: `updated_at` timestamps track changes
- ✅ **Performance**: Debounced validation reduces API calls
- ✅ **Reliability**: Comprehensive error handling

---

**Implementation completed successfully! ✅**

The `/opti` page now provides a seamless customer editing experience with proper validation and database updates.
