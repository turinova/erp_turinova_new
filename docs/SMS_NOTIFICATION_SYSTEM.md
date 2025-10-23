# SMS Notification System - Értesítések

## Overview

The SMS notification system automatically sends SMS messages to customers when their orders are marked as "ready" (Gyártás kész) in the production scanner. The system is fully configurable through the `/notifications` page in the main application.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [SMS Message Template](#sms-message-template)
5. [User Interface](#user-interface)
6. [API Endpoints](#api-endpoints)
7. [SMS Sending Flow](#sms-sending-flow)
8. [Configuration](#configuration)
9. [Character Encoding & Limitations](#character-encoding--limitations)
10. [Error Handling](#error-handling)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)

---

## Features

### Core Functionality
- ✅ **Automatic SMS notifications** when orders are marked as ready
- ✅ **Customizable message templates** with dynamic variables
- ✅ **User confirmation modal** before sending SMS
- ✅ **Selective SMS sending** (choose which customers receive SMS)
- ✅ **Customer opt-in/opt-out** (`sms_notification` flag in customers table)
- ✅ **Real-time preview** of SMS message with sample data
- ✅ **Character counter** with warnings for long messages
- ✅ **Dynamic company name** from database
- ✅ **Material list** automatically fetched from quote
- ✅ **Toast notifications** for success/failure feedback

### Access Control
- ✅ **All authenticated users** can access `/notifications` page
- ✅ **Permission-based access** (can be revoked per user in `/users` page)
- ✅ **Only accessible from Scanner page** (`/scanner`) for sending

---

## Architecture

### Technology Stack
- **SMS Provider**: Twilio
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Frontend**: React + Material-UI
- **Server-Side Rendering**: Next.js SSR

### File Structure

```
main-app/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── notifications/
│   │   │   │   ├── page.tsx                    # SSR page (fetches settings)
│   │   │   │   └── NotificationsClient.tsx     # Client component (form)
│   │   │   └── scanner/
│   │   │       ├── ScannerClient.tsx           # Scanner page with SMS logic
│   │   │       └── SmsConfirmationModal.tsx    # SMS confirmation modal
│   │   └── api/
│   │       ├── orders/
│   │       │   ├── bulk-status/route.ts        # Main order update endpoint
│   │       │   └── sms-eligible/route.ts       # Fetch SMS-eligible orders
│   │       └── sms-settings/
│   │           └── route.ts                    # GET/PATCH SMS settings
│   ├── lib/
│   │   ├── twilio.ts                           # Twilio SMS sending logic
│   │   └── supabase-server.ts                  # SSR data fetching
│   └── data/navigation/
│       └── verticalMenuData.tsx                # Navigation menu
└── .env.local                                  # Environment variables

supabase/
└── migrations/
    └── 20251023_create_sms_settings_table.sql  # Database migration
```

---

## Database Schema

### `sms_settings` Table

```sql
CREATE TABLE IF NOT EXISTS public.sms_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_template text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sms_settings_pkey PRIMARY KEY (id)
);
```

**Purpose**: Stores the SMS message template globally for the company.

**Key Points**:
- ✅ Single row for company-wide settings
- ✅ `message_template` stores the customizable SMS text
- ✅ Auto-updated timestamp trigger on changes

### `customers` Table (Relevant Fields)

```sql
customers (
  ...
  mobile character varying null,              -- Customer phone number
  sms_notification boolean NOT NULL DEFAULT false,  -- Opt-in flag
  ...
)
```

**Purpose**: Customer contact information and SMS preferences.

**Key Points**:
- ✅ `mobile`: Must be in E.164 format (e.g., `+36301234567`)
- ✅ `sms_notification`: Must be `true` for SMS to be sent
- ✅ Both fields required for SMS eligibility

### `pages` Table (New Entry)

```sql
INSERT INTO public.pages (path, name, description, category, is_active) VALUES (
  '/notifications',
  'Értesítések',
  'SMS értesítési üzenetek szerkesztése',
  'Beállítások',
  true
);
```

**Purpose**: Registers the `/notifications` page in the permission system.

---

## SMS Message Template

### Available Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `{customer_name}` | Customer's full name | `Mezo David` |
| `{order_number}` | Order number (or quote number if no order number) | `ORD-2025-10-22-001` |
| `{company_name}` | Company name from `tenant_company` table | `Turinova Kft.` |
| `{material_name}` | Comma-separated list of unique material names | `EGGER U999 ST9, KRONOSPAN K001` |

### Default Template

```
Kedves {customer_name}! Az On {order_number} szamu rendelese elkeszult es atvehetο. Udvozlettel, {company_name}
```

**Translated**: "Dear {customer_name}! Your order {order_number} is ready and can be picked up. Best regards, {company_name}"

### Template Replacement Logic

```typescript
const message = messageTemplate
  .replace(/{customer_name}/g, customerName)
  .replace(/{order_number}/g, orderNumber)
  .replace(/{company_name}/g, companyName)
  .replace(/{material_name}/g, materialNames)
```

**Important**: Uses global regex (`/g`) to replace all occurrences.

---

## User Interface

### `/notifications` Page

**Location**: Main App → Beállítások → Értesítések  
**URL**: `http://localhost:3000/notifications` (or `https://app.turinova.hu/notifications`)  
**Access**: All authenticated users (can be restricted per user)

#### Features

1. **Message Template Editor**
   - Large textarea for editing SMS template
   - Placeholder shows default template
   - Real-time character counter (160 character limit)
   - Warning when exceeding SMS limit

2. **Available Variables Info Box**
   - Lists all available variables with descriptions
   - Shows example values
   - Warns about ASCII character requirements

3. **Live Preview Panel**
   - Shows SMS as customer will receive it
   - Uses sample data for preview
   - Updates in real-time as template is edited
   - Uses actual company name from database

4. **Action Buttons**
   - **Mentés** (Save): Saves template to database
   - **Alapértelmezett visszaállítása** (Reset to Default): Restores default template

5. **Character Counter**
   - Shows current character count vs. 160 limit
   - Color-coded warnings:
     - Green: 0-140 characters (safe)
     - Orange: 141-160 characters (warning)
     - Red: 161+ characters (will send multiple SMS)

#### UI Components

```typescript
<TextField
  fullWidth
  multiline
  rows={4}
  label="Üzenet szövege"
  value={messageTemplate}
  onChange={(e) => setMessageTemplate(e.target.value)}
/>

<Alert severity="info">
  <Typography variant="subtitle2">Elérhető változók:</Typography>
  <List>
    <ListItem>{customer_name} - Ügyfél neve</ListItem>
    <ListItem>{order_number} - Megrendelés száma</ListItem>
    <ListItem>{company_name} - Cég neve</ListItem>
    <ListItem>{material_name} - Anyagok listája</ListItem>
  </List>
  <Typography variant="caption">
    ⚠️ Használj ASCII karaktereket! (ő→o, á→a, ü→u, stb.)
  </Typography>
</Alert>

<Paper variant="outlined">
  <Typography variant="subtitle2">SMS előnézet:</Typography>
  <Typography variant="body2">{previewMessage}</Typography>
</Paper>
```

---

## API Endpoints

### 1. GET `/api/sms-settings`

**Purpose**: Fetch current SMS message template

**Request**: None

**Response**:
```json
{
  "id": "uuid",
  "message_template": "Kedves {customer_name}! ...",
  "created_at": "2025-01-23T10:00:00Z",
  "updated_at": "2025-01-23T10:00:00Z"
}
```

**Error Responses**:
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Database error

---

### 2. PATCH `/api/sms-settings`

**Purpose**: Update SMS message template

**Request Body**:
```json
{
  "message_template": "Kedves {customer_name}! Az On {order_number} szamu..."
}
```

**Response**:
```json
{
  "success": true
}
```

**Validation**:
- ✅ `message_template` must be a string
- ✅ User must be authenticated

**Side Effects**:
- Updates `updated_at` timestamp
- Revalidates `/notifications` page cache
- Creates new row if none exists (upsert logic)

**Error Responses**:
- `400 Bad Request`: Invalid request body
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Database error

---

### 3. POST `/api/orders/sms-eligible`

**Purpose**: Fetch orders eligible for SMS notification

**Request Body**:
```json
{
  "order_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response**:
```json
{
  "sms_eligible_orders": [
    {
      "id": "uuid1",
      "order_number": "ORD-2025-001",
      "customer_name": "Mezo David",
      "customer_mobile": "+36301234567"
    }
  ]
}
```

**Eligibility Criteria**:
- ✅ Order status is `in_production`
- ✅ Customer has `sms_notification = true`
- ✅ Customer has a valid `mobile` number

**Error Responses**:
- `400 Bad Request`: Missing or invalid `order_ids`
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Database error

---

### 4. PATCH `/api/orders/bulk-status`

**Purpose**: Update order status and send SMS notifications

**Request Body**:
```json
{
  "order_ids": ["uuid1", "uuid2"],
  "new_status": "ready",
  "create_payments": false,
  "sms_order_ids": ["uuid1"]  // User-selected orders for SMS
}
```

**Response**:
```json
{
  "success": true,
  "updated_count": 2,
  "payments_created": 0,
  "new_status": "ready",
  "sms_notifications": {
    "sent": 1,
    "failed": 0,
    "errors": []
  }
}
```

**SMS Sending Logic**:
1. Fetch orders matching `sms_order_ids` (user-confirmed list)
2. Filter for orders with `sms_notification = true` and valid `mobile`
3. Update order status to `ready`
4. Fetch company name from `tenant_company` table
5. Send SMS to each eligible customer
6. Return summary with sent/failed counts

**Error Responses**:
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Database or SMS sending error

---

## SMS Sending Flow

### Step-by-Step Process

#### 1. **User Scans Orders** (`/scanner` page)
- User scans barcode or manually adds orders
- Orders appear in the scanned list
- User selects orders to mark as ready

#### 2. **User Clicks "Gyártás kész"**
```typescript
const handleReadyClick = async () => {
  // Fetch SMS-eligible orders from selected orders
  const response = await fetch('/api/orders/sms-eligible', {
    method: 'POST',
    body: JSON.stringify({ order_ids: selectedOrders })
  })
  
  const { sms_eligible_orders } = await response.json()
  
  // Show SMS confirmation modal if eligible orders found
  if (sms_eligible_orders.length > 0) {
    setSmsEligibleOrders(sms_eligible_orders)
    setSmsModalOpen(true)
  } else {
    // No SMS-eligible orders, proceed without SMS
    await handleBulkStatusUpdate('ready', false, [])
  }
}
```

#### 3. **SMS Confirmation Modal Appears**
- Lists all customers eligible for SMS
- Shows customer name and mobile number
- All customers selected by default
- User can uncheck individual customers
- "Select All" checkbox for convenience

```typescript
<Dialog open={smsModalOpen}>
  <DialogTitle>SMS értesítések küldése</DialogTitle>
  <DialogContent>
    <Table>
      <TableBody>
        {orders.map(order => (
          <TableRow key={order.id}>
            <TableCell>
              <Checkbox
                checked={selectedOrderIds.includes(order.id)}
                onChange={() => handleToggle(order.id)}
              />
            </TableCell>
            <TableCell>{order.customer_name}</TableCell>
            <TableCell>{order.customer_mobile}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Mégse</Button>
    <Button onClick={handleConfirm}>Gyártás kész</Button>
  </DialogActions>
</Dialog>
```

#### 4. **User Confirms SMS Sending**
```typescript
const handleSmsConfirmation = async (selectedSmsOrderIds: string[]) => {
  setSmsModalOpen(false)
  await handleBulkStatusUpdate('ready', false, selectedSmsOrderIds)
}
```

#### 5. **Backend Processes Orders**
```typescript
// 1. Fetch orders with customer data (BEFORE status update)
const { data: orders } = await supabase
  .from('quotes')
  .select(`
    id, quote_number, order_number, status, customer_id,
    customers!inner (id, name, mobile, sms_notification)
  `)
  .in('id', sms_order_ids)
  .eq('status', 'in_production')

// 2. Filter SMS-eligible orders
const ordersForSMS = orders.filter(order => 
  order.customers?.sms_notification === true && 
  order.customers?.mobile
)

// 3. Update order status to 'ready'
await supabase
  .from('quotes')
  .update({ status: 'ready', updated_at: new Date().toISOString() })
  .in('id', order_ids)

// 4. Fetch company name
const { data: companyData } = await supabase
  .from('tenant_company')
  .select('name')
  .limit(1)
  .single()

const companyName = companyData?.name || 'Turinova'

// 5. Send SMS to each customer
for (const order of ordersForSMS) {
  const result = await sendOrderReadySMS(
    order.customers.name,
    order.customers.mobile,
    order.order_number || order.quote_number,
    companyName,
    order.id  // For fetching materials
  )
  
  if (result.success) {
    smsResults.sent++
  } else {
    smsResults.failed++
    smsResults.errors.push(`${order.customers.name}: ${result.error}`)
  }
}
```

#### 6. **SMS Sending Function** (`lib/twilio.ts`)
```typescript
export async function sendOrderReadySMS(
  customerName: string,
  customerMobile: string,
  orderNumber: string,
  companyName: string,
  quoteId?: string
): Promise<SMSResult> {
  // 1. Validate Twilio credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER
  
  if (!accountSid || !authToken || !twilioNumber) {
    return { success: false, error: 'Missing Twilio credentials' }
  }
  
  // 2. Normalize phone number (remove spaces)
  const normalizedMobile = customerMobile.replace(/\s+/g, '')
  
  // 3. Fetch SMS template from database
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { data: settings } = await supabase
    .from('sms_settings')
    .select('message_template')
    .limit(1)
    .single()
  
  let messageTemplate = settings?.message_template || DEFAULT_TEMPLATE
  
  // 4. Fetch unique material names (if quoteId provided)
  let materialNames = ''
  if (quoteId) {
    const { data: materials } = await supabase
      .from('quote_materials_pricing')
      .select('material_name')
      .eq('quote_id', quoteId)
    
    if (materials && materials.length > 0) {
      const uniqueMaterials = [...new Set(materials.map(m => m.material_name))]
      materialNames = uniqueMaterials.join(', ')
    }
  }
  
  // 5. Replace template variables
  const message = messageTemplate
    .replace(/{customer_name}/g, customerName)
    .replace(/{order_number}/g, orderNumber)
    .replace(/{company_name}/g, companyName)
    .replace(/{material_name}/g, materialNames)
  
  // 6. Send SMS via Twilio
  const client = twilio(accountSid, authToken)
  
  try {
    const twilioMessage = await client.messages.create({
      body: message,
      from: twilioNumber,
      to: normalizedMobile
    })
    
    return {
      success: true,
      messageSid: twilioMessage.sid
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

#### 7. **User Receives Feedback**
```typescript
// Success toast
if (smsResults.sent > 0) {
  toast.success(`📱 ${smsResults.sent} SMS értesítés elküldve`, { autoClose: 5000 })
}

// Warning toast for failures
if (smsResults.failed > 0) {
  toast.warning(
    `⚠️ ${smsResults.failed} SMS küldése sikertelen${
      smsResults.errors.length > 0 ? `: ${smsResults.errors[0]}` : ''
    }`,
    { autoClose: 7000 }
  )
}
```

---

## Configuration

### Environment Variables

**Required in `.env.local` (local development):**
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Supabase Configuration (already present)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Required in Vercel (production):**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add the same variables as above
3. Select "Production", "Preview", and "Development" environments
4. Save and redeploy

### Twilio Setup

1. **Create Twilio Account**
   - Go to [https://www.twilio.com/](https://www.twilio.com/)
   - Sign up for a free trial or paid account

2. **Get Credentials**
   - Navigate to Console Dashboard
   - Copy "Account SID" and "Auth Token"

3. **Purchase Phone Number**
   - Go to Phone Numbers → Buy a Number
   - Select a number with SMS capability
   - Copy the phone number (format: `+1234567890`)

4. **Configure Messaging Service (Optional)**
   - For production use, consider setting up a Messaging Service
   - Enables better deliverability and tracking

### Customer Configuration

**Enable SMS for a customer:**
1. Go to main app → Ügyfelek (Customers)
2. Edit customer details
3. Check "SMS értesítés" checkbox
4. Ensure mobile number is in E.164 format (`+36301234567`)
5. Save

---

## Character Encoding & Limitations

### SMS Character Limits

| Encoding | Single SMS | Multi-part SMS (per segment) |
|----------|-----------|------------------------------|
| **GSM 7-bit** | 160 characters | 153 characters |
| **UCS-2 (Unicode)** | 70 characters | 67 characters |

### ASCII vs. Unicode

**GSM 7-bit (Recommended)**:
- ✅ 160 characters per SMS
- ✅ Lower cost
- ❌ No Hungarian special characters (á, é, í, ó, ö, ő, ú, ü, ű)

**UCS-2 Unicode**:
- ✅ Supports all Hungarian characters
- ❌ Only 70 characters per SMS
- ❌ Higher cost (2-3x more expensive)

### Best Practices

1. **Use ASCII equivalents** for Hungarian characters:
   ```
   á → a    é → e    í → i    ó → o    ö → o    ő → o
   ú → u    ü → u    ű → u
   ```

2. **Default template uses ASCII**:
   ```
   Kedves {customer_name}! Az On {order_number} szamu rendelese 
   elkeszult es atvehetο. Udvozlettel, {company_name}
   ```
   (Note: "ő" → "o", "á" → "a", etc.)

3. **Keep messages under 160 characters** to avoid multi-part SMS

4. **Test before deploying** to ensure character count is accurate

### Character Counter Logic

```typescript
const charCount = useMemo(() => {
  let tempMessage = messageTemplate
    .replace(/{customer_name}/g, 'Mezo David')        // ~10 chars
    .replace(/{order_number}/g, 'ORD-2025-10-22-001') // ~18 chars
    .replace(/{company_name}/g, companyName)          // Dynamic
    .replace(/{material_name}/g, 'EGGER U999 ST9, KRONOSPAN K001') // ~30 chars
  return tempMessage.length
}, [messageTemplate, companyName])

const isOverLimit = charCount > 160
```

---

## Error Handling

### Common Errors & Solutions

#### 1. **Missing Twilio Credentials**
**Error**: `Missing Twilio credentials`  
**Cause**: Environment variables not set  
**Solution**:
- Check `.env.local` for local development
- Check Vercel environment variables for production
- Ensure all 3 variables are set: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

#### 2. **Invalid Phone Number Format**
**Error**: `'To' phone number is not a valid E.164 number`  
**Cause**: Customer mobile number not in correct format  
**Solution**:
- Update customer mobile to E.164 format: `+36301234567`
- Remove spaces: `+36 30 123 4567` → `+36301234567`
- Ensure country code is present (`+36` for Hungary)

#### 3. **Country Mismatch**
**Error**: `'From' +1234567890 is not a Twilio phone number or Short Code country mismatch`  
**Cause**: Twilio number's country doesn't match recipient's country  
**Solution**:
- Use a Twilio number from the same country (e.g., Hungarian number for Hungarian customers)
- Or enable international SMS in Twilio settings

#### 4. **SMS Not Sent (Customer Not Eligible)**
**Error**: None (customer silently skipped)  
**Cause**: Customer doesn't meet eligibility criteria  
**Solution**:
- Ensure `sms_notification = true` in customers table
- Ensure customer has a valid `mobile` number
- Check order status is `in_production` before marking as `ready`

#### 5. **Template Not Loading**
**Error**: Default template used instead of custom  
**Cause**: Database fetch failed or no custom template exists  
**Solution**:
- Check `/notifications` page to ensure template is saved
- Verify `sms_settings` table has a row
- Check database connection

#### 6. **Permission Denied**
**Error**: `403 Forbidden` or page not accessible  
**Cause**: User doesn't have permission to access `/notifications`  
**Solution**:
- Go to `/users` → Select user → "Jogosultságok"
- Enable `/notifications` page access
- Save permissions

### Error Logging

**Console logs for debugging:**
```typescript
console.log(`[SMS] Found ${ordersForSMS.length} orders to send SMS`)
console.log(`[SMS] Sending to ${customerMobile} (normalized: ${normalizedMobile})`)
console.log(`[SMS] ✓ Sent successfully. SID: ${twilioMessage.sid}`)
console.error(`[SMS] ✗ Failed for ${customerName}:`, error)
```

**Check browser console** for client-side errors  
**Check server logs** (Vercel or local terminal) for API errors

---

## Testing

### Test Checklist

#### 1. **Test SMS Template Editing**
- [ ] Go to `/notifications`
- [ ] Edit message template
- [ ] Add custom text and variables
- [ ] Check character counter updates
- [ ] View live preview
- [ ] Click "Mentés" (Save)
- [ ] Refresh page to confirm template persisted

#### 2. **Test SMS Sending (Development)**
- [ ] Add test customer with your own mobile number
- [ ] Enable `sms_notification` for test customer
- [ ] Create test order for this customer
- [ ] Move order to `in_production` status
- [ ] Go to `/scanner` page
- [ ] Scan/add test order
- [ ] Click "Gyártás kész"
- [ ] Verify SMS confirmation modal appears
- [ ] Confirm SMS sending
- [ ] Check your phone for SMS

#### 3. **Test Eligibility Filtering**
- [ ] Create customer without mobile number → should not appear in SMS modal
- [ ] Create customer with `sms_notification = false` → should not appear
- [ ] Create order not in `in_production` status → should not appear
- [ ] Verify only eligible customers appear in modal

#### 4. **Test Permission System**
- [ ] Create non-admin user
- [ ] Try accessing `/notifications` (should work by default)
- [ ] Go to `/users` → Revoke `/notifications` permission
- [ ] Try accessing `/notifications` again (should redirect or show error)
- [ ] Re-enable permission

#### 5. **Test Error Handling**
- [ ] Temporarily remove Twilio credentials from `.env.local`
- [ ] Try sending SMS → should show error toast
- [ ] Restore credentials
- [ ] Try with invalid phone number format → should show error

#### 6. **Test Character Limits**
- [ ] Create template with exactly 160 characters → should show green
- [ ] Add 1 more character (161) → should show red warning
- [ ] Create template with 200+ characters → verify multiple SMS warning

### Test Data Examples

**Test Customer:**
```sql
INSERT INTO customers (name, email, mobile, sms_notification)
VALUES ('Test Customer', 'test@example.com', '+36301234567', true);
```

**Test SMS Template:**
```
Kedves {customer_name}! A {order_number} rendelesed kesz. Tel: +36301234567
```
(Exactly 79 characters with sample data)

---

## Troubleshooting

### Issue: SMS Not Appearing in Modal

**Possible Causes:**
1. Customer doesn't have `sms_notification = true`
2. Customer doesn't have a mobile number
3. Order status is not `in_production`
4. API endpoint `/api/orders/sms-eligible` is failing

**Debugging Steps:**
```sql
-- Check customer eligibility
SELECT 
  c.name, 
  c.mobile, 
  c.sms_notification,
  q.status,
  q.order_number
FROM quotes q
JOIN customers c ON q.customer_id = c.id
WHERE q.id = 'YOUR_ORDER_ID';
```

### Issue: SMS Sent But Not Received

**Possible Causes:**
1. Phone number format is incorrect
2. Phone number is blocked by carrier
3. Twilio account has insufficient credits
4. Country restrictions

**Debugging Steps:**
1. Check Twilio Dashboard → Logs → SMS Logs
2. Look for the message SID from console logs
3. Check delivery status
4. Verify phone number is active and can receive SMS

### Issue: Multiple SMS Received

**Possible Causes:**
1. Message exceeds 160 characters
2. Unicode characters are being used (reduces limit to 70)

**Solution:**
- Keep template under 160 characters
- Use ASCII equivalents for special characters
- Check character counter on `/notifications` page

### Issue: Wrong Company Name in SMS

**Possible Causes:**
1. `tenant_company` table has incorrect data
2. Database query is failing

**Debugging Steps:**
```sql
-- Check company name
SELECT name FROM tenant_company LIMIT 1;
```

**Solution:**
- Update company name in `tenant_company` table
- Ensure company name is set correctly

### Issue: Template Changes Not Applied

**Possible Causes:**
1. Template not saved properly
2. Cache not cleared
3. Using old deployment

**Solution:**
- Re-save template on `/notifications` page
- Clear browser cache
- Restart Next.js server (local) or redeploy (production)
- Check server logs for save errors

---

## Security Considerations

### 1. **Twilio Credentials**
- ✅ Never commit credentials to Git
- ✅ Store in `.env.local` (local) and Vercel (production)
- ✅ Rotate credentials periodically
- ✅ Use Twilio's IP whitelisting if available

### 2. **Phone Number Privacy**
- ✅ Phone numbers only visible to authenticated users
- ✅ SMS only sent from server-side (API routes)
- ✅ No phone numbers exposed in client-side code

### 3. **Rate Limiting**
- ⚠️ Currently no rate limiting on SMS sending
- 📝 Consider implementing in future:
  - Limit SMS per customer per day
  - Limit total SMS per hour
  - Cooldown period between SMS

### 4. **User Permissions**
- ✅ `/notifications` page requires authentication
- ✅ Can be restricted per user via permissions system
- ✅ SMS sending only from `/scanner` page (implicit admin access)

---

## Future Enhancements

### Planned Features
- [ ] **SMS Templates Library**: Multiple templates for different scenarios
- [ ] **SMS History**: Log all sent SMS with timestamps and status
- [ ] **Bulk SMS**: Send promotional SMS to all customers
- [ ] **SMS Scheduling**: Schedule SMS for specific times
- [ ] **Delivery Reports**: Track SMS delivery status in UI
- [ ] **Customer Reply Handling**: Webhook for incoming SMS
- [ ] **Multi-language SMS**: Templates in different languages
- [ ] **SMS Analytics**: Dashboard showing sent/delivered/failed counts
- [ ] **Cost Tracking**: Monitor SMS costs per customer/month

### Known Limitations
- ⚠️ No SMS history/logging in database
- ⚠️ No retry mechanism for failed SMS
- ⚠️ No delivery confirmation tracking
- ⚠️ Only supports single SMS template
- ⚠️ No character encoding auto-detection

---

## Deployment Checklist

### Before Production Deployment

- [ ] Set Twilio environment variables in Vercel
- [ ] Test SMS sending in development
- [ ] Verify all customers have correct phone number format
- [ ] Set default SMS template
- [ ] Test permission system
- [ ] Review character limits and costs
- [ ] Ensure Twilio account has sufficient credits
- [ ] Configure Twilio number with SMS capability
- [ ] Test error handling scenarios
- [ ] Review SMS logs in Twilio Dashboard

### After Production Deployment

- [ ] Monitor SMS sending success rate
- [ ] Check for failed SMS and investigate
- [ ] Review Twilio costs weekly
- [ ] Collect user feedback on SMS content
- [ ] Adjust template based on feedback
- [ ] Monitor character counts (are messages being split?)

---

## Support & Maintenance

### Monitoring
- **Twilio Dashboard**: Monitor sent/delivered/failed SMS
- **Server Logs**: Check for SMS sending errors
- **Toast Notifications**: User-facing feedback on success/failure

### Maintenance Tasks
- **Weekly**: Review failed SMS and investigate causes
- **Monthly**: Check Twilio costs and usage
- **Quarterly**: Review and update SMS template based on feedback
- **Yearly**: Rotate Twilio credentials

### Contact
For issues or questions, contact the development team or refer to:
- [Twilio Documentation](https://www.twilio.com/docs/sms)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- Internal project documentation

---

## Conclusion

The SMS notification system provides a seamless way to automatically notify customers when their orders are ready. With full customization through the `/notifications` page and robust error handling, it ensures reliable communication while maintaining security and user control.

**Key Takeaways:**
- ✅ Fully automated SMS on order completion
- ✅ Customizable templates with dynamic variables
- ✅ User confirmation before sending
- ✅ Comprehensive error handling
- ✅ Permission-based access control
- ✅ Real-time preview and validation

**Next Steps:**
1. Configure Twilio credentials
2. Set custom SMS template
3. Enable SMS for customers
4. Test thoroughly in development
5. Deploy to production

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-23  
**Author**: Development Team
