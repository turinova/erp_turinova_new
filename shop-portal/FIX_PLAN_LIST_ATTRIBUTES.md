# Fix Plan: LIST Attribute Sync Issues

## Overview
This plan addresses the root causes preventing LIST attribute values from syncing correctly from ERP to ShopRenter.

## Priority Levels
- **P0 (Critical)**: Blocks all sync functionality
- **P1 (High)**: Affects most sync operations
- **P2 (Medium)**: Improves reliability and edge cases
- **P3 (Low)**: Nice-to-have improvements

---

## Phase 1: Fix Data Storage During PULL (P0 - Critical)

### Problem
When pulling products from ShopRenter, we only store the `listAttributeValueDescription` ID, not the `listAttributeValue` ID. This breaks sync because ShopRenter's API requires the `listAttributeValue` ID to update relations.

### Solution
Extract and store the `listAttributeValue` ID when processing LIST attributes during product sync.

### Implementation Steps

#### Step 1.1: Modify `syncProductToDatabase` function
**File**: `src/app/api/connections/[id]/sync-products/route.ts`
**Location**: Around line 2218-2226

**Current Code**:
```typescript
productAttributes.push({
  type: attr.type,
  name: attr.name,
  display_name: displayName,
  group_name: groupName,
  prefix: prefix,
  postfix: postfix,
  value: attr.value // Contains listAttributeValueDescription ID only
})
```

**New Code**:
```typescript
// For LIST attributes, extract and store listAttributeValue ID
let processedValue = attr.value
if (attr.type === 'LIST' && Array.isArray(attr.value) && attr.value.length > 0) {
  const listValue = attr.value[0]
  
  // Try to extract listAttributeValue ID from the description
  // The description should have a listAttributeValue href or id
  if (listValue.listAttributeValue?.id) {
    // Already have the ID
    processedValue = attr.value.map((v: any) => ({
      ...v,
      listAttributeValueId: v.listAttributeValue.id
    }))
  } else if (listValue.listAttributeValue?.href) {
    // Extract ID from href: "http://shop.api.myshoprenter.hu/listAttributeValues/{id}"
    const hrefMatch = listValue.listAttributeValue.href.match(/\/listAttributeValues\/([^\/\?]+)/)
    if (hrefMatch && hrefMatch[1]) {
      processedValue = attr.value.map((v: any) => ({
        ...v,
        listAttributeValueId: hrefMatch[1]
      }))
    }
  } else if (listValue.href) {
    // Fallback: Fetch the description to get listAttributeValue ID
    // This requires an API call, so we'll do it only if needed
    // For now, we'll mark it for later extraction during sync
    processedValue = attr.value.map((v: any) => ({
      ...v,
      _needsListAttributeValueId: true // Flag for later extraction
    }))
  }
}

productAttributes.push({
  type: attr.type,
  name: attr.name,
  display_name: displayName,
  group_name: groupName,
  prefix: prefix,
  postfix: postfix,
  value: processedValue
})
```

**Note**: If `full=1` is used in productExtend fetch, the `listAttributeValue` should be included. If not, we need to fetch descriptions individually (expensive but necessary).

#### Step 1.2: Enhanced extraction with API fallback
If `listAttributeValue` is not in the response, fetch it from the description:

```typescript
// Inside the LIST attribute processing loop
if (attr.type === 'LIST' && Array.isArray(attr.value) && attr.value.length > 0) {
  const listValue = attr.value[0]
  
  // Check if we need to fetch listAttributeValue ID
  if (!listValue.listAttributeValue?.id && !listValue.listAttributeValueId) {
    // Fetch the description to get listAttributeValue ID
    if (listValue.id || listValue.href) {
      const descId = listValue.id || extractIdFromHref(listValue.href)
      if (descId && apiBaseUrl && authHeaderParam) {
        try {
          const descUrl = `${apiBaseUrl}/listAttributeValueDescriptions/${encodeURIComponent(descId)}?full=1`
          const descResponse = await fetch(descUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeaderParam
            },
            signal: AbortSignal.timeout(5000)
          })
          
          if (descResponse.ok) {
            const descData = await descResponse.json()
            if (descData.listAttributeValue?.id) {
              listValue.listAttributeValueId = descData.listAttributeValue.id
            } else if (descData.listAttributeValue?.href) {
              const hrefMatch = descData.listAttributeValue.href.match(/\/listAttributeValues\/([^\/\?]+)/)
              if (hrefMatch && hrefMatch[1]) {
                listValue.listAttributeValueId = hrefMatch[1]
              }
            }
          }
        } catch (error) {
          console.warn(`[SYNC] Failed to fetch listAttributeValue ID for ${attr.name}:`, error)
        }
      }
    }
  }
}
```

