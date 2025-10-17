# Pages Setup Documentation

## Overview
This document provides a comprehensive guide to setting up pages in the Materialize Next.js Admin Template, based on the [official pages setup documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/apps-and-pages-setup/pages).

## What are Pages in Materialize?

Pages in the Materialize template are complete, standalone views that include:
- **Server-side rendering** - Data fetching and processing
- **API integration** - Backend communication
- **Component structure** - Reusable UI components
- **Styling** - Tailwind CSS and custom styles
- **Type safety** - TypeScript integration

## Current Project Pages Structure

### Starter Kit Analysis
The Materialize starter kit includes basic pages but **no complex page setup**. The current project structure shows:

```
src/app/
├── (blank-layout-pages)/
│   ├── layout.tsx
│   └── login/
│       └── page.tsx
├── (dashboard)/
│   ├── about/
│   │   └── page.tsx
│   ├── home/
│   │   └── page.tsx
│   └── layout.tsx
├── [...not-found]/
│   └── page.tsx
├── favicon.ico
├── globals.css
└── layout.tsx

src/views/
├── Login.tsx
└── NotFound.tsx
```

**Current Pages:**
- ✅ **Basic Pages**: `home`, `about`, `login`, `not-found`
- ❌ **Complex Pages**: No pages with API integration, fake-db, or complex components
- ❌ **Pages Structure**: No `src/views/pages/` directory
- ❌ **API Integration**: No pages with server-side data fetching

### Adding Complex Pages to Starter Kit
If you need complex pages with API integration for your ERP project, you'll need to create the full page structure manually following the procedures below.

## Pages Setup Guide

Based on the [official guide](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/apps-and-pages-setup/pages):

### ⚠️ Important Warning
When adding new pages that require dependencies not included in our package, it's essential to install the necessary packages. This ensures that all functionalities are supported and operational within our project framework. Proper package management is crucial for the seamless integration and performance of new pages.

## Complete Example: Creating a FAQ Page

Let's create a complete FAQ page following the official guide structure:

### Step 1: Create Type Definitions
Define the data types in `src/types/pages/faqTypes.ts`:

```typescript
export type FaqType = {
  id: number
  question: string
  answer: string
  category: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateFaqType = {
  question: string
  answer: string
  category: string
  isActive?: boolean
}

export type UpdateFaqType = {
  question?: string
  answer?: string
  category?: string
  isActive?: boolean
}
```

### Step 2: Create Fake Database
Create fake database file at `src/fake-db/pages/faq/index.ts`:

```typescript
import type { FaqType } from '@/types/pages/faqTypes'

export const db: FaqType[] = [
  {
    id: 1,
    question: 'What is Materialize?',
    answer: 'Materialize is a modern Next.js admin template built with Material-UI and TypeScript.',
    category: 'General',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    question: 'How do I customize the theme?',
    answer: 'You can customize the theme by modifying the mergedTheme.ts file in the components/theme directory.',
    category: 'Customization',
    isActive: true,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  },
  {
    id: 3,
    question: 'How do I add new pages?',
    answer: 'You can add new pages by creating page.tsx files in the app directory following the Next.js app router conventions.',
    category: 'Development',
    isActive: true,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z'
  },
  {
    id: 4,
    question: 'What dependencies are required?',
    answer: 'The template includes all necessary dependencies. Check the package.json file for the complete list.',
    category: 'Dependencies',
    isActive: true,
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z'
  },
  {
    id: 5,
    question: 'How do I deploy the application?',
    answer: 'You can deploy the application to Vercel, Netlify, or any other hosting platform that supports Next.js.',
    category: 'Deployment',
    isActive: true,
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z'
  }
]
```

### Step 3: Create API Route
Create API route at `src/app/api/pages/faq/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/fake-db/pages/faq'

export async function GET() {
  try {
    // Filter only active FAQs
    const activeFaqs = db.filter(faq => faq.isActive)
    return NextResponse.json(activeFaqs)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch FAQ data' },
      { status: 500 }
    )
  }
}
```

### Step 4: Create Page Component
Create the page component at `src/views/pages/faq/index.tsx`:

