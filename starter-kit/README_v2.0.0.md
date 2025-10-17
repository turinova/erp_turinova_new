# ERP Turinova - Shop Order Management System

## 🚀 Version 2.0.0 - Major Update

This release introduces a comprehensive **Shop Order Management System** with dynamic accessory creation, enhanced search capabilities, and improved user experience.

## ✨ Key Features

### 🛒 Shop Order Management
- **Complete Order System**: Create, manage, and track customer orders
- **Worker Management**: Color-coded worker selection with background colors
- **Customer Management**: Search existing customers or create new ones automatically
- **Dynamic Product Creation**: Create accessories on-the-fly during order entry
- **Real-time Pricing**: Live price calculations with VAT and discounts
- **Order Status Tracking**: Open, Ordered, Finished status with visual indicators

### 🔍 Enhanced Search System
- **Server-side Search**: High-performance search across entire database
- **Multi-source Search**: Unified search across materials, linear materials, and accessories
- **Real-time Results**: Live search with debouncing and loading states
- **Accessories Search**: New dedicated search API with pagination support

### 📊 Order Management Pages
- **Customer Orders**: Comprehensive order listing with filtering and search
- **Supplier Orders**: Supplier-focused view with bulk operations
- **Order Details**: Detailed order information with customer and billing data
- **Status Management**: Individual item status tracking (Open, Ordered, Arrived)

## 🏗️ System Architecture

### Database Schema
```sql
-- Shop Orders
CREATE TABLE shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR UNIQUE NOT NULL,
  worker_id UUID REFERENCES workers(id),
  customer_name VARCHAR NOT NULL,
  -- ... customer and billing fields
  status VARCHAR DEFAULT 'open'
);

-- Shop Order Items
CREATE TABLE shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES shop_orders(id),
  product_name VARCHAR NOT NULL,
  sku VARCHAR,
  base_price INTEGER NOT NULL,
  multiplier DECIMAL(3,2) DEFAULT 1.38,
  -- ... pricing and product fields
);
```

### API Endpoints
- `POST /api/shoporder/save` - Create new shop order
- `GET /api/shoporder/search` - Search products across all types
- `GET /api/accessories/search` - Server-side accessories search
- `GET /api/shoporder/[id]` - Get specific order details

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Supabase account

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd erp_turinova_new/starter-kit

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Configure your Supabase credentials

# Run database migrations
# Execute the SQL files in the root directory

# Start development server
npm run dev
```

### Database Setup
1. Run `create_shop_orders_tables.sql` to create the shop order tables
2. Run `add_base_price_multiplier_to_materials_linear_materials.sql` for pricing system
3. Run `modify_accessories_table_pricing.sql` for accessories pricing

## 📖 Usage Guide

### Creating a Shop Order
1. Navigate to `/shoporder`
2. Select a worker (required)
3. Search for existing customer or type new name
4. Add products using the search functionality
5. Review pricing and apply discounts
6. Save the order

### Managing Orders
- **Customer Orders** (`/customer-orders`): View all customer orders
- **Supplier Orders** (`/supplier-orders`): View orders by supplier
- **Order Details**: Click any order to view full details

### Searching Products
- **Accessories Page**: Use the search box to find accessories across the entire database
- **Shop Order Page**: Search across materials, linear materials, and accessories
- **Real-time Results**: Results update as you type (minimum 2 characters)

## 🔧 Technical Details

### Dynamic Accessory Creation
When creating a shop order, users can:
- Type a new product name and SKU
- System automatically creates the accessory in the database
- Generates unique SKU if none provided
- Assigns default values (partner, VAT rate, currency, unit)

### Price Calculation System
```typescript
// Base price and multiplier system
net_price = base_price × multiplier
gross_price = net_price × (1 + vat_rate/100)
total_gross = gross_price × quantity
```

### Search Performance
- **Server-side Processing**: All searches processed on server
- **Database Indexing**: Optimized indexes for fast searches
- **Debounced Input**: Reduced API calls during typing
- **Pagination**: Efficient handling of large datasets

## 🐛 Bug Fixes in v2.0.0

### Search System
- ✅ Fixed accessory visibility issues
- ✅ Implemented server-side search for accessories page
- ✅ Resolved caching problems preventing new records from appearing
- ✅ Improved search performance for large datasets

### Order System
- ✅ Fixed automatic customer creation
- ✅ Fixed dynamic accessory creation with proper validation
- ✅ Corrected VAT and pricing calculations
- ✅ Fixed form state management and session storage

### UI/UX
- ✅ Added proper loading indicators
- ✅ Improved error message clarity
- ✅ Enhanced form validation with real-time feedback
- ✅ Fixed navigation and breadcrumb issues

## 📚 Documentation

### New Documentation Files
- `SHOP_ORDER_SYSTEM_DOCUMENTATION.md` - Complete system overview
- `ACCESSORY_CREATION_SYSTEM_DOCUMENTATION.md` - Dynamic creation workflow
- `SEARCH_SYSTEM_IMPROVEMENTS_DOCUMENTATION.md` - Enhanced search capabilities

### API Documentation
- Complete API reference for all new endpoints
- Request/response examples
- Error handling guidelines

## 🔒 Security Features

### Data Validation
- Server-side validation for all inputs
- SQL injection prevention with parameterized queries
- XSS protection with input sanitization

### Access Control
- Authentication required for all endpoints
- Role-based access control
- Tenant-based data isolation

## 🚀 Performance Optimizations

### Database
- Strategic indexing for search performance
- Soft delete support for efficient filtering
- Optimized queries with proper joins

### Client-side
- Debounced search to reduce API calls
- Memoized calculations for better performance
- Efficient React state management
- Session storage for form persistence

## 🔄 Migration Guide

### From v1.0.0 to v2.0.0
1. **Database Migration**: Run the new SQL migration files
2. **Environment Variables**: No new environment variables required
3. **Code Updates**: All changes are backward compatible
4. **Feature Flags**: New features are enabled by default

### Rollback Procedure
- All migrations include rollback scripts
- Database changes can be safely reverted
- No breaking changes to existing functionality

## 🎯 Future Roadmap

### Planned Features (v2.1.0)
- **Barcode Integration**: Product scanning capabilities
- **Inventory Management**: Stock level tracking
- **Order Templates**: Reusable order configurations
- **Advanced Reporting**: Analytics and insights

### Technical Improvements
- **Redis Caching**: Enhanced caching layer
- **WebSocket Integration**: Real-time updates
- **Progressive Web App**: Offline support
- **API Versioning**: Backward compatibility management

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Jest for testing

## 📞 Support

### Documentation
- Check the documentation files in the root directory
- API documentation is available in the `/docs` folder
- Troubleshooting guides are included in each documentation file

### Issues
- Report bugs using GitHub Issues
- Include steps to reproduce
- Provide error logs and system information

### Contact
- Development Team: [Contact Information]
- Technical Support: [Support Information]

## 📄 License

This project is licensed under the [License Name] - see the LICENSE file for details.

---

## 🏷️ Version History

- **v2.0.0** (October 17, 2025) - Shop Order Management System
- **v1.0.0** (October 16, 2025) - Pricing System Implementation

For detailed changelog, see [CHANGELOG.md](./CHANGELOG.md)