**Performance Consideration**: This adds API calls during pull. Consider:
- Batch fetching descriptions if possible
- Caching results
- Making it optional (only when needed for sync)

---

## Phase 2: Fix Strategy 4 Text Matching (P1 - High)

### Problem
Strategy 4 tries to match values by text but doesn't fetch descriptions from `listAttributeValues`, so matching fails.

### Solution
Fetch descriptions for each `listAttributeValue` before attempting text matching.

### Implementation Steps

#### Step 2.1: Enhance Strategy 4 in sync route
**File**: `src/app/api/products/[id]/sync/route.ts`
**Location**: Around line 850-912

**Current Issue**: The code checks `listValue.listAttributeValueDescriptions` but doesn't fetch them if they're just hrefs.

**New Code**:
```typescript
// Strategy 4: Query listAttributeValues by attribute ID and match by value text
if (!listAttributeValueId) {
  const listAttributeId = shoprenterAttr.listAttribute?.id || shoprenterAttr.id
  if (listAttributeId && localValue.value) {
    const valueText = typeof localValue.value === 'string' ? localValue.value : localValue.value?.toString()
    if (valueText) {
      console.log(`[SYNC] Strategy 4: Trying to find listAttributeValue by querying listAttributeValues for attribute "${localAttr.name}" (ID: ${listAttributeId}) with value text: "${valueText}"`)
      
      const listValuesUrl = `${apiBaseUrl}/listAttributeValues?listAttributeId=${encodeURIComponent(listAttributeId)}&full=1`
      const listValuesResponse = await fetch(listValuesUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(10000)
      })

      if (listValuesResponse.ok) {
        const listValuesData = await listValuesResponse.json()
        const listValues = listValuesData.items || listValuesData.listAttributeValues?.listAttributeValue || []
        const valuesArray = Array.isArray(listValues) ? listValues : [listValues].filter(Boolean)
        
        console.log(`[SYNC] Strategy 4: Found ${valuesArray.length} listAttributeValues for attribute "${localAttr.name}"`)

        // Fetch descriptions for each value to enable text matching
        const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
        for (const listValue of valuesArray) {
          if (!listValue || !listValue.id) continue
          
          try {
            // Fetch descriptions for this value
            const descUrl = `${apiBaseUrl}/listAttributeValueDescriptions?listAttributeValueId=${encodeURIComponent(listValue.id)}&languageId=${encodeURIComponent(languageId)}&full=1`
            const descResponse = await fetch(descUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              signal: AbortSignal.timeout(5000)
            })

            if (descResponse.ok) {
              const descData = await descResponse.json()
              let descriptions: any[] = []
              
              // Extract descriptions from response
              if (descData.items && Array.isArray(descData.items)) {
                descriptions = descData.items
              } else if (descData.listAttributeValueDescriptions?.listAttributeValueDescription) {
                const descs = descData.listAttributeValueDescriptions.listAttributeValueDescription
                descriptions = Array.isArray(descs) ? descs : [descs]
              } else if (descData.listAttributeValueDescription) {
                descriptions = [descData.listAttributeValueDescription]
              }
              
              // Try to match by text
              const matchingDesc = descriptions.find((desc: any) => {
                if (!desc) return false
                const descName = desc.name || desc.value || ''
                const descValue = desc.value || desc.name || ''
                const normalizedLocal = valueText.trim().toLowerCase()
                const normalizedDescName = descName.trim().toLowerCase()
                const normalizedDescValue = descValue.trim().toLowerCase()
                
                return normalizedDescName === normalizedLocal || 
                       normalizedDescValue === normalizedLocal ||
                       normalizedDescName.includes(normalizedLocal) ||
                       normalizedDescValue.includes(normalizedLocal)
              })
              
              if (matchingDesc) {
                listAttributeValueId = listValue.id
                console.log(`[SYNC] Strategy 4: ✅ Found listAttributeValue ID by matching value text: ${listAttributeValueId}`)
                break
              }
            }
          } catch (error) {
            console.warn(`[SYNC] Strategy 4: Error fetching descriptions for value ${listValue.id}:`, error)
          }
        }
        
        if (!listAttributeValueId) {
          console.warn(`[SYNC] Strategy 4: Could not find matching listAttributeValue for "${localAttr.name}" with value text "${valueText}"`)
        }
      } else {
        const errorText = await listValuesResponse.text().catch(() => 'Unknown error')
        console.warn(`[SYNC] Strategy 4: Failed to fetch listAttributeValues: ${listValuesResponse.status} - ${errorText}`)
      }
    }
  }
}
```

**Performance Note**: This adds multiple API calls. Consider:
- Limiting to first N values if there are many
- Caching results
- Using parallel requests with Promise.all (with concurrency limit)

---

## Phase 3: Improve Error Handling for 404s (P1 - High)

### Problem
When description IDs return 404, Strategies 2 and 3 fail completely. We need better fallback handling.