```typescript
'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material'

// Icon Imports
import { IconChevronDown, IconSearch } from '@tabler/icons-react'

// Type Imports
import type { FaqType } from '@/types/pages/faqTypes'

type Props = {
  data: FaqType[]
}

const FAQ = ({ data }: Props) => {
  // States
  const [searchTerm, setSearchTerm] = useState('')
  const [expanded, setExpanded] = useState<string | false>(false)

  // Filter FAQs based on search term
  const filteredFaqs = data.filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Group FAQs by category
  const groupedFaqs = filteredFaqs.reduce((acc, faq) => {
    if (!acc[faq.category]) {
      acc[faq.category] = []
    }
    acc[faq.category].push(faq)
    return acc
  }, {} as Record<string, FaqType[]>)

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false)
  }

  return (
    <Box className="p-6">
      {/* Header */}
      <Box className="mb-6">
        <Typography variant="h4" className="mb-2">
          Frequently Asked Questions
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Find answers to common questions about our platform
        </Typography>
      </Box>

      {/* Search */}
      <Box className="mb-6">
        <TextField
          fullWidth
          placeholder="Search FAQs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconSearch className="text-xl" />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* FAQ Categories */}
      {Object.entries(groupedFaqs).map(([category, faqs]) => (
        <Box key={category} className="mb-6">
          <Box className="mb-4">
            <Chip
              label={category}
              color="primary"
              variant="outlined"
              className="mb-2"
            />
            <Typography variant="h6" className="ml-2">
              {category} ({faqs.length} questions)
            </Typography>
          </Box>

          {/* FAQ Items */}
          {faqs.map((faq) => (
            <Accordion
              key={faq.id}
              expanded={expanded === `panel${faq.id}`}
              onChange={handleChange(`panel${faq.id}`)}
              className="mb-2"
            >
              <AccordionSummary
                expandIcon={<IconChevronDown />}
                aria-controls={`panel${faq.id}bh-content`}
                id={`panel${faq.id}bh-header`}
              >
                <Typography variant="subtitle1" className="font-medium">
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ))}

      {/* No Results */}
      {filteredFaqs.length === 0 && (
        <Box className="text-center py-8">
          <Typography variant="h6" color="text.secondary">
            No FAQs found matching your search criteria
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default FAQ
```

### Step 5: Create Server Page
Create the server page at `src/app/(dashboard)/pages/faq/page.tsx`:

```typescript
import type { FaqType } from '@/types/pages/faqTypes'
import FAQ from '@/views/pages/faq'

const getFaqData = async () => {
  const res = await fetch(`${process.env.API_URL}/pages/faq`, {
    cache: 'no-store' // For development, use 'no-store' to always fetch fresh data
  })
  
  if (!res.ok) {
    throw new Error('Failed to fetch FAQ data')
  }
  
  return res.json()
}

const FAQPage = async () => {
  const data: FaqType[] = await getFaqData()
  
  return <FAQ data={data} />
}

export default FAQPage
```

### Step 6: Create Custom Styles (Optional)
If custom styles are needed, create `src/views/pages/faq/styles.module.css`:

```css
.faqContainer {
  max-width: 1200px;
  margin: 0 auto;
}

.faqHeader {
  text-align: center;
  margin-bottom: 2rem;
}

.faqSearch {
  margin-bottom: 2rem;
}

.faqCategory {
  margin-bottom: 1.5rem;
}

.faqItem {
  margin-bottom: 0.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.faqQuestion {
  font-weight: 600;
  color: #1976d2;
}

.faqAnswer {
  color: #666;
  line-height: 1.6;
}

.noResults {
  text-align: center;
  padding: 2rem;
  color: #999;
}
```

## Page Structure Guidelines

### Directory Structure
```
src/
├── app/
│   └── (dashboard)/
│       └── pages/
│           └── [page-name]/
│               └── page.tsx          ← Server page component
├── views/
│   └── pages/
│       └── [page-name]/
│           ├── index.tsx             ← Client page component
│           └── styles.module.css     ← Custom styles (optional)
├── types/
│   └── pages/
│       └── [page-name]Types.ts       ← Type definitions
├── fake-db/
│   └── pages/
│       └── [page-name]/
│           └── index.ts              ← Fake database
└── app/
    └── api/
        └── pages/
            └── [page-name]/
                └── route.ts           ← API route
```

### File Naming Conventions
- **Server Pages**: `page.tsx` (Next.js convention)
- **Client Components**: `index.tsx`
- **Types**: `[pageName]Types.ts`
- **Styles**: `styles.module.css`
- **API Routes**: `route.ts`
- **Fake DB**: `index.ts`

## Page Development Best Practices

