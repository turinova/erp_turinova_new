# Accessory Creation System Documentation

## Overview
The Accessory Creation System allows users to create new accessories dynamically during order creation, eliminating the need to pre-create all products in the system. This feature integrates seamlessly with the shop order system and provides real-time product creation capabilities.

## Key Features

### 1. Dynamic Accessory Creation
- **On-the-fly Creation**: Create accessories during order entry
- **Automatic SKU Generation**: Generate unique SKUs when none provided
- **Default Value Assignment**: Automatic assignment of default partners, VAT rates, and currencies
- **Real-time Validation**: Immediate validation of required fields

### 2. Search Integration
- **Multi-source Search**: Search across accessories, materials, and linear materials
- **Server-side Search**: High-performance search across entire database
- **Real-time Results**: Live search results with debouncing
- **Case-insensitive Matching**: Flexible search patterns

### 3. Price Management
- **Base Price System**: Input base purchase price
- **Multiplier System**: Apply markup multipliers (1.0-5.0 range)
- **Automatic Calculations**: Real-time net and gross price calculations
- **VAT Integration**: Automatic VAT calculation and application

## Implementation Details

### Database Schema

#### Accessories Table Structure
```sql
CREATE TABLE accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  base_price INTEGER NOT NULL,
  multiplier DECIMAL(3,2) DEFAULT 1.38,
  net_price INTEGER NOT NULL,
  vat_id UUID NOT NULL REFERENCES vat(id),
  currency_id UUID NOT NULL REFERENCES currencies(id),
  units_id UUID NOT NULL REFERENCES units(id),
  partners_id UUID NOT NULL REFERENCES partners(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL
);
```

#### Constraints and Indexes
```sql
-- Unique constraint for active SKUs
CREATE UNIQUE INDEX accessories_sku_unique_active 
ON accessories (sku) WHERE deleted_at IS NULL;

-- Performance indexes
CREATE INDEX idx_accessories_name_active ON accessories (name) WHERE deleted_at IS NULL;
CREATE INDEX idx_accessories_sku_active ON accessories (sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_accessories_base_price ON accessories (base_price);
CREATE INDEX idx_accessories_multiplier ON accessories (multiplier);

-- Check constraints
ALTER TABLE accessories ADD CONSTRAINT accessories_base_price_positive 
CHECK (base_price > 0);

ALTER TABLE accessories ADD CONSTRAINT accessories_multiplier_range 
CHECK (multiplier >= 1.00 AND multiplier <= 5.00);
```

### API Implementation

#### Shop Order Save API (`/api/shoporder/save`)
Handles accessory creation during order processing:

```typescript
// Accessory creation logic
if (!product.sku || product.sku.trim() === '') {
  // Create new accessory with generated SKU
  const generatedSku = `NEW-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
} else {
  // Check if SKU exists in database
  const { data: existingAccessory } = await supabaseServer
    .from('accessories')
    .select('id')
    .eq('sku', product.sku.trim())
    .single()
  
  if (!existingAccessory) {
    // Create new accessory with user-provided SKU
  }
}
```

#### Search API (`/api/shoporder/search`)
Provides unified search across all product types:

```typescript
// Search accessories
const { data: accessoriesData } = await supabaseServer
  .from('accessories')
  .select(`
    id, name, sku, base_price, multiplier, net_price,
    partners_id, units_id, currency_id, vat_id,
    partners:partners_id(name),
    units:units_id(name, shortform),
    currencies:currency_id(name),
    vat:vat_id(name, kulcs)
  `)
  .is('deleted_at', null)
  .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
  .limit(20)
```

### Client-Side Implementation

#### Shop Order Client (`ShopOrderClient.tsx`)
Manages the accessory creation workflow:

```typescript
// Handle accessory selection/creation
const handleAccessoryChange = (event: React.SyntheticEvent, newValue: string | SearchableItem | null) => {
  if (typeof newValue === 'string') {
    // User typed a new product name
    setSelectedAccessory(null)
    setAccessoryData(prev => ({
      ...prev,
      name: newValue,
      // Don't clear SKU - user might have typed it separately
      type: 'Termék',
      base_price: '',
      multiplier: 1.38,
      // ... other fields
    }))
  }
}
```

#### Search Integration
Real-time search with debouncing:

```typescript
useEffect(() => {
  if (!searchTerm || searchTerm.length < 2) {
    setSearchResults([])
    return
  }

  const searchTimeout = setTimeout(async () => {
    setIsSearching(true)
    try {
      const response = await fetch(`/api/shoporder/search?q=${encodeURIComponent(searchTerm)}`)
      if (response.ok) {
        const data = await response.json()
        // Use accessories from API response (includes newly created ones)
        const allResults = [...data.materials, ...data.linearMaterials, ...data.accessories]
        setSearchResults(allResults)
      }
    } finally {
      setIsSearching(false)
    }
  }, 300) // Debounce search

  return () => clearTimeout(searchTimeout)
}, [searchTerm])
```

## Workflow

### 1. Product Search and Selection
1. User types in product search field
2. System searches across materials, linear materials, and accessories
3. Results displayed in dropdown with source indication
4. User can select existing product or continue typing for new product

### 2. New Product Creation
1. User types new product name and SKU
2. System validates required fields
3. If SKU doesn't exist, triggers new accessory creation
4. System creates accessory with:
   - User-provided name and SKU
   - Default partner (if none specified)
   - User-provided pricing and details
   - Generated SKU if none provided

### 3. Order Processing
1. Order save API processes all products
2. For each product, checks if accessory exists
3. Creates new accessories as needed
4. Links accessories to shop order items
5. Returns success with order number

## Price Calculation System

### Base Price and Multiplier
```typescript
// Calculate net price
const netPrice = Math.round(basePrice * multiplier)

