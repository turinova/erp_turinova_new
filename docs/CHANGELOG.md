# Changelog

All notable changes to the Turinova ERP system will be documented in this file.

---

## [2025-01-28] - Inline Production Editing & Bulk Assignment

### Added
- **Inline Production Editing on /orders page**: Fast bulk production assignment workflow
  - Customer name tooltip showing mobile + email on separate lines
  - Status filter chips with live counts (Összes, Megrendelve, Gyártásban, Kész, Lezárva)
  - Instant client-side filtering by order status
  - Three new editable columns: Vonalkód, Gép, Gyártás dátuma
  - Auto-save on barcode blur (Tab or click out)
  - Smart defaults: First machine + Next business day
  - Barcode deletion reverts status to 'ordered'
  - Per-row loading indicators
  - No modal needed - all editing inline
  - Physical barcode scanner optimized
  - Bulk workflow: Scan → Tab → Scan → Tab (rapid entry)
- **Production Assignment Modal (Gyártásba adás)**: Complete production machine assignment system
  - Machine dropdown from `production_machines` table
  - Date picker with smart business day calculation (skip weekends)
  - Barcode input for physical scanner integration
  - Edit/Delete functionality for existing assignments
  - Status changes: `ordered` → `in_production`
- **Code 128 Barcode Display**: Scannable barcode on order detail pages
  - Positioned next to company info in same row
  - Only displays when barcode exists (after production assignment)
  - Print-friendly white background
  - Responsive layout (side-by-side desktop, stacked mobile)
  - Supports alphanumeric characters (more flexible than EAN-13)
- **Production Info Card**: New card displaying machine, date, and barcode details
  - Appears on order detail page after production assignment
  - Located above payment history card

### Features
- **Business Day Calculation**: Smart date defaulting
  - Friday → Monday (skip weekend)
  - Saturday/Sunday → Monday
  - Other days → Next day
- **Always Visible Button**: "Gyártásba adás" button always shown on order pages
- **Edit Mode**: Modal pre-populates with existing data
- **Delete Assignment**: "Gyártás törlése" button reverts status to 'ordered'
- **No Capacity Validation**: Unlimited machine assignments allowed per day

### API Endpoints
- **PATCH /api/quotes/[id]/production**: Assign/update production
  - Updates `production_machine_id`, `production_date`, `barcode`
  - Changes status to `in_production`
  - Performance: ~460ms average
- **DELETE /api/quotes/[id]/production**: Remove production assignment
  - Clears production fields
  - Reverts status to `ordered`
  - Performance: ~300ms average

### Dependencies
- `@mui/x-date-pickers@^8.14.0` - DatePicker component
- `date-fns@^4.1.0` - Date manipulation and Hungarian locale
- `react-barcode@^1.6.1` - Code 128 barcode generation

### UI/UX
- Modal with 3 required fields (machine, date, barcode)
- Dynamic title: "Gyártásba adás" vs "Gyártás módosítása"
- Orange warning color for button
- Auto-focus on barcode field for scanner
- Production info card with machine, date, barcode details
- Code 128 barcode displayed with value below
- Responsive grid layout for barcode display
- Wider bars (width=2) for better Code 128 readability

### Database Updates
- `quotes.production_machine_id` (FK to production_machines)
- `quotes.production_date` (DATE)
- `quotes.barcode` (TEXT)
- Added to `getQuoteById()` SSR query

### Integration
- Server-side data fetching for machines (SSR)
- Modal integrated into order detail page
- Barcode dynamically imported (SSR-safe)
- Production info fetched and displayed on order pages

### Documentation
- `docs/PRODUCTION_ASSIGNMENT_FEATURE_2025-01-28.md` - Complete feature documentation
- `docs/BARCODE_DISPLAY_FEATURE_2025-01-28.md` - Barcode implementation guide
- `PRODUCTION_ASSIGNMENT_IMPLEMENTATION_SUMMARY.md` - Quick reference

---

## [2025-01-28] - Add Payment Feature

### Added
- **Add Payment Modal**: Comprehensive payment addition interface for orders
- **Remaining Balance Display**: Prominent display of amount owed (Hátralék)
- **Auto-Validation**: Automatic capping of amounts exceeding remaining balance
- **Refund Support**: Negative amounts allowed for customer refunds
- **Real-time Preview**: Shows new payment status and remaining balance before saving
- **Payment Method Selection**: Dropdown with Készpénz, Utalás, Bankkártya options

### Features
- **Auto-Cap Amount**: If user enters more than remaining, automatically formats to max remaining
- **Negative Amounts**: Supports refunds (e.g., -10,000 Ft for damaged goods)
- **Exact Remaining**: Allows paying exactly the remaining balance
- **Payment Status Preview**: Shows "Kifizetve" or "Részben fizetve" before submitting
- **Immediate Update**: Payment history and status chips update after adding payment
- **Smooth UX**: No page reload, instant feedback via toast

### API Endpoint
- **POST /api/quotes/[id]/payments**: Add payment with validation
  - Validates amount against remaining balance
  - Prevents overpayment (positive amounts only)
  - Allows refunds (negative amounts)
  - Auto-updates payment_status via trigger
  - Performance: ~40ms average

### UI/UX
- Summary card shows: Végösszeg, Eddig fizetve, Hátralék (color-coded)
- Amount input accepts positive/negative/decimal
- Real-time alert with new status and remaining
- Helper text guides user (positive for payment, negative for refund)
- Button disabled during submission with loading spinner

### Integration
- "Fizetés hozzáadás" button on order detail page
- Opens AddPaymentModal with current payment state
- Refreshes data after successful payment
- Updates payment history card immediately
- Payment status chip reflects new status

### Validation
- Positive amounts: Cannot exceed remaining balance (auto-cap)
- Negative amounts: No limit (refunds)
- Payment method: Required
- Comment: Optional

### Documentation
- Created `ADD_PAYMENT_FEATURE_2025-01-28.md` - Complete feature documentation

---

## [2025-01-28] - Critical Fix: Quote Total Recalculation

### Fixed
- **Quote Total Calculation Bug**: Fixed critical issue where editing quotes/orders in Opti excluded fees and accessories from final_total_after_discount
- **Root Cause**: POST /api/quotes was calculating total as `materials × discount` instead of `(materials + fees + accessories) × discount`
- **Impact**: Wrong totals displayed, incorrect payment status, unreliable invoicing
- **Solution**: Call `recalculateQuoteTotals()` after saving quote updates to include all components

### Technical Details
- Added recalculation call in POST /api/quotes when updating existing quotes
- Performance impact: +20-30ms per update (acceptable for correctness)
- Affects: Order editing, payment status calculation, list display totals
- Bug severity: Critical (financial accuracy)
- All test cases passing

### Example
**Before:** Order with 37k materials + 31k fees + 158k accessories = Total showed 30k ❌  
**After:** Same order = Total shows 182k ✅

### Documentation
- Created `QUOTE_TOTAL_RECALCULATION_FIX_2025-01-28.md` - Complete analysis and fix documentation

---

