# Storage Column Feature - Tárolás

## Overview
This document describes the implementation of the "Tárolás" (Storage) column in the main app's orders list page. This column displays how many days an order has been in "Kész" (ready) status, helping track storage time and identify orders that need to be delivered.

## Feature Location
- **Page**: `/orders` (Main App)
- **File**: `main-app/src/app/(dashboard)/orders/OrdersListClient.tsx`
- **URL**: `http://localhost:3000/orders` (Development)
- **URL**: `https://app.turinova.hu/orders` (Production)

---

## Table Structure

### Previous Table Columns (Before):
1. ☑️ Checkbox
2. Megrendelés száma
3. Ügyfél neve
4. Végösszeg
5. Fizetési állapot
6. Rendelés állapota
7. **Módosítva** ← REMOVED
8. Vonalkód
9. Gép
10. Gyártás dátuma

### New Table Columns (After):
1. ☑️ Checkbox
2. Megrendelés száma
3. Ügyfél neve
4. Végösszeg
5. Fizetési állapot
6. Rendelés állapota
7. **Tárolás** ← NEW COLUMN
8. Vonalkód
9. Gép
10. Gyártás dátuma

---

## Feature Specifications

### 1. Display Logic
The "Tárolás" column displays different content based on order status:

- **When status is "Kész" (ready)**: Shows a colored chip with the number of storage days
- **For all other statuses**: Shows a gray dash "-" to indicate not applicable

### 2. Storage Days Calculation

```typescript
// Use production_date if available, otherwise fall back to updated_at
const referenceDate = order.production_date || order.updated_at
const today = new Date()
const readyDate = new Date(referenceDate)
const diffTime = today.getTime() - readyDate.getTime()
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
```

**Reference Date Priority**:
1. **Primary**: `production_date` - More accurate as it represents when the order was completed
2. **Fallback**: `updated_at` - Used if production_date is not set

**Calculation Method**:
- **Type**: Calendar days (not business days)
- **Formula**: Floor of (Today - Reference Date) in days
- **Time Zone**: Uses local browser time zone

### 3. Color Coding

The chip color changes based on storage duration to provide visual urgency indicators:

| Days in Storage | Color | Chip Color Code | Meaning |
|----------------|-------|-----------------|---------|
| 0 - 3 days | 🟢 Green | `success` | Freshly ready, optimal |
| 4 - 7 days | 🟠 Orange | `warning` | Getting old, needs attention |
| 8+ days | 🔴 Red | `error` | Too long in storage, urgent! |

```typescript
const color = diffDays <= 3 ? 'success' : 
              diffDays <= 7 ? 'warning' : 'error'
```

### 4. Display Format

**For "Kész" status orders**:
```tsx
<Chip 
  label={`${diffDays} nap`}
  color={color}
  size="small"
/>
```

**For other status orders**:
```tsx
<Typography variant="body2" color="text.secondary">-</Typography>
```

---

## Implementation Details

### Code Location
- **File**: `main-app/src/app/(dashboard)/orders/OrdersListClient.tsx`
- **Lines**: ~704 (header), ~793-817 (cell rendering)

### Table Header
```tsx
<TableCell><strong>Tárolás</strong></TableCell>
```

### Cell Rendering
```tsx
{/* Storage Days - Only for 'ready' status */}
<TableCell onClick={() => handleRowClick(order.id)}>
  {order.status === 'ready' ? (() => {
    // Use production_date if available, otherwise fall back to updated_at
    const referenceDate = order.production_date || order.updated_at
    const today = new Date()
    const readyDate = new Date(referenceDate)
    const diffTime = today.getTime() - readyDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    // Color coding based on storage days
    const color = diffDays <= 3 ? 'success' : 
                  diffDays <= 7 ? 'warning' : 'error'
    
    return (
      <Chip 
        label={`${diffDays} nap`}
        color={color}
        size="small"
      />
    )
  })() : (
    <Typography variant="body2" color="text.secondary">-</Typography>
  )}
</TableCell>
```

---

## User Experience

### Visual Examples

#### Example 1: Fresh Order (2 days in storage)
```
┌────────────┬─────────┐
│ Rendelés   │ Tárolás │
│ állapot    │         │
├────────────┼─────────┤
│ Kész       │ [2 nap] │ ← Green chip
│ (blue)     │ (green) │
└────────────┴─────────┘
```

#### Example 2: Aging Order (5 days in storage)
```
┌────────────┬─────────┐
│ Rendelés   │ Tárolás │
│ állapot    │         │
├────────────┼─────────┤
│ Kész       │ [5 nap] │ ← Orange chip
│ (blue)     │ (orange)│
└────────────┴─────────┘
```

#### Example 3: Urgent Order (12 days in storage)
```
┌────────────┬─────────┐
│ Rendelés   │ Tárolás │
│ állapot    │         │
├────────────┼─────────┤
│ Kész       │[12 nap] │ ← Red chip
│ (blue)     │  (red)  │
└────────────┴─────────┘
```

#### Example 4: Order Not Ready Yet
```
┌────────────┬─────────┐
│ Rendelés   │ Tárolás │
│ állapot    │         │
├────────────┼─────────┤
│ Gyártásban │    -    │ ← Gray dash
│ (orange)   │  (gray) │
└────────────┴─────────┘
```

