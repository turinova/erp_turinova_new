# Pricing System Documentation

## Overview

This document describes the implementation of the new pricing system for materials and linear materials, which replaces direct price input with a base price and multiplier system.

## System Architecture

### Database Schema Changes

#### Materials Table
- Added `base_price` (integer) - The base purchase price
- Added `multiplier` (DECIMAL(3,2)) - The markup multiplier (default: 1.38)
- Added `partners_id` (uuid, optional) - Reference to partners table
- Added `units_id` (uuid, required) - Reference to units table
- `price_per_sqm` is now calculated automatically via database trigger: `base_price * multiplier`

#### Linear Materials Table
- Added `base_price` (integer) - The base purchase price
- Added `multiplier` (DECIMAL(3,2)) - The markup multiplier (default: 1.38)
- Added `partners_id` (uuid, optional) - Reference to partners table
- Added `units_id` (uuid, required) - Reference to units table
- `price_per_m` is now calculated automatically via database trigger: `base_price * multiplier`

### Database Triggers

```sql
-- Materials trigger
CREATE OR REPLACE FUNCTION calculate_materials_price()
RETURNS TRIGGER AS $$
BEGIN
    NEW.price_per_sqm = ROUND(NEW.base_price * NEW.multiplier);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Linear materials trigger
CREATE OR REPLACE FUNCTION calculate_linear_materials_price()
RETURNS TRIGGER AS $$
BEGIN
    NEW.price_per_m = ROUND(NEW.base_price * NEW.multiplier);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## User Interface Changes

### New Pages Layout

#### Materials New/Edit Pages
**Pricing Section (Single Row):**
- Partner (sm={2}) - Dropdown selection
- Beszerzési ár (sm={2}) - Base price input (integer)
- Árrés szorzó (sm={2}) - Multiplier input (1.00-5.00)
- Ár/m² (Ft) (sm={2}) - Calculated price (read-only)
- Pénznem (sm={2}) - Currency selection
- ÁFA (sm={2}) - VAT selection

#### Linear Materials New/Edit Pages
**Pricing Section (Single Row):**
- Partner (md={2}) - Dropdown selection
- Beszerzési ár (md={2}) - Base price input (integer)
- Árrés szorzó (md={2}) - Multiplier input (1.00-5.00)
- Ár/m (Ft) (md={2}) - Calculated price (read-only)
- Pénznem (md={2}) - Currency selection
- ÁFA (md={2}) - VAT selection

### Form Behavior

1. **Real-time Calculation**: Price is automatically calculated when base_price or multiplier changes
2. **Validation**: 
   - Base price must be > 0
   - Multiplier must be between 1.0 and 5.0
3. **Pre-filling**: Edit pages pre-fill all fields with existing values
4. **Price History**: All price changes are tracked with user attribution

## API Changes

### Materials API Routes

#### GET /api/materials/[id]
- Added `base_price`, `multiplier`, `partners_id`, `units_id` to response
- Updated server-side data fetching functions

#### PATCH /api/materials/[id]
- Added `base_price`, `multiplier`, `partners_id`, `units_id` to update payload
- Maintains backward compatibility with existing price_per_sqm

#### POST /api/materials
- Updated to include new fields in material creation
- Calculates price_per_sqm automatically

### Linear Materials API Routes

#### GET /api/linear-materials/[id]
- Added `base_price`, `multiplier`, `partners_id`, `units_id` to response
- Uses `*` selector to include all fields

#### PATCH /api/linear-materials/[id]
- Added `base_price`, `multiplier`, `partners_id`, `units_id` to update payload
- Maintains backward compatibility with existing price_per_m

#### POST /api/linear-materials
- Updated to include new fields in linear material creation
- Calculates price_per_m automatically

## Export/Import Changes

### Materials Export/Import
- **Export**: `base_price`, `multiplier`, `partner`, `unit` columns
- **Import**: Users input base_price and multiplier, system calculates final price
- **Removed**: Direct `price_per_sqm` from export/import

### Linear Materials Export/Import
- **Export**: `base_price`, `multiplier`, `partner`, `unit` columns
- **Import**: Users input base_price and multiplier, system calculates final price
- **Removed**: Direct `price_per_m` from export/import

## Migration Strategy

### Data Migration
For existing materials and linear materials:
1. Calculate `base_price = current_price / 1.38` (rounded to integer)
2. Set `multiplier = 1.38` (default)
3. Set `units_id` to 'tábla' unit (or fallback)
4. `partners_id` remains NULL (optional)

### Backward Compatibility
- Existing `price_per_sqm` and `price_per_m` fields are maintained
- Database triggers ensure calculated prices are always up-to-date
- API responses include both old and new fields during transition

## Validation Rules

### Base Price
- Must be greater than 0
- Integer values only
- No decimal places

### Multiplier
- Range: 1.00 to 5.00
- Decimal precision: 2 places
- Default: 1.38

### Partners
- Optional field
- References partners table
- Can be NULL

### Units
- Required field
- References units table
- Default: 'tábla' unit

## Price History Tracking

### Materials Price History
- Tracks changes to `price_per_sqm` (calculated field)
- Records old and new prices
- Includes user attribution and timestamp
- Maintains currency and VAT information

### Linear Materials Price History
- Tracks changes to `price_per_m` (calculated field)
- Records old and new prices
- Includes user attribution and timestamp
- Maintains currency and VAT information

## Performance Considerations

### Database Indexes
- Added indexes on `base_price`, `multiplier`, `partners_id`, `units_id`
- Maintains existing performance characteristics
- Triggers add minimal overhead

### Caching
- No changes to existing caching strategy
- API responses include calculated prices
- Client-side calculations for real-time updates

## Error Handling

### Validation Errors
- Base price validation: "A beszerzési ár nagyobb kell legyen mint 0!"
- Multiplier validation: "Az árrés szorzó 1.0 és 5.0 között kell legyen!"
- Required field validation for units

### Database Errors
- Graceful handling of constraint violations
- Proper error messages for user feedback
- Rollback on failed operations

## Testing

### Unit Tests
- Price calculation accuracy
- Validation rule enforcement
- Database trigger functionality

### Integration Tests
- API endpoint functionality
- Export/import operations
- Price history tracking

### User Acceptance Tests
- Form behavior and validation
- Real-time price calculation
- Data persistence and retrieval

## Future Enhancements

### Potential Improvements
1. **Dynamic Multipliers**: Category-based multiplier rules
2. **Price Templates**: Predefined pricing configurations
3. **Bulk Price Updates**: Mass update capabilities
4. **Price Analytics**: Historical price trend analysis
5. **Currency Conversion**: Multi-currency support

### Scalability Considerations
- Database partitioning for large datasets
- Caching strategies for frequently accessed data
- API rate limiting for bulk operations

## Troubleshooting

### Common Issues

#### Price Not Calculating
- Check database triggers are active
- Verify base_price and multiplier values
- Ensure proper data types

#### Import/Export Problems
- Validate Excel file format
- Check column headers match expected names
- Verify data types and ranges

#### Performance Issues
- Monitor database query performance
- Check index usage
- Consider query optimization

### Debug Information
- Enable detailed logging for price calculations
- Monitor trigger execution times
- Track API response times

## Conclusion

The new pricing system provides a more flexible and maintainable approach to material pricing while maintaining backward compatibility and improving user experience. The base price and multiplier system allows for easier price management and better cost control.

---

**Document Version**: 1.0  
**Last Updated**: October 16, 2025  
**Author**: Development Team