// Calculate gross price with VAT
const grossPrice = Math.round(netPrice * (1 + vatRate / 100))

// Calculate totals
const totalGross = grossPrice * quantity
const totalNet = totalGross / (1 + vatRate / 100)
const totalVat = totalGross - totalNet
```

### Default Values
- **VAT Rate**: 27% (Hungarian standard)
- **Currency**: HUF (Hungarian Forint)
- **Unit**: db (darab/piece)
- **Multiplier**: 1.38 (38% markup)

## Error Handling

### Validation Errors
- **Required Fields**: Name, base price, quantity validation
- **Range Validation**: Multiplier must be between 1.0-5.0
- **SKU Uniqueness**: Prevents duplicate SKUs
- **Partner Requirement**: Ensures partner is selected

### API Error Handling
```typescript
try {
  const { data: newAccessory, error: accessoryError } = await supabaseServer
    .from('accessories')
    .insert(accessoryData)
    .select('id')
    .single()

  if (accessoryError) {
    console.error('Error creating accessory:', accessoryError)
    return NextResponse.json({ error: 'Hiba a termék létrehozásakor' }, { status: 500 })
  }
} catch (error) {
  console.error('Error in accessory creation:', error)
  return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
}
```

## Performance Considerations

### Database Optimization
- **Indexed Search Fields**: Fast name and SKU searches
- **Soft Delete Support**: Efficient filtering of deleted records
- **Pagination**: Handles large datasets efficiently

### Client-Side Optimization
- **Debounced Search**: Reduces API calls during typing
- **Memoized Calculations**: Efficient price calculations
- **State Management**: Optimized React state updates

### Caching Strategy
- **Server-Side Caching**: Cached search results
- **Client-Side Caching**: Cached form state in session storage
- **API Response Caching**: Reduced database queries

## Security Considerations

### Data Validation
- **Server-Side Validation**: All inputs validated on server
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Input sanitization

### Access Control
- **Authentication Required**: All endpoints require authentication
- **Permission Checks**: Role-based access control
- **Data Isolation**: Tenant-based data separation

## Testing

### Unit Tests
- Price calculation functions
- Validation logic
- Search functionality

### Integration Tests
- API endpoint testing
- Database operations
- Client-server communication

### User Acceptance Tests
- End-to-end workflow testing
- Error scenario handling
- Performance testing

## Troubleshooting

### Common Issues

#### Accessory Not Created
**Symptoms**: New accessory not appearing in database
**Causes**: 
- Missing required fields
- SKU already exists
- Partner not specified
**Solutions**:
- Check all required fields are filled
- Verify SKU uniqueness
- Ensure partner is selected

#### Search Not Finding New Accessory
**Symptoms**: Newly created accessory not appearing in search
**Causes**:
- Client-side caching
- Server-side caching
- Database transaction not committed
**Solutions**:
- Clear browser cache
- Restart development server
- Check database transaction status

#### Price Calculations Incorrect
**Symptoms**: Wrong prices displayed
**Causes**:
- Incorrect VAT rate
- Wrong multiplier value
- Currency conversion issues
**Solutions**:
- Verify VAT rates in database
- Check multiplier constraints
- Ensure correct currency settings

## Future Enhancements

### Planned Features
1. **Bulk Import**: Excel/CSV import for multiple accessories
2. **Product Templates**: Reusable product configurations
3. **Image Support**: Product image upload and management
4. **Barcode Integration**: SKU generation from barcodes
5. **Advanced Pricing**: Tiered pricing and discounts

### Technical Improvements
1. **Real-time Sync**: WebSocket integration for live updates
2. **Offline Support**: Progressive Web App capabilities
3. **Advanced Search**: Full-text search with ranking
4. **API Versioning**: Backward compatibility management
5. **Performance Monitoring**: Real-time performance metrics

## Support and Maintenance

### Monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time monitoring
- **Usage Analytics**: Feature usage tracking

### Maintenance
- **Database Cleanup**: Regular cleanup of soft-deleted records
- **Index Optimization**: Periodic index maintenance
- **Cache Management**: Cache invalidation strategies

### Documentation Updates
- **API Documentation**: Keep API docs current
- **User Guides**: Update user documentation
- **Technical Specs**: Maintain technical specifications
