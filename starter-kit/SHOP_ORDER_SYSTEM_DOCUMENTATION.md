# Shop Order System Documentation

## Overview
The Shop Order System is a comprehensive solution for managing customer orders, product creation, and inventory management. This system allows users to create orders, manage customers, add products (including creating new accessories on-the-fly), and track order status.

## Key Features

### 1. Shop Order Management (`/shoporder`)
- **Worker Selection**: Choose from available workers with color-coded cards
- **Customer Management**: 
  - Search existing customers or create new ones
  - Pre-fill customer data from existing records
  - Editable customer information (name, email, mobile, billing details)
  - Automatic customer creation for new names
- **Product Addition**:
  - Search across accessories, materials, and linear materials
  - Create new accessories during order creation
  - Real-time price calculations with VAT
  - Quantity management with units
  - Product notes and comments

### 2. Customer Orders Management (`/customer-orders`)
- **Order Listing**: Paginated view of all customer orders
- **Status Tracking**: Open, Ordered, Finished status with color-coded chips
- **Search Functionality**: Search by customer name, product name, or SKU
- **Order Details**: Comprehensive order view with customer and billing information
- **Item Status**: Individual item status tracking (Open, Ordered, Arrived)

### 3. Supplier Orders Management (`/supplier-orders`)
- **Product Aggregation**: View all products grouped by supplier
- **Bulk Status Updates**: Change status for multiple items at once
- **Supplier Filtering**: Filter by specific suppliers
- **Order Navigation**: Click to view customer order details

## Database Schema

### Core Tables

#### `shop_orders`
```sql
CREATE TABLE shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR UNIQUE NOT NULL,
  worker_id UUID REFERENCES workers(id),
  customer_name VARCHAR NOT NULL,
  customer_email VARCHAR,
  customer_mobile VARCHAR,
  customer_discount DECIMAL(5,2) DEFAULT 0,
  billing_name VARCHAR,
  billing_country VARCHAR DEFAULT 'Magyarország',
  billing_city VARCHAR,
  billing_postal_code VARCHAR,
  billing_street VARCHAR,
  billing_house_number VARCHAR,
  billing_tax_number VARCHAR,
  billing_company_reg_number VARCHAR,
  status VARCHAR DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);
```

#### `shop_order_items`
```sql
CREATE TABLE shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES shop_orders(id),
  product_name VARCHAR NOT NULL,
  sku VARCHAR,
  type VARCHAR,
  base_price INTEGER NOT NULL,
  multiplier DECIMAL(3,2) DEFAULT 1.38,
  quantity INTEGER NOT NULL,
  units_id UUID REFERENCES units(id),
  partner_id UUID REFERENCES partners(id),
  vat_id UUID REFERENCES vat(id),
  currency_id UUID REFERENCES currencies(id),
  megjegyzes TEXT,
  status VARCHAR DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);
```

## API Endpoints

### Shop Order APIs

#### `POST /api/shoporder/save`
Creates a new shop order with customer and product data.

**Request Body:**
```json
{
  "worker_id": "uuid",
  "customer_name": "string",
  "customer_email": "string",
  "customer_mobile": "string",
  "customer_discount": "number",
  "billing_name": "string",
  "billing_country": "string",
  "billing_city": "string",
  "billing_postal_code": "string",
  "billing_street": "string",
  "billing_house_number": "string",
  "billing_tax_number": "string",
  "billing_company_reg_number": "string",
  "products": [
    {
      "name": "string",
      "sku": "string",
      "type": "string",
      "base_price": "number",
      "multiplier": "number",
      "quantity": "number",
      "vat_id": "uuid",
      "currency_id": "uuid",
      "units_id": "uuid",
      "partners_id": "uuid",
      "megjegyzes": "string"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "order_number": "SO-2025-001",
  "order_id": "uuid"
}
```

#### `GET /api/shoporder/search`
Searches for products across materials, linear materials, and accessories.

**Query Parameters:**
- `q`: Search term (minimum 2 characters)

**Response:**
```json
{
  "materials": [...],
  "linearMaterials": [...],
  "accessories": [...],
  "totalCount": "number"
}
```

#### `GET /api/shoporder/[id]`
Retrieves a specific shop order with all related data.

### Accessories Search API