### Solution
When a description returns 404, try alternative methods to find the `listAttributeValue` ID.

### Implementation Steps

#### Step 3.1: Enhanced Strategy 2 fallback
**File**: `src/app/api/products/[id]/sync/route.ts`
**Location**: Around line 760-805

**Add after 404 error**:
```typescript
if (descResponse.status === 404) {
  console.warn(`[SYNC] Description not found (404) for "${localAttr.name}", trying alternative methods...`)
  
  // Alternative: Try to find by querying all descriptions for the attribute
  // and matching by value text
  const listAttributeId = shoprenterAttr.listAttribute?.id || shoprenterAttr.id
  if (listAttributeId && shoprenterValue.value) {
    // This will be handled by Strategy 4, but we can log it here
    console.log(`[SYNC] Will attempt Strategy 4 for "${localAttr.name}"`)
  }
}
```

#### Step 3.2: Enhanced Strategy 3 fallback
**File**: `src/app/api/products/[id]/sync/route.ts`
**Location**: Around line 807-850

**Add after 404 error**:
```typescript
if (descResponse.status === 404) {
  console.warn(`[SYNC] Local description ID not found (404) for "${localAttr.name}", trying alternative methods...`)
  
  // Alternative: Use the value text to find matching value
  // This will be handled by Strategy 4
  if (localValue.value) {
    console.log(`[SYNC] Will attempt Strategy 4 for "${localAttr.name}"`)
  }
}
```

---

## Phase 4: Add Validation and Pre-sync Checks (P2 - Medium)

### Problem
No validation before sync to ensure data is complete. Users discover issues only after sync fails.

### Solution
Add validation before sync to check if required IDs are present.

### Implementation Steps

#### Step 4.1: Add validation function
**File**: `src/app/api/products/[id]/sync/route.ts`
**Location**: Before the attribute sync section (around line 697)

**New Function**:
```typescript
function validateAttributeForSync(localAttr: any, shoprenterAttr: any): {
  valid: boolean
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []
  
  if (localAttr.type === 'LIST') {
    const localValue = Array.isArray(localAttr.value) ? localAttr.value[0] : null
    
    if (!localValue) {
      missing.push('value')
      return { valid: false, missing, warnings }
    }
    
    // Check if we have listAttributeValueId
    if (!localValue.listAttributeValueId) {
      warnings.push('listAttributeValueId not stored - will attempt to extract during sync')
    }
    
    // Check if we have description ID
    if (!localValue.id && !localValue.href) {
      warnings.push('listAttributeValueDescription ID not found')
    }
    
    // Check if ShopRenter has this attribute
    if (!shoprenterAttr) {
      missing.push('attribute in ShopRenter')
      return { valid: false, missing, warnings }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings
  }
}
```

#### Step 4.2: Use validation before sync
**File**: `src/app/api/products/[id]/sync/route.ts`
**Location**: Around line 730

**Add before processing**:
```typescript
// Validate attribute before processing
const validation = validateAttributeForSync(localAttr, shoprenterAttr)
if (!validation.valid) {
  console.warn(`[SYNC] Attribute "${localAttr.name}" validation failed:`, validation.missing)
  continue
}

if (validation.warnings.length > 0) {
  console.warn(`[SYNC] Attribute "${localAttr.name}" warnings:`, validation.warnings)
}
```

---

## Phase 5: Store Relation ID for Direct Updates (P2 - Medium)

### Problem
We search for relations every time we sync. If we stored the relation ID during pull, we could update directly.

### Solution
Extract and store `productListAttributeValueRelation` ID when pulling products.

### Implementation Steps

#### Step 5.1: Fetch relations during pull
**File**: `src/app/api/connections/[id]/sync-products/route.ts`
**Location**: After processing attributes (around line 2234)