### 1. Server-Side Data Fetching
```typescript
const getPageData = async () => {
  try {
    const res = await fetch(`${process.env.API_URL}/pages/[page-name]`, {
      cache: 'no-store' // For development
      // cache: 'force-cache' // For production with static data
    })
    
    if (!res.ok) {
      throw new Error('Failed to fetch data')
    }
    
    return res.json()
  } catch (error) {
    console.error('Data fetching error:', error)
    throw error
  }
}
```

### 2. Error Handling
```typescript
const PageComponent = async () => {
  try {
    const data = await getPageData()
    return <PageView data={data} />
  } catch (error) {
    return (
      <Box className="p-6 text-center">
        <Typography variant="h6" color="error">
          Failed to load page data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please try again later
        </Typography>
      </Box>
    )
  }
}
```

### 3. Loading States
```typescript
import { Suspense } from 'react'

const PageWithLoading = () => {
  return (
    <Suspense fallback={
      <Box className="p-6 text-center">
        <Typography>Loading...</Typography>
      </Box>
    }>
      <PageComponent />
    </Suspense>
  )
}
```

### 4. Responsive Design
```typescript
// Use MUI responsive breakpoints
<Box
  sx={{
    display: 'flex',
    flexDirection: { xs: 'column', md: 'row' },
    gap: { xs: 2, md: 4 },
    padding: { xs: 2, md: 4 }
  }}
>
  {/* Content */}
</Box>
```

## Advanced Page Features

### 1. Dynamic Routes
For pages with dynamic parameters, create `src/app/(dashboard)/pages/[category]/[id]/page.tsx`:

```typescript
import { notFound } from 'next/navigation'

type Props = {
  params: { category: string; id: string }
}

const DynamicPage = async ({ params }: Props) => {
  const { category, id } = params
  
  try {
    const data = await getPageData(category, id)
    
    if (!data) {
      notFound()
    }
    
    return <PageView data={data} />
  } catch (error) {
    notFound()
  }
}

export default DynamicPage
```

### 2. Search and Filtering
```typescript
const [filters, setFilters] = useState({
  search: '',
  category: '',
  status: ''
})

const filteredData = data.filter(item => {
  return (
    item.title.toLowerCase().includes(filters.search.toLowerCase()) &&
    (filters.category === '' || item.category === filters.category) &&
    (filters.status === '' || item.status === filters.status)
  )
})
```

### 3. Pagination
```typescript
const [currentPage, setCurrentPage] = useState(1)
const itemsPerPage = 10

const paginatedData = data.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
)

const totalPages = Math.ceil(data.length / itemsPerPage)
```

## Testing Pages

### 1. Component Testing
```typescript
import { render, screen } from '@testing-library/react'
import FAQ from '@/views/pages/faq'

const mockData = [
  {
    id: 1,
    question: 'Test Question',
    answer: 'Test Answer',
    category: 'Test',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
]

test('renders FAQ page', () => {
  render(<FAQ data={mockData} />)
  expect(screen.getByText('Test Question')).toBeInTheDocument()
})
```

### 2. API Testing
```typescript
import { GET } from '@/app/api/pages/faq/route'

test('GET /api/pages/faq returns FAQ data', async () => {
  const response = await GET()
  const data = await response.json()
  
  expect(response.status).toBe(200)
  expect(Array.isArray(data)).toBe(true)
})
```

## Troubleshooting

### Issue: Page Not Loading
**Symptoms**: 404 error or blank page
**Solutions**:
1. Check file location and naming (`page.tsx`)
2. Verify route structure in `src/app/`
3. Ensure proper export of default component
4. Check for TypeScript errors

### Issue: Data Not Fetching
**Symptoms**: Page loads but no data displayed
**Solutions**:
1. Verify API route exists and is accessible
2. Check environment variables (`API_URL`)
3. Ensure fake-db data is properly exported
4. Check network requests in browser dev tools

### Issue: Styling Issues
**Symptoms**: Page looks broken or unstyled
**Solutions**:
1. Check Tailwind CSS classes
2. Verify MUI component imports
3. Ensure custom CSS modules are imported
4. Check for CSS conflicts

## Related Documentation

- [Next.js App Router](https://nextjs.org/docs/app/building-your-application/routing)
- [Next.js API Routes](./NEXTJS_API_ROUTES.md)
- [Theming Guide](./THEMING_GUIDE.md)
- [Folder Structure](./FOLDER_STRUCTURE.md#app-folder)

---
**Source**: [Materialize Pages Setup Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/apps-and-pages-setup/pages)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
list_dir