## [2025-01-28] - Order Management System (Complete)

### Added
- **Order Management System**: Complete workflow from quotes to production tracking
- **Simplified Architecture**: Orders ARE quotes with enhanced status tracking (no data duplication)
- **Order Creation**: "Megrendelés" button converts quotes to orders with initial payment
- **Orders List Page** (`/orders`): Displays all orders with status and payment tracking
- **Order Detail Page**: Same component as quote detail, with status-based button visibility
- **Payment Tracking**: Multiple payments per order with auto-calculated payment status
- **Payment History**: Display all payments with info tooltips showing method and comments
- **Production Fields**: Added to quotes table (machine, date, barcode) for future production tracking
- **Status-Based Permissions**: Opti and Discount editing locked when status = 'in_production' or higher

### Database Changes
- **Enhanced quotes table**: Added `order_number`, `barcode`, `production_machine_id`, `production_date`, `payment_status`
- **Quote Payments table**: Renamed from `order_payments`, links to quotes table
- **Status Enum**: Added values: 'ordered', 'in_production', 'ready', 'finished', 'cancelled'
- **Dropped tables**: `orders`, `order_status_history` (unnecessary duplication)
- **New function**: `generate_quote_order_number()` - Auto-generate ORD-YYYY-MM-DD-NNN format
- **New trigger**: `update_quote_payment_status()` - Auto-calculate payment status from payments
- **Indexes**: Added for order_number, barcode, payment_status, production fields

