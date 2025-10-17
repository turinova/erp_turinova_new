# Search System Improvements Documentation

## Overview
The Search System Improvements provide enhanced search capabilities across the application, including server-side search for accessories, unified product search for shop orders, and improved performance through optimized database queries and caching strategies.

## Key Improvements

### 1. Server-Side Search Implementation
- **Accessories Search API**: New `/api/accessories/search` endpoint
- **Unified Product Search**: Enhanced `/api/shoporder/search` with accessories
- **Performance Optimization**: Server-side search reduces client-side processing
- **Pagination Support**: Efficient handling of large datasets

### 2. Multi-Source Product Search
- **Materials Search**: Board materials with dimensions and pricing
- **Linear Materials Search**: Edge materials and profiles
- **Accessories Search**: General products with SKU and pricing
- **Unified Results**: Combined search results from all sources

### 3. Real-Time Search Experience
- **Debounced Input**: Reduced API calls during typing
- **Loading States**: Visual feedback during search
- **Instant Results**: Fast response times with caching
- **Case-Insensitive Matching**: Flexible search patterns

## Implementation Details

### New API Endpoints

#### `/api/accessories/search`
Server-side search for accessories with pagination support.

**Query Parameters:**
- `q`: Search term (minimum 2 characters)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 100)

**Implementation:**
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('q')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  
  if (!search || search.length < 2) {
    return NextResponse.json({ accessories: [], totalCount: 0, totalPages: 0, currentPage: 1 })
  }

  const offset = (page - 1) * limit

  // Get total count for search
  const { count } = await supabaseServer
    .from('accessories')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)

  // Get paginated search results
  const { data, error } = await supabaseServer
    .from('accessories')
    .select(`
      id, name, sku, base_price, multiplier, net_price,
      created_at, updated_at, vat_id, currency_id, units_id, partners_id,
      vat (id, name, kulcs),
      currencies (id, name),
      units (id, name, shortform),
      partners (id, name)
    `)
    .is('deleted_at', null)
    .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  // Transform and return results
  const accessories = data?.map(accessory => ({
    id: accessory.id,
    name: accessory.name,
    sku: accessory.sku,
    base_price: accessory.base_price,
    multiplier: accessory.multiplier,
    net_price: accessory.net_price,
    // ... other fields
  })) || []

  return NextResponse.json({
    accessories,
    totalCount: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
    currentPage: page
  })
}
```

#### Enhanced `/api/shoporder/search`
Updated to include accessories in search results.

**Previous Implementation:**
```typescript
// Only searched materials and linear materials
return NextResponse.json({
  materials,
  linearMaterials,
  totalCount: materials.length + linearMaterials.length
})
```

**New Implementation:**
```typescript
// Search accessories
const { data: accessoriesData, error: accessoriesError } = await supabaseServer
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

// Transform accessories data
const accessories = accessoriesData?.map(accessory => ({
  id: accessory.id,
  name: accessory.name,
  sku: accessory.sku,
  type: 'Termék',
  base_price: accessory.base_price || 0,
  multiplier: accessory.multiplier || 1.38,
  net_price: accessory.net_price || 0,
  gross_price: Math.round((accessory.net_price || 0) * (1 + (accessory.vat?.kulcs || 0) / 100)),
  // ... other fields
  source: 'accessories'
})) || []

return NextResponse.json({
  materials,
  linearMaterials,
  accessories,
  totalCount: materials.length + linearMaterials.length + accessories.length
})
```

### Client-Side Implementation

#### Accessories List Client Updates
Replaced client-side filtering with server-side search.

**Previous Implementation:**
```typescript
// Client-side filtering (limited to current page)
const filteredAccessories = useMemo(() => {
  if (!accessories || !Array.isArray(accessories)) return []
  if (!searchTerm) return accessories
  
  const term = searchTerm.toLowerCase()
  return accessories.filter(accessory => 
    accessory.name.toLowerCase().includes(term) ||
    accessory.sku.toLowerCase().includes(term)
  )
}, [accessories, searchTerm])
```

**New Implementation:**
```typescript
// Server-side search with state management
const [isSearching, setIsSearching] = useState(false)
const [searchResults, setSearchResults] = useState<Accessory[]>([])
const [searchTotalCount, setSearchTotalCount] = useState(0)
const [searchTotalPages, setSearchTotalPages] = useState(0)