**Add new section**:
```typescript
// For LIST attributes, fetch and store relation IDs
if (productAttributes && productAttributes.length > 0) {
  const listAttributes = productAttributes.filter((attr: any) => attr.type === 'LIST')
  
  if (listAttributes.length > 0 && apiBaseUrl && authHeaderParam) {
    try {
      // Fetch all relations for this product
      const relationsUrl = `${apiBaseUrl}/productListAttributeValueRelations?productId=${encodeURIComponent(product.id)}&full=1`
      const relationsResponse = await fetch(relationsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeaderParam
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (relationsResponse.ok) {
        const relationsData = await relationsResponse.json()
        const relations = relationsData.items || relationsData.productListAttributeValueRelations?.productListAttributeValueRelation || []
        const relationsArray = Array.isArray(relations) ? relations : [relations].filter(Boolean)
        
        // Create a map of attribute ID -> relation
        const relationMap = new Map<string, any>()
        for (const relation of relationsArray) {
          if (relation.listAttributeValue?.listAttribute?.id) {
            relationMap.set(relation.listAttributeValue.listAttribute.id, relation)
          }
        }
        
        // Add relation IDs to attributes
        for (const attr of listAttributes) {
          const attributeId = extractAttributeIdFromProductExtend(attr, product.productAttributeExtend)
          if (attributeId && relationMap.has(attributeId)) {
            const relation = relationMap.get(attributeId)
            if (Array.isArray(attr.value) && attr.value.length > 0) {
              attr.value[0].relationId = relation.id
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[SYNC] Failed to fetch relations for product ${product.sku}:`, error)
    }
  }
}
```

#### Step 5.2: Use stored relation ID during sync
**File**: `src/app/api/products/[id]/sync/route.ts`
**Location**: Around line 934 (before fetching all relations)

**Add check**:
```typescript
// Check if we have stored relation ID (from pull)
let existingRelation: any = null
if (localValue.relationId) {
  // Use stored relation ID directly
  const relationUrl = `${apiBaseUrl}/productListAttributeValueRelations/${encodeURIComponent(localValue.relationId)}?full=1`
  const relationResponse = await fetch(relationUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader
    },
    signal: AbortSignal.timeout(5000)
  })
  
  if (relationResponse.ok) {
    existingRelation = await relationResponse.json()
    console.log(`[SYNC] Using stored relation ID for "${localAttr.name}"`)
  }
}

// Fallback to searching if stored ID doesn't work
if (!existingRelation) {
  // ... existing code to search for relation ...
}
```

---

## Phase 6: Improve Logging and Debugging (P3 - Low)

### Problem
Current logs don't provide enough context to debug sync issues.

### Solution
Add comprehensive logging at each step.

### Implementation Steps

#### Step 6.1: Add detailed logging
- Log the exact structure of stored values
- Log which strategy is being used and why
- Log API request/response details (sanitized)
- Log timing information

**Example**:
```typescript
console.log(`[SYNC] Attribute "${localAttr.name}" sync details:`, {
  type: localAttr.type,
  hasListAttributeValueId: !!localValue.listAttributeValueId,
  hasDescriptionId: !!localValue.id,
  localValueText: localValue.value,
  shoprenterValueText: shoprenterAttr.value?.[0]?.value,
  strategies: {
    strategy1: !!localValue.listAttributeValueId,
    strategy2: !!shoprenterAttr.value?.[0]?.href,
    strategy3: !!localValue.id,
    strategy4: true // Always available
  }
})
```

---

## Testing Plan

### Test Cases

1. **Test Case 1: New product with LIST attributes**
   - Create product with LIST attributes
   - Pull from ShopRenter
   - Verify `listAttributeValueId` is stored
   - Change attribute value
   - Sync back
   - Verify value updated in ShopRenter

2. **Test Case 2: Existing product with missing IDs**
   - Use product that was synced before fix
   - Verify fallback strategies work
   - Sync and verify update

3. **Test Case 3: Attribute with 404 description**
   - Use attribute where description returns 404
   - Verify Strategy 4 handles it
   - Verify sync succeeds

4. **Test Case 4: Text matching edge cases**
   - Test with different text formats (whitespace, encoding)
   - Test with partial matches
   - Verify correct value is found

5. **Test Case 5: Performance**
   - Test with product having many LIST attributes
   - Verify API call count is reasonable
   - Verify timeout handling

### Migration Strategy

1. **Backward Compatibility**
   - Existing products without `listAttributeValueId` should still work via fallback strategies
   - No data migration needed immediately

2. **Gradual Rollout**
   - Deploy Phase 1 first (data storage fix)
   - Monitor for issues
   - Deploy Phase 2-3 (strategy improvements)
   - Deploy Phase 4-6 (enhancements)

3. **Data Cleanup** (Optional, later)
   - Run a migration script to backfill `listAttributeValueId` for existing products
   - This would improve sync performance but isn't required for functionality

---

## Implementation Order

1. **Phase 1** (P0) - Fix data storage during pull
2. **Phase 2** (P1) - Fix Strategy 4 text matching
3. **Phase 3** (P1) - Improve 404 error handling
4. **Phase 4** (P2) - Add validation
5. **Phase 5** (P2) - Store relation IDs
6. **Phase 6** (P3) - Improve logging

---

## Success Criteria

- ✅ LIST attribute values sync successfully from ERP to ShopRenter
- ✅ Existing products (without stored IDs) still sync via fallback strategies
- ✅ Sync completes without errors for products with LIST attributes
- ✅ Performance is acceptable (no excessive API calls)
- ✅ Clear error messages when sync fails

---

## Notes

- All changes should maintain backward compatibility
- Consider rate limiting for API calls
- Monitor API usage after deployment
- Consider caching description lookups if performance becomes an issue
