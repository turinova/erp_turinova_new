# Shop Order Page Documentation

## Overview
The Shop Order Page (`/shoporder`) is a comprehensive order management system designed for in-store order processing. It provides a streamlined interface for creating orders with worker assignment, customer information, and product management.

## Features

### 1. Worker Selection
- **Dynamic Card Background**: The main card background color changes based on the selected worker's assigned color
- **Required Field**: Worker selection is mandatory for order creation
- **Display**: Shows worker nickname or name in dropdown

### 2. Customer Information
- **Autocomplete Search**: Search existing customers by name or create new customers
- **Pre-filled Data**: Selecting existing customers automatically populates all fields
- **Required Fields**: Customer name is mandatory
- **Contact Information**: Email and phone (with Hungarian formatting)
- **Discount Management**: Percentage-based discount system
- **Billing Details**: Complete billing information in collapsible accordion
- **Clear Function**: "Törlés" button to clear all customer data

### 3. Product Management
- **Accessory Selection**: Search by product name or SKU
- **Pricing System**: Base price × multiplier = net price, with VAT calculation
- **Quantity Management**: Quantity with unit display
- **Notes Field**: Multiline megjegyzés field for product-specific notes
- **Real-time Calculations**: Automatic price calculations and preview

### 4. Products Table
- **Columns**: Product name, SKU, net unit price, gross unit price, quantity with unit, net total, gross total, megjegyzés, actions
- **Interactive**: Click rows to edit products
- **Delete Function**: Individual product deletion with confirmation
- **Tooltip Display**: Hover over info icon to see megjegyzés content

### 5. Summary Table
- **Total Calculations**: Net and gross totals for all products
- **Discount Application**: Customer discount applied to totals
- **Final Amounts**: Final net and gross amounts after discount

### 6. Session Storage
- **5-Minute Persistence**: All form data saved for 5 minutes
- **Automatic Save**: Data saved automatically on changes
- **Expiration Handling**: Expired data automatically cleared
- **Complete State**: Saves worker, customer, products, and form state

## Technical Implementation

### State Management
- React hooks for all form states
- Session storage integration for data persistence
- Real-time price calculations with useEffect

### Data Flow
1. **Worker Selection** → Card background color change
2. **Customer Selection** → Form population or new customer creation
3. **Product Addition** → Table update with calculations
4. **Form Changes** → Automatic session storage updates

### Validation
- Required field validation for worker, customer name, and product details
- Toast notifications for success/error feedback
- Input formatting for phone numbers and prices

### UI Components
- Material-UI components for consistent design
- Responsive grid layout for different screen sizes
- Accordion for billing information (collapsed by default)
- Tooltip for megjegyzés display

## Usage Workflow

1. **Select Worker**: Choose from dropdown (required)
2. **Enter Customer**: Search existing or type new customer name (required)
3. **Add Products**: Fill product details and click "Hozzáadás"
4. **Review Order**: Check products table and summary
5. **Edit if Needed**: Click product rows to edit or delete products

## Data Structure

### ProductItem Interface
```typescript
interface ProductItem {
  id: string
  name: string
  sku: string
  base_price: number
  multiplier: number
  quantity: number
  net_price: number
  gross_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  megjegyzes: string
}
```

### Session Storage Format
```typescript
{
  timestamp: number,
  selectedWorker: Worker | null,
  customerData: CustomerData,
  selectedCustomer: Customer | null,
  productsTable: ProductItem[],
  accessoryData: AccessoryData,
  selectedAccessory: Accessory | null,
  editingProductId: string | null
}
```

## Performance Considerations
- Debounced session storage saves (500ms delay)
- Efficient price calculations with memoization
- Conditional rendering for tables and summaries
- Optimized re-renders with proper dependency arrays

## Future Enhancements
- Order submission to database
- Print functionality
- Export capabilities
- Integration with existing order system
- Payment processing integration