#### `GET /api/accessories/search`
Server-side search for accessories with pagination.

**Query Parameters:**
- `q`: Search term (minimum 2 characters)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 100)

**Response:**
```json
{
  "accessories": [...],
  "totalCount": "number",
  "totalPages": "number",
  "currentPage": "number"
}
```

## Key Features Implementation

### 1. Dynamic Accessory Creation
When a user types a new product name or SKU that doesn't exist in the database, the system automatically creates a new accessory record.

**Process:**
1. User types product name and SKU
2. System checks if SKU exists in database
3. If not found, creates new accessory with:
   - Generated SKU if none provided
   - Default partner if none specified
   - User-provided pricing and details
4. Links the new accessory to the shop order

### 2. Customer Management
The system handles both existing and new customers seamlessly.

**Existing Customers:**
- Search by name
- Pre-fill all customer data
- Allow editing of customer information
- Update customer data when order is saved

**New Customers:**
- Create customer record automatically
- Generate email if none provided
- Save all billing information

### 3. Search System
Comprehensive search across multiple product types:

**Materials**: Board materials with dimensions and pricing
**Linear Materials**: Edge materials and profiles
**Accessories**: General products with SKU and pricing

**Search Features:**
- Real-time search with debouncing
- Server-side search for performance
- Case-insensitive matching
- Search by name and SKU

### 4. Price Calculations
Automatic price calculations with VAT:

**Formula:**
```
net_price = base_price × multiplier
gross_price = net_price × (1 + vat_rate/100)
total_gross = gross_price × quantity
```

**Features:**
- Real-time calculation updates
- Currency formatting
- VAT rate integration
- Discount application

## UI Components

### Shop Order Form
- **Worker Selection Card**: Color-coded worker selection
- **Customer Section**: Searchable customer input with billing accordion
- **Product Addition**: Multi-source product search and form
- **Products Table**: Editable product list with calculations
- **Summary Section**: Order totals with discount application

### Order Management Pages
- **Customer Orders**: List view with status filtering and search
- **Supplier Orders**: Aggregated view by supplier
- **Order Details**: Comprehensive order information display

## Session Storage
The system uses browser session storage to maintain form state:

**Stored Data:**
- Selected worker
- Customer data
- Product form state
- Products table
- Editing state

**Expiration:** 5 minutes of inactivity

## Error Handling
Comprehensive error handling with user-friendly messages:

- **Validation Errors**: Field-specific validation messages
- **API Errors**: Server error handling with fallbacks
- **Network Errors**: Retry mechanisms and offline handling
- **Data Errors**: Graceful degradation for missing data

## Performance Optimizations

### Server-Side Rendering (SSR)
- Initial data loading on server
- Reduced client-side API calls
- Faster page load times

### Database Optimizations
- Indexed search fields
- Pagination for large datasets
- Efficient joins and queries

### Client-Side Optimizations
- Debounced search inputs
- Memoized calculations
- Efficient state management

## Security Considerations

### Data Validation
- Server-side validation for all inputs
- SQL injection prevention
- XSS protection

### Authentication
- Supabase authentication integration
- Session management
- Permission-based access control

## Future Enhancements

### Planned Features
1. **Barcode Integration**: Product scanning capabilities
2. **Inventory Management**: Stock level tracking
3. **Order Templates**: Reusable order configurations
4. **Advanced Reporting**: Analytics and insights
5. **Mobile Optimization**: Responsive design improvements

### Technical Improvements
1. **Caching Layer**: Redis integration for better performance
2. **Real-time Updates**: WebSocket integration for live updates
3. **Offline Support**: Progressive Web App features
4. **API Versioning**: Backward compatibility management

## Troubleshooting

### Common Issues

#### Accessory Not Appearing in Search
**Cause**: New accessory not in first 100 records
**Solution**: Use search functionality instead of pagination

#### Customer Data Not Saving
**Cause**: Missing required fields or validation errors
**Solution**: Check all required fields are filled

#### Price Calculations Incorrect
**Cause**: VAT rate or multiplier issues
**Solution**: Verify VAT rates and multipliers in database

### Debug Information
Enable debug logging by setting `NODE_ENV=development` to see detailed API logs and performance metrics.

## Support
For technical support or feature requests, please refer to the development team or create an issue in the project repository.