---

## Business Logic

### Why This Feature?
- **Inventory Management**: Track how long completed orders are stored
- **Customer Service**: Identify orders ready for pickup/delivery
- **Warehouse Efficiency**: Prioritize delivery of older orders
- **Visual Alerts**: Color coding provides instant recognition of urgency

### Thresholds Rationale
- **0-3 days (Green)**: Normal completion-to-delivery timeframe
- **4-7 days (Orange)**: Approaching a week, customer should be contacted
- **8+ days (Red)**: Excessive storage time, requires immediate action

---

## Database Fields Used

### Order Interface
```typescript
interface Order {
  id: string
  order_number: string
  status: string  // Key field: 'ready' status triggers calculation
  production_date: string | null  // Primary reference date
  updated_at: string  // Fallback reference date
  // ... other fields
}
```

### Required Fields
- `status`: Must be 'ready' for calculation to display
- `production_date`: Preferred reference date (can be null)
- `updated_at`: Always available as fallback

---

## Sorting and Filtering

### Sorting
- **Status**: Not sortable (by design)
- **Reason**: Column is informational only, no user-requested sorting functionality

### Filtering
- Users can filter by "Kész" status using the status filter chips
- This will show only orders with storage days displayed

---

## Edge Cases Handled

### 1. No Production Date
```typescript
const referenceDate = order.production_date || order.updated_at
```
Falls back to `updated_at` to ensure calculation always works

### 2. Future Dates (Time Zone Issues)
```typescript
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
```
Using `Math.floor()` ensures negative values from clock skew round to 0

### 3. Same Day Completion
- Order completed today → Shows "0 nap" (green chip)
- Still visible to user rather than being hidden

### 4. Non-Ready Status
```typescript
{order.status === 'ready' ? (...) : (
  <Typography variant="body2" color="text.secondary">-</Typography>
)}
```
Gracefully shows dash for other statuses

---

## Testing Checklist

### Manual Testing
- [ ] Open `/orders` page
- [ ] Filter by "Kész" status
- [ ] Verify storage days are displayed
- [ ] Check color coding matches thresholds:
  - [ ] 0-3 days: Green chip
  - [ ] 4-7 days: Orange chip
  - [ ] 8+ days: Red chip
- [ ] Filter by other statuses (Megrendelve, Gyártásban)
- [ ] Verify dash "-" is displayed for non-ready orders
- [ ] Click on row to verify navigation still works

### Data Validation
- [ ] Orders with `production_date`: Uses production_date
- [ ] Orders without `production_date`: Uses updated_at
- [ ] Recent orders show 0-1 days correctly
- [ ] Old orders (8+ days) show red chips

---

## Performance Considerations

### Client-Side Calculation
- Calculation happens in the browser for each row
- Uses inline IIFE (Immediately Invoked Function Expression)
- No additional API calls required
- Minimal performance impact (simple date arithmetic)

### Scalability
- Calculation is O(1) per order
- Works efficiently with pagination (20 orders per page)
- No database changes required

---

## Future Enhancements (Not Implemented)

### Potential Improvements
1. **Status History Tracking**: Store timestamp when status changes to 'ready'
   - Would require new column: `status_changed_at`
   - More accurate than production_date/updated_at
   
2. **Business Days Calculation**: Skip weekends/holidays
   - More complex logic required
   - Would need holiday calendar
   
3. **Configurable Thresholds**: Admin settings for color thresholds
   - Allow customization of 3/7 day thresholds
   - Stored in settings table
   
4. **Sorting Capability**: Sort by storage days
   - Would require server-side calculation
   - Database query modifications needed

---

## Related Documentation
- [DEPLOYMENT_WORKFLOW_GUIDE.md](../DEPLOYMENT_WORKFLOW_GUIDE.md) - How to deploy changes
- [Permission System](./permission-system.md) - Access control implementation
- [Chat History](./chat-history-permission-system.md) - Development conversation history

---

## Changelog

### 2025-10-23 - Initial Implementation
- **Added**: "Tárolás" column to orders list
- **Removed**: "Módosítva" column from orders list
- **Implemented**: Color-coded chip display (green/orange/red)
- **Implemented**: Conditional rendering based on 'ready' status
- **Implemented**: Production date with updated_at fallback logic

---

## Maintenance Notes

### If Calculation Logic Needs Changes

**To modify thresholds**:
```typescript
// Current thresholds
const color = diffDays <= 3 ? 'success' :   // Change 3 to new value
              diffDays <= 7 ? 'warning' :   // Change 7 to new value
              'error'
```

**To change display format**:
```typescript
// Current: "X nap"
label={`${diffDays} nap`}

// Example: "X days" or "X d"
label={`${diffDays} days`}
label={`${diffDays}d`}
```

**To use business days instead of calendar days**:
Would require implementing a business day calculator function that accounts for weekends and holidays.

---

## Contact
For questions about this feature, refer to:
- **Implementation**: OrdersListClient.tsx
- **Database Schema**: quotes table (production_date, updated_at fields)
- **Business Logic**: This documentation