### API Changes
- **POST /api/orders**: Convert quote to order with initial payment
- **GET /api/orders**: List orders with pagination and search
- **Modified POST /api/quotes**: Preserve status when updating (don't reset to draft)
- **Modified PATCH /api/quotes/[id]**: Update both quote and customer discount
- **Modified getQuoteById()**: Fetch order_number, payment_status, and payments (7th parallel query)

### Frontend Changes
- **CreateOrderModal**: Beautiful modal with payment form, real-time status calculation
- **OrdersListClient**: Orders list with search, pagination, status chips
- **OrderDetailClient**: Wrapper for QuoteDetailClient with isOrderView prop
- **QuoteDetailClient**: Enhanced with conditional rendering based on isOrderView and status
  - Title: "Megrendelés: ORD-XXX" vs "Árajánlat: Q-XXX"
  - Status chips: Color-coded (red/green/orange/blue)
  - Buttons: Show/hide based on status and view type
  - Payment history card: Compact 3-column table with info tooltips
  - Opti/Discount lock: Disabled when in_production+
- **OptiClient**: Smart redirect (orders → /orders, quotes → /quotes)
- **Navigation**: Added "Megrendelések" menu item with green shopping cart icon

### Workflow
```
Draft Quote → [Megrendelés] → Ordered → [Gyártásba adás] → In Production → Ready → Finished
   ↓              ↓              ↓                            ↓
Editable    Semi-editable   Opti Locked                  Fully Locked
```

### Permission Rules
- **Status = ordered**: Opti ✅, Discount ✅, Fees ✅, Accessories ✅
- **Status = in_production+**: Opti 🔒, Discount 🔒, Fees ✅, Accessories ✅
- **Status = finished**: Everything 🔒, only Payments ✅

### UI Improvements
- **Status chips**: Consistent color coding (draft=red, ordered=green, etc.)
- **Payment history**: Clean 3-column layout with info icon tooltips
- **Conditional buttons**: Show only relevant actions based on status
- **Smart navigation**: Back button goes to correct list page
- **Info cards**: Show order_number, payment_status for orders

### Bug Fixes
- Fixed status reset to 'draft' when editing orders
- Fixed redirect to wrong page after Opti editing
- Fixed order_number showing as NULL
- Fixed NaN in final total calculation
- Fixed currency_id NULL constraint violations
- Fixed hydration error (Chip in Typography)
- Fixed empty tooltip (React element → string)
- Fixed customer discount not syncing

### Performance
- Order creation: ~30-50ms
- Orders list: ~100-150ms
- Order detail: ~250-450ms (7 parallel queries)
- 70-80% faster than initial complex design

### Documentation
- Created `ORDER_SYSTEM_COMPLETE_2025-01-28.md` - Complete technical documentation (850+ lines)
- Created `chat-archives/2025-01-28-order-system-implementation.md` - Development history
- Created `SIMPLIFIED_ORDER_SYSTEM.md` - Architecture overview

---

## [2025-01-27] - Cutting List (Szabásjegyzék) Display

### Added
- **Cutting List Section**: New "Szabásjegyzék" card on quote detail page
- **Comprehensive Panel Data**: Displays all panels with machine codes and services
- **Machine Code Integration**: Material and edge material machine codes from mapping tables
- **Edge Material Display**: Shows machine codes for all 4 edges (Hosszú alsó, Hosszú felső, Széles bal, Széles jobb)
- **Services Display**: Icon-based display with tooltips (Pánthelyfúrás 🎯, Duplungolás 🔢, Szögvágás ✂️)

### Table Structure
**Columns:**
1. Anyag (Material machine code from machine_material_map)
2. Hosszúság (Panel width_mm, no "mm" unit)
3. Szélesség (Panel height_mm, no "mm" unit)
4. Darab (Panel quantity, no "db" unit)
5. Jelölés (Panel label or "-")
6. Hosszú alsó (Edge A machine code - Top, empty if none)
7. Hosszú felső (Edge C machine code - Bottom, empty if none)
8. Széles bal (Edge B machine code - Left, empty if none)
9. Széles jobb (Edge D machine code - Right, empty if none)
10. Egyéb (Services as MUI icons with tooltips)

### Display Logic
- Material: Shows machine_code from machine_material_map
- Edges: Shows machine_code from machine_edge_material_map, empty string if no edge
- Egyéb: Uses MUI icons (LocationSearchingSharpIcon, Filter2Icon, ContentCutIcon), shows "-" if none
- Units removed from dimension columns for cleaner look
- Read-only table (no buttons, no checkboxes, no search)
- Static display of all panels

### UI Styling
- **Compact table**: Small size, reduced cell padding (6px 8px)
- **Vertical borders**: All columns separated with vertical lines
- **Outer border**: 1px solid grey border around entire table
- **Font size**: 0.875rem (14px) for compact display
- **Alignment**: Numbers right-aligned, text left-aligned, icons centered

### Technical Implementation
- Updated `getQuoteById()` to fetch machine codes in parallel
- Enriched panels data with material_machine_code and edge_X_code fields
- New component: QuoteCuttingListSection.tsx
- Integrated into quote detail page below accessories
- Part of print Page 2

### Documentation
- Created `CUTTING_LIST_FEATURE_2025-01-27.md` - Complete feature documentation
- Component follows existing quote section patterns
- Machine code lookups optimized with parallel queries

---

## [2025-01-27] - Excel Export (Complete)

### Added
- **Excel Export Function**: Complete machine-ready cutting list export
- **ExcelJS Integration**: Professional Excel generation with full data population
- **Formatted Headers**: Two-row header structure with merged cells
  - Row 1: Main sections (Bútorlap, Élzárás 1-4)
  - Row 2: Sub-headers (Azonosító, Hosszúság, Szélesség, Darab, Megnevezés, Forgatható?, etc.)
- **Data Population**: Complete panel and edge material data from quote_panels
- **Machine Code Integration**: Uses machine_material_map and machine_edge_material_map
- **Edge Banding Algorithm**: PHP logic replicated for edge material grouping
- **Direct Download**: File downloads immediately with proper filename

### Excel Structure
- **18 columns total**
- **Bútorlap section** (6 columns):
  - Azonosító: Material machine code (from machine_material_map)
  - Hosszúság: Panel width_mm
  - Szélesség: Panel height_mm
  - Darab: Panel quantity
  - Megnevezés: Panel label
  - Forgatható?: I (grain_direction=true) or N (false)
- **Élzárás sections** (4 × 3 columns):
  - Hossz: Count of long edges (top + bottom) with this material
  - Szél: Count of short edges (left + right) with this material
  - Azon: Edge material machine code

### Edge Banding Logic
- Edge A (top) + Edge B (bottom) = Long edges
- Edge C (left) + Edge D (right) = Short edges
- Groups edges by material code
- Counts occurrences per group
- Up to 4 different edge materials per panel

### Technical Implementation
- **API route:** `/api/quotes/[id]/export-excel`
- **Data sources:** quote_panels, machine_material_map, machine_edge_material_map, quote_materials_pricing
- **Algorithm:** Exact replication of PHP edge banding calculation
- **Styling:** Bold headers, grey background (#E4E4E4), centered, bordered
- **Filename:** `quote_Q-2025-001.xlsx` (uses quote number)

### Documentation
- Created `EXCEL_EXPORT_COMPLETE_2025-01-27.md` - Complete implementation guide with algorithm details

---

## [2025-01-27] - Quote Print Functionality

### Added
- **Print Function**: Implemented "Nyomtatás" button functionality for quote detail page
- **2-Page Layout**: Automatic page breaks for professional printing
  - Page 1: Company info, customer/billing info, materials, services, summary (fits on one page)
  - Page 2: Fees and accessories tables (titles hidden, data only)
- **Print Optimization**: Multiple iterations to perfect the layout
- **Colspan Fix**: JavaScript dynamically adjusts table colspan values before printing

### Print Features
- Portrait A4 orientation with minimal margins (0cm top/bottom, 1cm left/right)
- Overall content scaled to 95% to fit page 1
- Page 2 tables scaled to 80% to show all columns
- Customer/Billing forced side-by-side (50% each)
- Hidden elements: buttons, checkboxes, right column, breadcrumbs, nav, page 2 card titles
- Removed: card borders and shadows for clean print
- Preserved: background colors, table styling, typography
- Perfect alignment: "Összesen" totals rows align with table columns

### Technical Implementation
- Materialize pattern: Visibility-based hiding (`body * { visibility: hidden }`)
- CSS classes: `printable-content`, `no-print`, `print-page-1`, `print-page-2`, `print-hide-actions`
- CSS media queries: `@media print` with page breaks and scaling
- JavaScript: Dynamic colspan adjustment for totals rows when checkbox column hidden
- Fixed table layout for consistent column widths

### Print Optimizations
1. Reduced margins from 2cm to 0cm (top/bottom)
2. Scaled content to 95% overall
3. Forced Grid items to 50% width (customer/billing)
4. Scaled page 2 tables to 80%
5. Hidden page 2 card titles
6. Dynamic colspan adjustment in handlePrint()

### Documentation
- Created `QUOTE_PRINT_FUNCTIONALITY_2025-01-27.md` - Complete print implementation guide with optimization journey

---

## [2025-01-27] - Quote Detail Page UI Improvements

### Added
- **Visual Hierarchy**: Framed sections for company info, customer/billing, tables, and summaries
- **Print-Friendly Design**: Grayscale color scheme for perfect B&W printing
- **Enhanced Typography**: Larger, bolder text for better readability
- **Professional Layout**: Invoice-like appearance with clear visual structure

### UI Changes
- **Company Info**: Added light grey background box with rounded corners, removed title
- **Customer & Billing**: Added equal-height frames for both sections
- **Materials & Services Tables**: Added frames, removed section titles (tables are self-explanatory)
- **Summary Title**: Center-aligned "Árajánlat összesítése"
- **Summary Breakdown**: 
  - Renamed "Anyagok" to "Lapszabászat"
  - Framed item breakdown (Lapszabászat, Díjak, Termékek)
  - Framed calculation section (Részösszeg, Kedvezmény, Végösszeg)
  - Grey highlight for Kedvezmény (#f5f5f5 background, #d0d0d0 border)
  - Darker grey highlight for Végösszeg (#e8e8e8 background, #c0c0c0 border)
- **Typography**: 
  - Item breakdown: body1 + fontWeight: 600
  - Calculations: body1 + fontWeight: 700
  - Final total: h6 + fontWeight: 700

### Technical Changes
- Grayscale palette: #fcfcfc, #fafafa, #f5f5f5, #e8e8e8, #e0e0e0, #d0d0d0, #c0c0c0
- All visual hierarchy achieved through grey shades, not colors
- Print-tested for black/white printing

### Documentation
- Created `QUOTE_DETAIL_UI_IMPROVEMENTS_2025-01-27.md` - Complete visual design guide
- Created `chat-archives/2025-01-27-quote-detail-ui-improvements.md` - Design iteration history

---

## [2025-01-27] - Universal Discount System

### Added
- **Discount on All Categories**: Apply discount percentage to materials, fees, AND accessories
- **Negative Value Exclusion**: Negative fees/accessories excluded from discount calculation
- **Editable Discount**: "Kedvezmény" button in right column to edit discount percentage
- **Clear Math Display**: Simple breakdown showing subtotal → discount → final total

### Business Logic Changes
- **Old**: Discount only on materials
- **New**: Discount on all positive values (materials + positive fees + positive accessories)
- Negative values (adjustments) added after discount without modification
- Final total can be negative (allowed)

### UI Changes
- Added "Kedvezmény (X%)" button to quote detail page right column
- New `EditDiscountModal` for changing discount percentage (0-100%)
- Updated summary display:
  - Shows: Lapszabászat, Díjak, Termékek
  - Calculates: Részösszeg (subtotal of positive values)
  - Applies: Kedvezmény (discount)
  - Results: Végösszeg (final total)

### API Changes
- **New Endpoint**: `PATCH /api/quotes/[id]` - Update discount percentage
- Updated `recalculateQuoteTotals()` to apply discount to all categories
- Server-side validation (0-100%)

### Technical Implementation
- Modified `src/app/api/quotes/[id]/fees/route.ts` - New calculation logic
- Modified `src/app/api/quotes/[id]/route.ts` - Added PATCH endpoint
- Created `src/app/(dashboard)/quotes/[quote_id]/EditDiscountModal.tsx`
- Updated `QuoteDetailClient.tsx` with new discount logic

### Documentation
- Created `DISCOUNT_SYSTEM_UPDATE_2025-01-27.md` - Complete discount logic guide

---

## [2025-01-27] - Fees and Accessories Management System

### Added
- **Fees Management**: Add predefined fees to quotes (e.g., Shipping, SOS)
- **Accessories Management**: Add accessories with quantity to quotes
- **Advanced Accessory Modal**: Autocomplete with freeSolo pattern - select existing, modify globally, or create new
- **Bulk Operations**: Select all and bulk delete for fees and accessories
- **Auto-Calculation**: Totals automatically recalculate on any change
- **SSR Optimization**: All catalog data fetched on page load for instant modal opening

### Database Changes
- Created `quote_fees` table with snapshot pricing
- Created `quote_accessories` table with quantity support
- Added totals columns to `quotes` table (fees_total_*, accessories_total_*)
- Indexes and RLS policies for security

### Technical Improvements
- **Performance**: Modal opening improved from 1.4s to instant (0ms)
- **UX**: Autocomplete pattern matches Opti page customer selector
- **Global Updates**: Modifying accessories from quote page updates master table
- **Snapshot Pricing**: Historical quotes maintain pricing integrity

### UI Changes
- Added "Díjak" card on quote detail page with bulk operations
- Added "Termékek" card on quote detail page with bulk operations
- Updated summary card to show materials (with discount), fees, accessories, and final total
- Removed "Művelet" columns from both tables for cleaner UI
- Removed redundant buttons from right column

---

## [2025-01-27] - Edge Material Ráhagyás Calculation Fix

### Fixed
- **Edge Material Pricing**: Fixed ráhagyás (overhang/allowance) calculation to multiply by panel quantity instead of counting edge segments only
- **Accessories Page**: Updated UI to match machines page exactly (button placement, search bar, table styling)
- **Toast Notifications**: Standardized accessories page to use react-toastify for consistency
- **Edit Functionality**: Fixed accessory edit form to properly pass ID for updates
- **Quote Redirect**: Restored automatic redirect to quote detail page after successful update

### Technical Changes
- Modified `calculateEdgeMaterialPricing()` in `quoteCalculations.ts` to count total panel quantity
- Updated accessories components for UI consistency and proper functionality
- Fixed OptiClient redirect logic for edit mode

### Impact
- Edge material costs now accurately reflect panel quantities
- Improved user experience with consistent UI and proper feedback
- Quote editing workflow now works seamlessly

---

## [2025-01-27] - Critical Quote Pricing System Fixes

### Fixed
- **Mixed Pricing Logic Error**
  - Materials with both panel area and full board pricing now correctly calculate `charged_sqm` and `boards_used`
  - `charged_sqm` now only includes panel area pricing (panel area × waste multiplier)
  - `boards_used` now only counts boards sold as full board pricing
  - Fixed OptiClient calculation logic to filter by pricing method

- **On-Stock False Materials Board Counting**
  - Materials with `on_stock = false` now correctly display actual board count instead of always showing `1 db`
  - Fixed `quoteCalculations.ts` to create separate board entries for each board used
  - OptiClient can now properly count boards by iterating through the `boards` array

- **Quote Detail Page Display**
  - Quote detail table now shows only `material_gross` instead of `total_gross` in "Bruttó ár" column
  - Services (cutting, edge materials, additional services) are displayed separately in "Szolgáltatások" section
  - Provides clearer separation between material costs and service costs

- **Waste Multiplier Integration**
  - Fixed `charged_area_m2` calculation to include waste multiplier directly for panel area pricing
  - Simplified net price calculation by removing redundant waste multiplier multiplication
  - Ensures accurate pricing calculations in all scenarios

### Changed
- **OptiClient.tsx**
  - Modified `chargedSqm` calculation to filter boards by `pricing_method === 'panel_area'`
  - Modified `boardsSold` calculation to filter boards by `pricing_method === 'full_board'`
  - Updated `boards_used` field in API payload to use `boardsSold` value

- **quoteCalculations.ts**
  - Fixed waste multiplier calculation for panel area pricing
  - Fixed on-stock false materials to create separate board entries instead of single virtual entry
  - Each board entry now has individual `board_id` (1, 2, 3...) for proper counting

- **QuoteDetailClient.tsx**
  - Changed table display from `pricing.total_net/total_gross` to `pricing.material_net/material_gross`
  - Services are now displayed separately in dedicated "Szolgáltatások" section

### Technical Details
- **Business Logic Clarification**:
  - Panel Area Pricing: Charge for actual panel area × waste multiplier
  - Full Board Pricing: Charge for entire board regardless of usage
  - These pricing methods are mutually exclusive in calculations, not additive

- **Display Format**: `{charged_sqm} m² / {boards_used} db`
  - Example: `1.20 m² / 2 db` (1.20 m² panel area pricing + 2 full boards sold)

- **Database Schema**: No changes required - fixes work with existing `quote_materials_pricing` table

### Testing Scenarios
- ✅ Mixed Pricing: `1.20 m² / 1 db` (correct)
- ✅ On-Stock False: `0.00 m² / 3 db` (correct)
- ✅ Panel Area Only: `2.94 m² / 0 db` (correct)
- ✅ Full Board Only: `0.00 m² / 4 db` (correct)

### Impact Assessment
- **Positive**: Accurate material quantity displays, correct pricing calculations, clear cost separation
- **Considerations**: Legacy quotes may show incorrect values until re-saved, requires re-running optimization

### Documentation
- **New Files**:
  - `docs/QUOTE_PRICING_FIXES_2025-01-27.md` - Comprehensive technical documentation
  - `docs/chat-archives/2025-01-27-quote-pricing-fixes.md` - Complete chat history archive
  - `docs/decisions/2025-01-27-quote-pricing-fixes.md` - Technical decision record

### Files Modified
1. `src/lib/pricing/quoteCalculations.ts` - Fixed waste multiplier and board creation logic
2. `src/app/(dashboard)/opti/OptiClient.tsx` - Fixed charged_sqm and boards_used calculations
3. `src/app/(dashboard)/quotes/[quote_id]/QuoteDetailClient.tsx` - Fixed table display

### Development Time
- **Session Duration**: Full day
- **Lines Modified**: ~50
- **Critical Issues Resolved**: 4
- **Business Logic Clarified**: Mixed pricing scenarios

---

## [2025-01-06d] - Quote Editing & Loading via URL

### Added
- **Quote Loading via URL Parameter**
  - Navigate to `/opti?quote_id=xxx` to load existing quote for editing
  - Server-Side Rendering (SSR) for quote data fetching (no client-side loading)
  - Automatic data population: panels, customer data, billing information
  - GET /api/quotes/[id] endpoint for fetching complete quote data
  - Quote data includes customer JOIN and panels with materials/brands JOINs

- **Edit Mode Functionality**
  - Automatic detection of edit mode via `initialQuoteData` prop
  - Edit mode state flags: `isEditMode`, `editingQuoteId`
  - Different button text: "Árajánlat frissítése" instead of "mentése"
  - Different loading text: "Frissítés..." instead of "Mentés..."
  - Different success text: "Frissítve: Q-2025-XXX" instead of "Mentve"
  - Different toast messages for update vs create

- **Data Restoration**
  - Customer dropdown auto-selects loaded customer
  - All customer form fields populated from quote data
  - All billing fields populated (Számlázási adatok accordion)
  - Panels reconstructed with correct táblásAnyag format: "Material Name (width×lengthmm)"
  - Edge materials restored for all 4 sides (A, B, C, D)
  - Additional services restored: Pánthelyfúrás, Duplungolás, Szögvágás
  - Panel labels (Jelölés) restored

- **Cache Management**
  - Session storage cleared after save (`opti-panels` key)
  - Router refresh after save to reload SSR data
  - Ensures UI stays in sync with database
  - Prevents stale data from appearing

### Changed
- **OptiClient.tsx**
  - Added `initialQuoteData` prop to component interface
  - Added quote loading useEffect hook (lines 440-510)
  - Added edit mode state variables (`isEditMode`, `editingQuoteId`)
  - Updated `saveQuote()` to pass `editingQuoteId` to API
  - Updated optimization reset logic: `setSavedQuoteNumber(null)` when re-optimizing
  - Updated button text logic with 6 different states (new/edit × before/during/after save)
  - Added cache clearing: `sessionStorage.removeItem()` + `router.refresh()`
  - Added `useRouter` hook import from 'next/navigation'

- **page.tsx (OptiPage)**
  - Added `searchParams` prop with quote_id parameter handling
  - Added SSR fetch for quote data when quote_id exists
  - Added `initialQuoteData` prop passing to OptiClient
  - Uses `cache: 'no-store'` for fresh data

- **POST /api/quotes**
  - Fixed `finalQuoteNumber` variable to capture updated quote number
  - Ensures API response always includes quote_number (was undefined on updates)
  - Different toast messages for create ("mentve") vs update ("frissítve")

### Technical Details
- **Panel Reconstruction Logic**
  - Uses `material.name` directly from materials array (already includes brand)
  - Avoids double brand name bug: NOT "Egger" + "Egger F021..." = "Egger Egger F021..."
  - Correct format: "F021 ST75 Szürke Triestino terrazzo (2070×2800mm)"
  - Material matching in optimization depends on exact name match

- **State Reset on Re-Optimization**
  - `setSavedQuoteNumber(null)` called in `optimize()` function
  - Ensures button resets to "Árajánlat frissítése" after user modifies and re-optimizes
  - Provides clear visual feedback that changes haven't been saved yet

- **Quote Update Process**
  - Same as create: DELETE old panels + pricing, INSERT new data
  - Quote ID and quote_number preserved
  - Only `updated_at` timestamp changes
  - CASCADE deletes ensure data integrity

- **Soft Delete Handling**
  - Quotes can reference soft-deleted customers (FK still valid)
  - Customer data still accessible via JOIN
  - Customer may not appear in dropdown but form fields still populate
  - User can still edit and save quote with soft-deleted customer

### API Files
- `src/app/api/quotes/[id]/route.ts` - GET endpoint for single quote (108 lines)

### Documentation Files
- `docs/QUOTE_EDITING_IMPLEMENTATION.md` - Complete technical documentation (750+ lines)
- `docs/chat-archives/2025-01-06_quote_system.md` - Updated with Session 2 (310+ new lines)

### Bug Fixes
- Fixed button showing "Frissítve" immediately on quote load
- Fixed toast showing "undefined" after quote update
- Fixed button not resetting after re-optimization
- Fixed cache not clearing after save
- Fixed material name format causing optimization failures

---

## [2025-01-06c] - Quote Saving System

### Added
- **Complete Quote/Proposal Saving System**
  - Save optimization results as formal quotes with unique numbers (Q-2025-001, Q-2025-002, etc.)
  - "Árajánlat mentése" button on `/opti` page (appears after optimization)
  - Auto-generate sequential quote numbers per year using `generate_quote_number()` database function
  - Quote status workflow: Draft → Accepted → In Production → Done → Rejected
  - Button states: Default → Loading (with spinner) → Success (shows quote number)

- **Customer Auto-Creation**
  - Automatically create new customer if user types name not in dropdown
  - Use tenant company email (`tenant_company.email`) as default for new customers
  - Store all customer data: name, email, mobile, billing address, tax number, etc.
  - Handle duplicate customer names gracefully (find and use existing)
  - Preserve all data from "Megrendelő adatai" and "Számlázási adatok" accordions

- **Complete Data Snapshots**
  - Store complete pricing at time of quote creation (immune to future price changes)
  - Material pricing snapshots: price_per_sqm, VAT rate, currency, usage_limit, waste_multi
  - Board specifications: width, length, thickness, grain_direction
  - Optimization results: boards_used, usage_percentage, charged_sqm
  - All panel specifications: dimensions, quantity, label, edges (4 sides), services
  - Edge materials breakdown: per material, per edge type, with lengths and costs
  - Additional services breakdown: Pánthelyfúrás, Duplungolás, Szögvágás with quantities and costs
  - Cutting costs: length and fees per material

- **Database Schema (6 new tables)**
  - `quotes` - Main quote table with customer, totals, status, audit trail
  - `quote_panels` - Panel specifications with edges and services
  - `quote_materials_pricing` - Complete pricing snapshot per material
  - `quote_edge_materials_breakdown` - Edge material cost details
  - `quote_services_breakdown` - Additional services cost details
  - `quote_status` ENUM type for workflow management

- **Backend Functions**
  - `getTenantCompany()` in `supabase-server.ts` - Fetch company email for defaults
  - `generate_quote_number()` SQL function - Auto-increment quote numbers per year
  - POST `/api/quotes` - Save complete quote with customer auto-creation
  - GET `/api/quotes` - List all quotes with customer join

- **Comprehensive Documentation**
  - `docs/QUOTE_SYSTEM_IMPLEMENTATION.md` - 500+ line technical documentation
  - Complete database schema documentation
  - API endpoint specifications
  - Frontend implementation details
  - Data flow diagrams
  - Testing procedures
  - Troubleshooting guide
  - Future enhancement roadmap

### Changed
- **OptiClient.tsx**
  - Added `saveQuote()` function (150+ lines) for complete quote data preparation
  - Added quote saving state management (`isSavingQuote`, `savedQuoteNumber`)
  - Save button placement: Next to "Optimalizálás" button
  - Button visibility: Only after optimization completes
  - Data mapping: Panel state → API format, QuoteResult → Database format
  - Edge material reverse lookup: Formatted name → UUID

- **Authentication in API Routes**
  - Proper authentication using `@supabase/ssr` with cookies
  - Pattern matches materials API route
  - Extracts user ID for `created_by` audit trail

### Technical Details
- **charged_sqm Logic**
  - For `on_stock=true` with panel_area pricing: Sum of (panel area × waste_multi)
  - For `on_stock=false` or full_board pricing: NULL
  - Allows exact reproduction of Árajánlat accordion display

- **Quote Editing Strategy**
  - Delete existing panels and pricing (CASCADE deletes breakdowns)
  - Re-insert all data with updated values
  - Keep same quote ID and number
  - Update `updated_at` timestamp

- **Data Integrity**
  - ON DELETE CASCADE for child tables
  - ON DELETE RESTRICT for reference data (customers, materials, edge_materials)
  - Unique constraint on quote_number
  - Indexes on all foreign keys and filter columns

### Database Files
- `create_quotes_system.sql` - Complete schema with tables, indexes, triggers, functions (280 lines)

### API Files
- `src/app/api/quotes/route.ts` - POST (save quote), GET (list quotes)

### Documentation Files
- `docs/QUOTE_SYSTEM_IMPLEMENTATION.md` - Complete technical documentation
- `docs/chat-archives/2025-01-06_quote_system.md` - Detailed chat history archive

---

## [2025-01-06b] - Opti UI/UX Improvements & Discount Calculation

### Added
- **Discount Calculation**
  - Automatic discount calculation in quote accordion header
  - Dynamic display based on "Kedvezmény (%)" field from customer data
  - Visual equation: Nettó + ÁFA = Bruttó - Kedvezmény = Végösszeg
  - Color-coded chips for each amount:
    - Nettó: Blue chip (`info.100`)
    - ÁFA: Orange chip (`warning.100`)
    - Bruttó (before discount): Grey chip (`grey.300`)
    - Kedvezmény: Red chip (`error.100`) with percentage
    - Végösszeg (final): Green chip (`success.main`) - most prominent
  - Conditional display: discount chips only show when discount > 0

- **Customer Name Validation**
  - Required field for starting optimization
  - Validation in `optimize()` function
  - Multiple levels of user feedback:
    - Field marked with asterisk (*)
    - `required` attribute on TextField
    - Red error state when empty and panels added
    - Helper text: "A megrendelő neve kötelező az optimalizáláshoz"
    - Toast notification on validation failure
    - Tooltip on disabled button
  - Button disabled when customer name is empty or whitespace only

- **Quote Calculation Display**
  - M² calculation display in quote breakdown
  - For panel area pricing: "2.45m² × 1.2 = 2.94m² (panel × hulladékszorzó)"
  - For full board pricing: "5.796m² (teljes tábla árazva)"
  - Makes pricing logic transparent to users

### Changed
- **Árajánlat Display Structure**
  - Converted from Card to Accordion component
  - `defaultExpanded` prop for open-by-default behavior
  - VÉGÖSSZEG moved from bottom to accordion header
  - Detailed breakdown (materials, edges, cutting, services) in collapsible content
  - Accordion header styling:
    - Light grey background (`grey.50`)
    - Green bottom border (`success.main`)
    - Hover effect (`grey.100`)

- **Service Icon Display**
  - Removed Chip wrapper for Duplungolás and Szögvágás
  - Used plain icons with tooltips for cleaner appearance
  - Kept Chip with label for Pánthelyfúrás (shows quantity)
  - Icon size increased to 20px for better visibility
  - Eliminated unnecessary spacing

- **Service Icon Updates**
  - Pánthelyfúrás: Changed to `LocationSearchingSharpIcon` (from hammer icon)
  - Better semantic meaning for hinge hole positioning
  - Color changed from `secondary` (grey) to `primary` (purple/blue)
  - Improved visibility while maintaining site color scheme

- **Panel Preview Edge Colors**
  - Changed from option-based colors to material-based colors
  - Each edge material UUID generates consistent color via hash function
  - Color palette: 10 distinct colors (Blue, Green, Orange, Red, Purple, Cyan, Pink, Brown, Blue Grey, Yellow)
  - Same edge material = same color consistently
  - Different edge materials = different colors
  - Applied to both edge labels and border highlights
  - `getEdgeMaterialColor()` function with hash-based color selection

### Fixed
- **Hungarian Label Translations**
  - Accordion labels now in Hungarian:
    - "No Grain" → "Nem szálirányos"
    - "Cut length:" → "Vágási hossz:"
    - "Total:" → "Összesen:"
  - Consistent language throughout interface

### UI/UX Improvements
- **Visual Hierarchy**
  - Clear equation format for pricing (+ and = symbols)
  - Stacked layout in chips (label on top, value below)
  - Larger font for final total (h6 vs body1)
  - Prominent green background for final amount

- **User Guidance**
  - Tooltip on disabled optimization button
  - Context-specific error messages
  - Required field indicators
  - Helper text for validation rules

- **Color Consistency**
  - Service icons: Primary (blue), Info (blue), Warning (orange)
  - Quote amounts: Info (blue), Warning (orange), Error (red), Success (green)
  - Edge materials: 10-color palette for distinct visualization

### Technical Details
- **Files Modified**: 1
  - `src/app/(dashboard)/opti/OptiClient.tsx`
- **Lines Modified**: ~150
- **Functions Modified**: 2
  - `optimize()` - added customer name validation
  - `getEdgeMaterialColor()` - material-based color generation
- **Components Updated**: 7
  - Service icons, Accordion, Chips, Tooltips, Labels, TextField validation
- **New Features**: 2
  - Discount calculation with visual display
  - Customer name validation with multi-level feedback
- **Development Time**: ~1 hour

### Testing
- ✅ Service icons spacing fixed
- ✅ Icons display correctly with proper colors
- ✅ Hungarian labels display correctly
- ✅ Accordion opens by default
- ✅ Discount calculation accurate (0%, 10%, 20%, 100%)
- ✅ Discount chips show/hide conditionally
- ✅ Customer name validation prevents optimization
- ✅ Error messages display in Hungarian
- ✅ Tooltip shows on disabled button
- ✅ Panel preview colors unique per edge material
- ✅ M² calculations display correctly
- ✅ All pricing equations visible and accurate

### Documentation
- **New Files**:
  - `docs/chat-archives/2025-01-06_ui_improvements_and_discount.md` - Session history
- **Updated Files**:
  - `docs/CHANGELOG.md` - This entry

---

## [2025-01-06] - Additional Services Implementation

### Added
- **Additional Services on Opti Page**
  - Three new services for panel processing:
    - **Pánthelyfúrás (Hinge Hole Drilling)**: Quantity (0, 2, 3, 4) and side (hosszú/rövid)
    - **Duplungolás (Groove Cutting)**: Boolean toggle
    - **Szögvágás (Angle Cutting)**: Boolean toggle
  - Services stored per panel in client state
  - Service data passed to optimization API
  - Services multiply by panel quantity (darab)

- **Service Pricing System**
  - New columns in `cutting_fees` table:
    - `panthelyfuras_fee_per_hole` (default: 50 HUF)
    - `duplungolas_fee_per_sqm` (default: 200 HUF)
    - `szogvagas_fee_per_panel` (default: 100 HUF)
  - All services use same VAT rate and currency as cutting fee
  - Pricing calculations in `quoteCalculations.ts`
  
- **Quote Display Enhancement**
  - New "Kiegészítő szolgáltatások" section per material
  - Individual service rows with Net/VAT/Gross breakdown
  - Summary row showing total services cost
  - Appears after "Vágási költség" and before "Anyag összesen"
  - Calculations:
    - Pánthelyfúrás: `total_holes × fee_per_hole`
    - Duplungolás: `panel_area_m² × fee_per_sqm`
    - Szögvágás: `total_panels × fee_per_panel`

- **UI Components**
  - Service selection UI in panel input section
  - Radio buttons for Pánthelyfúrás quantity and side
  - Toggle switches for Duplungolás and Szögvágás (side-by-side)
  - New "Szolgáltatások" column in panel table
  - Service icons with tooltips:
    - **Pánthelyfúrás**: `LocationSearchingSharpIcon` with quantity chip (primary color)
    - **Duplungolás**: `GridViewSharpIcon` (info color)
    - **Szögvágás**: Scissors icon (warning color)
  - Shows "-" when no services selected

### Changed
- **OptiClient.tsx**
  - Added service-related state variables
  - Extended Panel interface with service fields
  - Updated panel addition logic to include services
  - Modified quote calculation to integrate services
  - Added service icons and UI components
  
- **quoteCalculations.ts**
  - Created `ServicePricing` interface
  - Created `AdditionalServicesPricing` interface
  - Created `PanelWithServices` interface
  - Added `calculateAdditionalServices()` function
  - Updated `MaterialPricing` interface with service fields
  - Integrated services into `calculateMaterialPricing()`
  
- **supabase-server.ts**
  - Updated `getCuttingFee()` to fetch new service fee columns
  - Changed `currencies.code` to `currencies.name`

### Fixed
- **Database Column Reference**
  - Fixed SQL query using `currencies.name` instead of non-existent `currencies.code`
  
- **Cutting Length Calculation**
  - Fixed `TypeError` by using `result.metrics.total_cut_length_mm` directly
  - Removed incorrect `.reduce()` call on non-array property
  
- **React Hook Initialization**
  - Fixed `ReferenceError` by reordering useMemo hooks
  - Moved `quoteResult` useMemo after all state declarations
  
- **Variable Naming**
  - Fixed `pricing_method` vs `pricingMethod` mismatch
  - Ensured consistent snake_case usage in object properties

### UI/UX Improvements
- **Icon Spacing**
  - Removed Chip wrapper for Duplungolás and Szögvágás
  - Used plain icons with tooltips for cleaner appearance
  - Eliminated unnecessary spacing around boolean service icons
  
- **Color Visibility**
  - Changed Pánthelyfúrás chip from secondary (grey) to primary (purple/blue)
  - Improved visibility while maintaining site color scheme
  - Final color scheme:
    - Pánthelyfúrás: Primary (purple/blue) - clear and visible
    - Duplungolás: Info (blue) - distinct but harmonious
    - Szögvágás: Warning (orange) - stands out for attention

### Database Changes
- **Migration**: `add_additional_services_to_cutting_fees.sql`
  ```sql
  ALTER TABLE cutting_fees
  ADD COLUMN panthelyfuras_fee_per_hole NUMERIC(10,2) DEFAULT 50.00 NOT NULL,
  ADD COLUMN duplungolas_fee_per_sqm NUMERIC(10,2) DEFAULT 200.00 NOT NULL,
  ADD COLUMN szogvagas_fee_per_panel NUMERIC(10,2) DEFAULT 100.00 NOT NULL;
  ```
- Added column comments for documentation
- Set default values for immediate usability

### Documentation
- **New Files**:
  - `docs/ADDITIONAL_SERVICES_IMPLEMENTATION.md` - Comprehensive feature documentation
  - `docs/chat-archives/2025-01-06_additional_services.md` - Chat history and development log
- **Updated Files**:
  - `docs/CHANGELOG.md` - This entry

### Technical Details
- **Files Modified**: 3
  - `src/app/(dashboard)/opti/OptiClient.tsx`
  - `src/lib/pricing/quoteCalculations.ts`
  - `src/lib/supabase-server.ts`
- **Files Created**: 3
  - `add_additional_services_to_cutting_fees.sql`
  - `docs/ADDITIONAL_SERVICES_IMPLEMENTATION.md`
  - `docs/chat-archives/2025-01-06_additional_services.md`
- **Lines Added**: ~400
- **Lines Modified**: ~150
- **Functions Added**: 2
- **Interfaces Added**: 4
- **Development Time**: ~2 hours 45 minutes

### Testing
- ✅ Service selection UI functional
- ✅ Icon display correct with tooltips
- ✅ Quote calculations accurate
- ✅ Services multiply by panel quantity
- ✅ VAT calculation correct (27%)
- ✅ Currency display correct (HUF)
- ✅ No console errors
- ✅ Performance acceptable

### Future Enhancements
- Admin UI for managing service fees
- Save services with optimization results
- Service usage analytics
- Volume discounts
- Service bundles

---

## [2025-10-02] - Active Field & Action Button Improvements

### Added
- **Material Active Field**
  - New `active` boolean field in `materials` table (default: TRUE)
  - Inactive materials excluded from optimization
  - Filter dropdown on materials list page (Összes/Aktív/Inaktív)
  - "Aktív" column in materials table
  - Switcher in "Alapadatok" card (edit page)
  - Excel import/export includes "Aktív" column
  - Validation: Must be "Igen" or "Nem" on import
  
- **Optimization Filtering**
  - Opti page "Táblás anyag" dropdown now shows only active materials
  - `activeMaterials` computed array filters inactive materials
  - Prevents inactive materials from being used in calculations

### Changed
- **Action Buttons UX**
  - Moved "Mentés" and "Mégse" buttons to top-right header
  - Always visible, no need to scroll to bottom
  - Consistent placement on edit and new material pages
  - Client-side rendering wrapped in `{mounted}` to prevent hydration

### Technical Details
- **Files Modified**: 10
- **Files Created**: 1 (`add_active_field_to_materials.sql`)
- **Commit**: `44e1afe`
- **SSR**: All queries updated to include `active` field
- **API**: Export filter supports `active` parameter

---

## [2025-10-01] - Media Library & SSR Implementation

### Added
- **Media Library Page** (`/media`)
  - List all uploaded images from materials bucket
  - Upload multiple .webp files (max 1 MB each)
  - Bulk delete functionality
  - Search by filename
  - Full-size image modal viewer
  - Copy filename button for Excel integration
  
- **Database: `media_files` Table**
  - Tracks original filenames (Supabase renames to UUIDs)
  - Stores metadata: size, upload date, mimetype
  - Enables filename-based matching for imports
  
- **MediaLibraryModal Component**
  - Reusable image picker for material pages
  - Grid view with search
  - Integrated into material edit/new pages
  - "Média könyvtárból választás" button

- **Excel Import/Export: Image Support**
  - Export includes "Kép fájlnév" column
  - Import validates filename exists in Media library
  - Auto-updates `image_url` on import if filename provided

- **Price History: Import Tracking**
  - Material price changes via import now logged to `material_price_history`
  - Tracks old price → new price with timestamp and user

### Changed
- **Media Page: Converted to SSR**
  - Added `getAllMediaFiles()` in `supabase-server.ts`
  - Data fetched server-side for faster initial load
  - Performance: 3-220ms (SSR) vs 1000ms+ (client fetch)
  
- **Navigation: Added Media Menu Item**
  - Under "Törzsadatok" category
  - Permissions bypassed (same as materials page)

### Fixed
- Hydration errors on material edit/new pages (wrapped MediaLibraryModal button in `mounted` check)
- HTML nesting error in image modal (`<h6>` inside `<h2>`)
- Breadcrumb icons removed for cleaner UI
- Copy button now copies filename (not URL) for easier Excel workflow

### Technical Details
**Files Created**: 9  
**Files Modified**: 9  
**Commits**: `863cb85`, `4752191`  
**Performance**: Media page now loads in ~3ms (cached) vs 1000ms+ before

---

## [Earlier] - Material Pricing System

### Added
- **Material Pricing Fields**
  - `price_per_sqm` (Ár/m²)
  - `currency_id` (foreign key to `currencies` table)
  - `vat_id` (foreign key to `vat` table)
  - Auto-calculated full board cost display
  
- **Price History Tracking**
  - New table: `material_price_history`
  - Logs: old price, new price, changed_by, changed_at
  - Display last 10 changes on material edit page
  - Read-only table, kept forever
  
- **Pricing UI Card**
  - "Árazási beállítások" on material edit page
  - Fields: price per m², currency dropdown, VAT dropdown
  - Live calculation of full board cost
  - Price history table with gross prices
  
### Changed
- **Materials List**: Added "Bruttó ár/m²" column
- **Defaults**: New materials default to 0 Ft/m², HUF, 27% VAT
- **API Endpoints**: Updated to include pricing fields

---

## [Earlier] - Material Page Restructuring

### Changed
- **Material Edit Page Layout**
  - Moved "Raktáron" switcher to "Alapadatok" card
  - Created "Export beállítások" card for Gépkód
  - Reorganized "Optimalizálási beállítások" card
  - "Szálirány" and "Forgatható" side-by-side in third row
  - All cards have consistent margins and styling

### Added
- **Usage Limit Field** (`usage_limit`)
  - Percentage value (e.g., 0.65 for 65%)
  - "Kihasználtság küszöb" in optimization settings
  - Stored in `material_settings` table

---

## [Earlier] - Material Import/Export System

### Added
- **Excel Export**
  - Format: XLSX
  - All editable fields except image
  - Filter support: Export only filtered records
  - Filters: Brand, Length, Width, Thickness
  
- **Excel Import**
  - Match by `gépkód` (machine_code)
  - Update existing or create new
  - Auto-create brands if missing
  - Preview table before confirming
  - Comprehensive validation (rejects if ANY required field missing)
  
- **Filter Functionality**
  - Filter materials by brand, dimensions
  - Client-side filtering (instant)
  - Export respects active filters

### Fixed
- Import preview correctly identifies existing vs new materials
- Soft-deleted materials excluded from matching
- "Bruttó ár/m²" column persistence after import

---

## [Earlier] - New Material Creation & Bulk Delete

### Added
- **New Material Page** (`/materials/new`)
  - Similar to edit page
  - All fields required except image
  - Validation before save
  - Auto-redirect to edit page after creation
  
- **Bulk Delete**
  - Select multiple materials on list page
  - Soft delete (sets `deleted_at` timestamp)
  - "Kijelöltek törlése" button
  - Confirmation dialog

### Fixed
- Client-side validation for all required fields
- Prevent saving without gépkód
- POST endpoint returns new material ID
- Proper error handling

---

## [Earlier] - Permission System Fix

### Fixed
- **Opti Page Redirect Issue**
  - Problem: Refreshing `/opti` redirected to `/users`
  - Cause: Race condition with permissions loading
  - Solution: Check `permissionsLoading` state before redirect
  - Added loading spinner during permission check

---

## [Earlier] - Server Startup & Dependencies

### Fixed
- Development server startup issues
- Removed broken `@turinova/optimizer-sdk` dependency
- Fixed MUI icon imports (ExpandMore)
- Cleared macOS metadata files (`._*`)
- Webpack cache issues resolved

### Changed
- Migration from PHP to Node.js optimization library
- Removed Redis caching dependency
- Removed PHP service entirely

---

## Database Schema Changes

### Tables Created
1. `media_files` - Image metadata tracking
2. `material_price_history` - Price change audit log
3. `currencies` - Currency reference data
4. `vat` - VAT rate reference data

### Tables Modified
1. `materials` - Added pricing columns, `usage_limit`, `active` field
2. `material_settings` - Added `usage_limit` column

### Migrations Applied
1. `20251001_add_material_pricing.sql` - Pricing system
2. `create_media_files_table.sql` - Media tracking
3. `add_usage_limit_to_materials.sql` - Usage limit field
4. `add_active_field_to_materials.sql` - Active status field

---

## Performance Optimizations

### SSR Implementation
- Materials list page: ~200-450ms
- Material edit page: ~250-350ms  
- Media page: ~3-220ms
- Price history: Fetched with page data (no separate API call)

### Database Indexes
- `idx_media_files_original_filename`
- `idx_media_files_stored_filename`
- `idx_media_files_uploaded_by`

---

## Known Issues & Limitations

### Current State
- ✅ All features working correctly
- ✅ No hydration errors
- ✅ SSR on all major pages
- ⚠️ Permission system bypassed for `/materials` and `/media`
- ⚠️ CSS source map warnings (acceptable in dev mode)

### Future Work
- Re-enable database permission system
- Add image optimization on upload
- Consider pagination for materials list (when 100+ items)
- Add batch image tagging/categorization

---

## Deployment Status

### Local Development
- ✅ Running on `http://localhost:3000`
- ✅ All features tested and working
- ✅ Committed to git: `863cb85`, `4752191`, `44e1afe`

### GitHub
- ✅ Pushed to `origin/main`
- ✅ Ready for Vercel deployment

### Production (Vercel)
- ⏳ Pending deployment
- 📋 Requires: Run `create_media_files_table.sql` in production Supabase
- 📋 Requires: Run migration endpoint once after deployment

---

## Quick Reference

### Chat Archive Location
- **This file**: `docs/chat-archives/2025-10-01-media-library-implementation.md`
- **Format**: Markdown
- **Usage**: Reference for context restoration

### Key Commands
```bash
# Start development server
cd /Volumes/T7/erp_turinova_new/starter-kit && pnpm dev

# Clear cache and restart
rm -rf .next && pnpm dev

# View git history
git log --oneline --graph

# Push to GitHub
git push origin main
```

### Key URLs
- Local: `http://localhost:3000`
- Materials: `http://localhost:3000/materials`
- Media: `http://localhost:3000/media`
- New Material: `http://localhost:3000/materials/new`
- Production: `https://turinova.hu`

---

**Archive Created**: October 1, 2025  
**Total Session Time**: ~3 hours  
**Lines of Code Changed**: ~1,350+  
**Features Delivered**: 5 major features  
**Bugs Fixed**: 8 critical issues