// Search effect with debouncing
useEffect(() => {
  if (!searchTerm || searchTerm.length < 2) {
    setSearchResults([])
    setSearchTotalCount(0)
    setSearchTotalPages(0)
    return
  }

  const searchTimeout = setTimeout(async () => {
    setIsSearching(true)
    try {
      const response = await fetch(`/api/accessories/search?q=${encodeURIComponent(searchTerm)}&page=1&limit=${currentPageSize}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.accessories)
        setSearchTotalCount(data.totalCount)
        setSearchTotalPages(data.totalPages)
      }
    } finally {
      setIsSearching(false)
    }
  }, 300) // Debounce search

  return () => clearTimeout(searchTimeout)
}, [searchTerm, currentPageSize])

// Use search results if searching, otherwise use regular accessories
const filteredAccessories = searchTerm && searchTerm.length >= 2 ? searchResults : accessories
```

#### Shop Order Client Updates
Updated to use accessories from API response instead of local SSR data.

**Previous Implementation:**
```typescript
// Used local accessories array (from SSR)
const accessoriesWithSource = accessories.map(accessory => ({
  ...accessory,
  source: 'accessories',
  type: 'Termék'
}))
const allResults = [...data.materials, ...data.linearMaterials, ...accessoriesWithSource]
```

**New Implementation:**
```typescript
// Use accessories from API response (includes newly created ones)
const allResults = [...data.materials, ...data.linearMaterials, ...data.accessories]
setSearchResults(allResults)
```

## Performance Improvements

### Database Optimization

#### Indexed Search Fields
```sql
-- Performance indexes for search
CREATE INDEX idx_accessories_name_active ON accessories (name) WHERE deleted_at IS NULL;
CREATE INDEX idx_accessories_sku_active ON accessories (sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_materials_name_active ON materials (name) WHERE deleted_at IS NULL;
CREATE INDEX idx_linear_materials_name_active ON linear_materials (name) WHERE deleted_at IS NULL;
```

#### Efficient Query Patterns
```sql
-- Optimized search query with proper indexing
SELECT * FROM accessories 
WHERE deleted_at IS NULL 
AND (name ILIKE '%search_term%' OR sku ILIKE '%search_term%')
ORDER BY name ASC
LIMIT 20 OFFSET 0;
```

### Client-Side Optimization

#### Debounced Search
```typescript
// Debounce search to reduce API calls
const searchTimeout = setTimeout(async () => {
  // Perform search
}, 300) // 300ms debounce

return () => clearTimeout(searchTimeout)
```

#### Memoized Calculations
```typescript
// Memoize expensive calculations
const displayTotalCount = useMemo(() => {
  return searchTerm && searchTerm.length >= 2 ? searchTotalCount : totalCount
}, [searchTerm, searchTotalCount, totalCount])
```

#### Efficient State Management
```typescript
// Optimized state updates
const [searchResults, setSearchResults] = useState<Accessory[]>([])
const [searchTotalCount, setSearchTotalCount] = useState(0)
const [searchTotalPages, setSearchTotalPages] = useState(0)
```

## User Experience Improvements

### Visual Feedback
- **Loading States**: Spinner during search operations
- **Search Indicators**: Clear indication of search vs. browse mode
- **Result Counts**: Dynamic count display for search results
- **Empty States**: Helpful messages when no results found

### Search Behavior
- **Minimum Length**: 2-character minimum for search activation
- **Real-time Results**: Instant results as user types
- **Case Insensitive**: Flexible search patterns
- **Multi-field Search**: Search by name and SKU simultaneously

### Pagination Integration
- **Search-aware Pagination**: Pagination works with search results
- **Dynamic Counts**: Accurate total counts for search vs. all records
- **Page Size Options**: Configurable results per page
- **Navigation Controls**: First/Last page buttons for large datasets

## Error Handling

### API Error Handling
```typescript
try {
  const response = await fetch(`/api/accessories/search?q=${encodeURIComponent(searchTerm)}`)
  if (response.ok) {
    const data = await response.json()
    setSearchResults(data.accessories)
  } else {
    console.error('Search failed:', response.statusText)
    setSearchResults([])
  }
} catch (error) {
  console.error('Error searching accessories:', error)
  setSearchResults([])
} finally {
  setIsSearching(false)
}
```

### Graceful Degradation
- **Fallback to Client-side**: If server search fails, fall back to client-side filtering
- **Error Messages**: User-friendly error messages
- **Retry Mechanisms**: Automatic retry for failed requests
- **Offline Support**: Basic functionality when offline

## Caching Strategy

### Server-Side Caching
- **Database Query Caching**: Cached query results
- **API Response Caching**: Cached API responses
- **Search Result Caching**: Cached search results

### Client-Side Caching
- **Search Result Caching**: Cached search results in memory
- **Session Storage**: Persistent form state
- **Local Storage**: User preferences and settings

## Testing

### Unit Tests
```typescript
// Test search API functionality
describe('Accessories Search API', () => {
  test('should return search results for valid query', async () => {
    const response = await fetch('/api/accessories/search?q=test')
    const data = await response.json()
    expect(data.accessories).toBeDefined()
    expect(data.totalCount).toBeGreaterThanOrEqual(0)
  })

  test('should return empty results for short query', async () => {
    const response = await fetch('/api/accessories/search?q=a')
    const data = await response.json()
    expect(data.accessories).toEqual([])
    expect(data.totalCount).toBe(0)
  })
})
```

### Integration Tests
- **End-to-end Search**: Complete search workflow testing
- **API Integration**: Server-client communication testing
- **Performance Testing**: Response time and load testing

### User Acceptance Tests
- **Search Accuracy**: Correct results for various queries
- **Performance**: Acceptable response times
- **User Experience**: Intuitive search interface

## Monitoring and Analytics

### Performance Metrics
- **Search Response Time**: Average response time for searches
- **Search Success Rate**: Percentage of successful searches
- **Popular Search Terms**: Most frequently searched terms
- **Search Result Quality**: Click-through rates and user satisfaction

### Error Tracking
- **Search Failures**: Failed search attempts and causes
- **API Errors**: Server-side error tracking
- **Client Errors**: Client-side error monitoring
- **Performance Issues**: Slow search identification

## Future Enhancements

### Advanced Search Features
1. **Full-text Search**: PostgreSQL full-text search integration
2. **Search Suggestions**: Auto-complete and suggestion system
3. **Search History**: User search history and favorites
4. **Advanced Filters**: Category, price range, and other filters
5. **Search Analytics**: Detailed search analytics and insights

### Technical Improvements
1. **Elasticsearch Integration**: Advanced search engine integration
2. **Real-time Search**: WebSocket-based real-time search updates
3. **Search Indexing**: Automated search index management
4. **Performance Optimization**: Further performance improvements
5. **Mobile Optimization**: Enhanced mobile search experience

### User Experience Enhancements
1. **Search Shortcuts**: Keyboard shortcuts for power users
2. **Search Templates**: Saved search configurations
3. **Bulk Operations**: Bulk actions on search results
4. **Export Functionality**: Export search results
5. **Search Sharing**: Share search results with team members

## Troubleshooting

### Common Issues

#### Search Not Working
**Symptoms**: No results returned for valid queries
**Causes**: 
- API endpoint not responding
- Database connection issues
- Search term too short
- Index corruption
**Solutions**:
- Check API endpoint status
- Verify database connectivity
- Ensure minimum search length
- Rebuild search indexes

#### Slow Search Performance
**Symptoms**: Long response times for searches
**Causes**:
- Missing database indexes
- Large dataset without pagination
- Inefficient queries
- Server resource constraints
**Solutions**:
- Add appropriate database indexes
- Implement proper pagination
- Optimize query patterns
- Scale server resources

#### Search Results Inconsistent
**Symptoms**: Different results for same query
**Causes**:
- Caching issues
- Database replication lag
- Race conditions
- Index inconsistencies
**Solutions**:
- Clear cache
- Check database replication
- Implement proper locking
- Rebuild indexes

## Support and Maintenance

### Regular Maintenance
- **Index Optimization**: Regular index maintenance
- **Cache Management**: Cache cleanup and optimization
- **Performance Monitoring**: Continuous performance monitoring
- **Error Analysis**: Regular error analysis and resolution

### Documentation Updates
- **API Documentation**: Keep API documentation current
- **User Guides**: Update user search guides
- **Technical Specs**: Maintain technical specifications
- **Troubleshooting Guides**: Update troubleshooting documentation
