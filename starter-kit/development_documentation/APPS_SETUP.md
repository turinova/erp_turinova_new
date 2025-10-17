# Apps Setup Documentation

## Overview
This document provides a comprehensive guide to setting up applications (apps) in the Materialize Next.js Admin Template, based on the [official apps setup documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/apps-and-pages-setup/apps).

## What are Apps in Materialize?

Apps in the Materialize template are complex, feature-rich applications that include:
- **Multi-page functionality** - Multiple views and routes within a single app
- **Advanced data management** - Complex data structures and operations
- **API integration** - Comprehensive backend communication
- **Component architecture** - Multiple interconnected components
- **Business logic** - Complex workflows and state management
- **Styling** - Advanced UI/UX with custom components

## Current Project Apps Structure

### Starter Kit Analysis
The Materialize starter kit includes basic pages but **no complex apps setup**. The current project structure shows:

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

**Current Apps Status:**
- ✅ **Basic Pages**: `home`, `about`, `login`, `not-found`
- ❌ **Complex Apps**: No apps with multi-page functionality
- ❌ **Apps Structure**: No `src/views/apps/` directory
- ❌ **Apps API**: No `src/app/api/apps/` directory
- ❌ **Apps Database**: No `src/fake-db/apps/` directory
- ❌ **Apps Types**: No `src/types/apps/` directory

### Adding Complex Apps to Starter Kit
If you need complex apps with multi-page functionality for your ERP project, you'll need to create the full app structure manually following the procedures below.

## Apps Setup Guide

Based on the [official guide](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/apps-and-pages-setup/apps):

### ⚠️ Important Warning
When adding new apps that require dependencies not included in our package, it's essential to install the necessary packages. This ensures that all app functionalities are supported and operational within our project framework. Proper package management is crucial for the seamless integration and performance of new apps.

## Complete Example: Creating an Invoice App

Let's create a complete Invoice app following the official guide structure with multiple pages and complex functionality:

### Step 1: Create Type Definitions
Define the data types in `src/types/apps/invoiceTypes.ts`:

```typescript
export type InvoiceType = {
  id: string
  name: string
  total: number
  avatar: string
  service: string
  dueDate: string
  address: string
  company: string
  country: string
  contact: string
  avatarColor: string
  issuedDate: string
  companyEmail: string
  balance: number
  invoiceStatus: 'Paid' | 'Downloaded' | 'Draft' | 'Sent' | 'Past Due'
  clientId: string
}

export type CreateInvoiceType = {
  name: string
  service: string
  dueDate: string
  address: string
  company: string
  country: string
  contact: string
  companyEmail: string
  total: number
  invoiceStatus?: 'Draft' | 'Sent'
}

export type UpdateInvoiceType = {
  name?: string
  service?: string
  dueDate?: string
  address?: string
  company?: string
  country?: string
  contact?: string
  companyEmail?: string
  total?: number
  invoiceStatus?: 'Paid' | 'Downloaded' | 'Draft' | 'Sent' | 'Past Due'
}

export type InvoiceStatsType = {
  totalInvoice: number
  paid: number
  unpaid: number
  draft: number
  totalRevenue: number
}
```

### Step 2: Create Fake Database
Create fake database file at `src/fake-db/apps/invoice/index.ts`:

```typescript
import type { InvoiceType } from '@/types/apps/invoiceTypes'

export const db: InvoiceType[] = [
  {
    id: '4987',
    name: 'Sally Quinn',
    total: 316,
    avatar: '',
    service: 'UI Design',
    dueDate: '2024-12-25',
    address: '190 Thornhill Cir. NW, Calgary, AB T3A 0H4, Canada',
    company: 'Acme Corporation',
    country: 'Canada',
    contact: '(403) 555-0124',
    avatarColor: 'primary',
    issuedDate: '2024-12-01',
    companyEmail: 'sally@acme.com',
    balance: 316,
    invoiceStatus: 'Paid',
    clientId: '1'
  },
  {
    id: '4988',
    name: 'Margaret Bowers',
    total: 242,
    avatar: '',
    service: 'UX Design',
    dueDate: '2024-12-20',
    address: '123 Main St, Toronto, ON M5H 1A1, Canada',
    company: 'Tech Solutions Inc',
    country: 'Canada',
    contact: '(416) 555-0125',
    avatarColor: 'secondary',
    issuedDate: '2024-11-28',
    companyEmail: 'margaret@techsolutions.com',
    balance: 0,
    invoiceStatus: 'Paid',
    clientId: '2'
  },
  {
    id: '4989',
    name: 'Kathryn Murphy',
    total: 175,
    avatar: '',
    service: 'Frontend Development',
    dueDate: '2024-12-15',
    address: '456 Oak Ave, Vancouver, BC V6B 1A1, Canada',
    company: 'Digital Agency',
    country: 'Canada',
    contact: '(604) 555-0126',
    avatarColor: 'success',
    issuedDate: '2024-11-25',
    companyEmail: 'kathryn@digitalagency.com',
    balance: 175,
    invoiceStatus: 'Sent',
    clientId: '3'
  },
  {
    id: '4990',
    name: 'Arthur Moody',
    total: 451,
    avatar: '',
    service: 'Backend Development',
    dueDate: '2024-12-10',
    address: '789 Pine St, Montreal, QC H3A 1A1, Canada',
    company: 'Software Corp',
    country: 'Canada',
    contact: '(514) 555-0127',
    avatarColor: 'error',
    issuedDate: '2024-11-20',
    companyEmail: 'arthur@softwarecorp.com',
    balance: 451,
    invoiceStatus: 'Draft',
    clientId: '4'
  },
  {
    id: '4991',
    name: 'Jannie Cooper',
    total: 284,
    avatar: '',
    service: 'Full Stack Development',
    dueDate: '2024-12-05',
    address: '321 Elm St, Ottawa, ON K1A 0A1, Canada',
    company: 'Innovation Labs',
    country: 'Canada',
    contact: '(613) 555-0128',
    avatarColor: 'warning',
    issuedDate: '2024-11-15',
    companyEmail: 'jannie@innovationlabs.com',
    balance: 284,
    invoiceStatus: 'Past Due',
    clientId: '5'
  }
]
```

### Step 3: Create API Routes
Create API route at `src/app/api/apps/invoice/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/fake-db/apps/invoice'

export async function GET() {
  try {
    return NextResponse.json(db)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch invoice data' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Generate new ID
    const newId = (Math.max(...db.map(invoice => parseInt(invoice.id))) + 1).toString()
    
    const newInvoice = {
      id: newId,
      ...body,
      avatar: '',
      avatarColor: 'primary',
      issuedDate: new Date().toISOString().split('T')[0],
      balance: body.total || 0,
      clientId: (db.length + 1).toString()
    }
    
    db.push(newInvoice)
    
    return NextResponse.json(newInvoice, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
```

### Step 4: Create Invoice List Component
Create the main invoice list component at `src/views/apps/invoice/list/index.tsx`:

```typescript
'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Button,
  Grid
} from '@mui/material'

// Icon Imports
import { 
  IconDotsVertical, 
  IconSearch, 
  IconPlus,
  IconDownload,
  IconEye,
  IconEdit,
  IconTrash
} from '@tabler/icons-react'

// Type Imports
import type { InvoiceType } from '@/types/apps/invoiceTypes'

type Props = {
  data: InvoiceType[]
}

const InvoiceList = ({ data }: Props) => {
  // States
  const [searchTerm, setSearchTerm] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceType | null>(null)

  // Filter invoices based on search term
  const filteredInvoices = data.filter(invoice =>
    invoice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.service.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoiceStatus.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoice: InvoiceType) => {
    setAnchorEl(event.currentTarget)
    setSelectedInvoice(invoice)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedInvoice(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'success'
      case 'Sent': return 'info'
      case 'Draft': return 'warning'
      case 'Past Due': return 'error'
      default: return 'default'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  return (
    <Box className="p-6">
      {/* Header */}
      <Box className="mb-6">
        <Typography variant="h4" className="mb-2">
          Invoice Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your invoices and track payments
        </Typography>
      </Box>

      {/* Actions Bar */}
      <Box className="mb-6 flex justify-between items-center">
        <Box className="flex items-center gap-4">
          <TextField
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconSearch className="text-xl" />
                </InputAdornment>
              )
            }}
            size="small"
          />
        </Box>
        <Button
          variant="contained"
          startIcon={<IconPlus />}
          className="bg-primary"
        >
          Add Invoice
        </Button>
      </Box>

      {/* Invoice Cards */}
      <Grid container spacing={3}>
        {filteredInvoices.map((invoice) => (
          <Grid item xs={12} md={6} lg={4} key={invoice.id}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent>
                <Box className="flex justify-between items-start mb-4">
                  <Box className="flex items-center gap-3">
                    <Avatar className="bg-primary text-white">
                      {invoice.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" className="font-medium">
                        {invoice.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {invoice.company}
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, invoice)}
                  >
                    <IconDotsVertical />
                  </IconButton>
                </Box>

                <Box className="mb-4">
                  <Typography variant="body2" color="text.secondary" className="mb-1">
                    Service
                  </Typography>
                  <Typography variant="subtitle2">
                    {invoice.service}
                  </Typography>
                </Box>

                <Box className="mb-4">
                  <Typography variant="body2" color="text.secondary" className="mb-1">
                    Total Amount
                  </Typography>
                  <Typography variant="h6" className="font-medium">
                    {formatCurrency(invoice.total)}
                  </Typography>
                </Box>

                <Box className="flex justify-between items-center">
                  <Chip
                    label={invoice.invoiceStatus}
                    color={getStatusColor(invoice.invoiceStatus) as any}
                    size="small"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* No Results */}
      {filteredInvoices.length === 0 && (
        <Box className="text-center py-8">
          <Typography variant="h6" color="text.secondary">
            No invoices found matching your search criteria
          </Typography>
        </Box>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <IconEye className="mr-2" />
          View Details
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <IconEdit className="mr-2" />
          Edit Invoice
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <IconDownload className="mr-2" />
          Download PDF
        </MenuItem>
        <MenuItem onClick={handleMenuClose} className="text-red-500">
          <IconTrash className="mr-2" />
          Delete Invoice
        </MenuItem>
      </Menu>
    </Box>
  )
}

export default InvoiceList
```

### Step 5: Create Invoice Preview Component
Create the invoice preview component at `src/views/apps/invoice/preview/index.tsx`:

```typescript
'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  Divider,
  Grid,
  IconButton
} from '@mui/material'

// Icon Imports
import { 
  IconDownload, 
  IconEdit, 
  IconArrowLeft,
  IconPrinter
} from '@tabler/icons-react'

// Type Imports
import type { InvoiceType } from '@/types/apps/invoiceTypes'

type Props = {
  invoiceData: InvoiceType
  id: string
}

const InvoicePreview = ({ invoiceData, id }: Props) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'success'
      case 'Sent': return 'info'
      case 'Draft': return 'warning'
      case 'Past Due': return 'error'
      default: return 'default'
    }
  }

  return (
    <Box className="p-6">
      {/* Header */}
      <Box className="mb-6 flex justify-between items-center">
        <Box className="flex items-center gap-3">
          <IconButton>
            <IconArrowLeft />
          </IconButton>
          <Box>
            <Typography variant="h4">
              Invoice #{invoiceData.id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Preview Invoice Details
            </Typography>
          </Box>
        </Box>
        <Box className="flex gap-2">
          <Button
            variant="outlined"
            startIcon={<IconEdit />}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            startIcon={<IconPrinter />}
          >
            Print
          </Button>
          <Button
            variant="contained"
            startIcon={<IconDownload />}
            className="bg-primary"
          >
            Download PDF
          </Button>
        </Box>
      </Box>

      {/* Invoice Card */}
      <Card>
        <CardContent className="p-8">
          {/* Invoice Header */}
          <Box className="mb-8">
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Typography variant="h5" className="mb-2">
                  Invoice Details
                </Typography>
                <Typography variant="body1" className="mb-1">
                  <strong>Invoice #:</strong> {invoiceData.id}
                </Typography>
                <Typography variant="body1" className="mb-1">
                  <strong>Issue Date:</strong> {new Date(invoiceData.issuedDate).toLocaleDateString()}
                </Typography>
                <Typography variant="body1" className="mb-1">
                  <strong>Due Date:</strong> {new Date(invoiceData.dueDate).toLocaleDateString()}
                </Typography>
                <Box className="mt-2">
                  <Chip
                    label={invoiceData.invoiceStatus}
                    color={getStatusColor(invoiceData.invoiceStatus) as any}
                    size="small"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h5" className="mb-2">
                  Bill To
                </Typography>
                <Typography variant="body1" className="mb-1">
                  <strong>{invoiceData.name}</strong>
                </Typography>
                <Typography variant="body1" className="mb-1">
                  {invoiceData.company}
                </Typography>
                <Typography variant="body1" className="mb-1">
                  {invoiceData.address}
                </Typography>
                <Typography variant="body1" className="mb-1">
                  {invoiceData.country}
                </Typography>
                <Typography variant="body1" className="mb-1">
                  {invoiceData.contact}
                </Typography>
                <Typography variant="body1">
                  {invoiceData.companyEmail}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          <Divider className="my-6" />

          {/* Service Details */}
          <Box className="mb-6">
            <Typography variant="h6" className="mb-4">
              Service Details
            </Typography>
            <Box className="bg-gray-50 p-4 rounded-lg">
              <Typography variant="body1">
                <strong>Service:</strong> {invoiceData.service}
              </Typography>
            </Box>
          </Box>

          <Divider className="my-6" />

          {/* Amount Summary */}
          <Box className="text-right">
            <Typography variant="h5" className="mb-2">
              Total Amount: {formatCurrency(invoiceData.total)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Balance: {formatCurrency(invoiceData.balance)}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

export default InvoicePreview
```

### Step 6: Create Server Pages
Create the main invoice list page at `src/app/(dashboard)/apps/invoice/page.tsx`:

```typescript
import type { InvoiceType } from '@/types/apps/invoiceTypes'
import InvoiceList from '@/views/apps/invoice/list'

const getInvoiceData = async () => {
  const res = await fetch(`${process.env.API_URL}/apps/invoice`, {
    cache: 'no-store' // For development
  })
  
  if (!res.ok) {
    throw new Error('Failed to fetch invoice data')
  }
  
  return res.json()
}

const InvoicePage = async () => {
  const data: InvoiceType[] = await getInvoiceData()
  
  return <InvoiceList data={data} />
}

export default InvoicePage
```

Create the invoice preview page at `src/app/(dashboard)/apps/invoice/preview/[id]/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import type { InvoiceType } from '@/types/apps/invoiceTypes'
import InvoicePreview from '@/views/apps/invoice/preview'

const getInvoiceData = async () => {
  const res = await fetch(`${process.env.API_URL}/apps/invoice`, {
    cache: 'no-store'
  })
  
  if (!res.ok) {
    throw new Error('Failed to fetch invoice data')
  }
  
  return res.json()
}

const InvoicePreviewPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params
  
  const data: InvoiceType[] = await getInvoiceData()
  const filteredData = data.filter((invoice: InvoiceType) => invoice.id === params.id)[0]
  
  if (!filteredData) {
    redirect('/not-found')
  }
  
  return <InvoicePreview invoiceData={filteredData} id={params.id} />
}

export default InvoicePreviewPage
```

## App Structure Guidelines

### Directory Structure
```
src/
├── app/
│   └── (dashboard)/
│       └── apps/
│           └── [app-name]/
│               ├── page.tsx                    ← Main app page
│               ├── preview/
│               │   └── [id]/
│               │       └── page.tsx            ← Preview page
│               ├── add/
│               │   └── page.tsx                ← Add new item page
│               └── edit/
│                   └── [id]/
│                       └── page.tsx            ← Edit item page
├── views/
│   └── apps/
│       └── [app-name]/
│           ├── list/
│           │   └── index.tsx                   ← List component
│           ├── preview/
│           │   └── index.tsx                  ← Preview component
│           ├── add/
│           │   └── index.tsx                   ← Add form component
│           ├── edit/
│           │   └── index.tsx                   ← Edit form component
│           └── styles.module.css               ← Custom styles
├── types/
│   └── apps/
│       └── [app-name]Types.ts                  ← Type definitions
├── fake-db/
│   └── apps/
│       └── [app-name]/
│           └── index.ts                        ← Fake database
└── app/
    └── api/
        └── apps/
            └── [app-name]/
                └── route.ts                    ← API route
```

### File Naming Conventions
- **Server Pages**: `page.tsx` (Next.js convention)
- **Client Components**: `index.tsx`
- **Types**: `[appName]Types.ts`
- **Styles**: `styles.module.css`
- **API Routes**: `route.ts`
- **Fake DB**: `index.ts`

## App Development Best Practices

### 1. Multi-Page Architecture
```typescript
// Main app page - list view
const AppPage = async () => {
  const data = await getAppData()
  return <AppList data={data} />
}

// Detail page - preview/edit view
const AppDetailPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const data = await getAppDataById(id)
  
  if (!data) {
    redirect('/not-found')
  }
  
  return <AppDetail data={data} id={id} />
}
```

### 2. Complex State Management
```typescript
// Use context for app-wide state
const AppContext = createContext<{
  data: AppType[]
  setData: (data: AppType[]) => void
  loading: boolean
  setLoading: (loading: boolean) => void
}>({
  data: [],
  setData: () => {},
  loading: false,
  setLoading: () => {}
})

// Provider component
const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<AppType[]>([])
  const [loading, setLoading] = useState(false)
  
  return (
    <AppContext.Provider value={{ data, setData, loading, setLoading }}>
      {children}
    </AppContext.Provider>
  )
}
```

### 3. Advanced Data Operations
```typescript
// CRUD operations
const createItem = async (item: CreateAppType) => {
  const response = await fetch('/api/apps/[app-name]', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  })
  
  if (!response.ok) {
    throw new Error('Failed to create item')
  }
  
  return response.json()
}

const updateItem = async (id: string, item: UpdateAppType) => {
  const response = await fetch(`/api/apps/[app-name]/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  })
  
  if (!response.ok) {
    throw new Error('Failed to update item')
  }
  
  return response.json()
}

const deleteItem = async (id: string) => {
  const response = await fetch(`/api/apps/[app-name]/${id}`, {
    method: 'DELETE'
  })
  
  if (!response.ok) {
    throw new Error('Failed to delete item')
  }
  
  return response.json()
}
```

### 4. Advanced UI Components
```typescript
// Data table with sorting, filtering, pagination
const DataTable = ({ data }: { data: AppType[] }) => {
  const [sortField, setSortField] = useState<keyof AppType>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  
  const sortedData = data.sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })
  
  const paginatedData = sortedData.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  )
  
  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.field}
                onClick={() => handleSort(column.field)}
                className="cursor-pointer"
              >
                {column.header}
                {sortField === column.field && (
                  <IconSortAsc className="ml-1" />
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map((item) => (
            <TableRow key={item.id}>
              {/* Table cells */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
```

## Advanced App Features

### 1. Dashboard with Statistics
```typescript
const AppDashboard = ({ data }: { data: AppType[] }) => {
  const stats = useMemo(() => {
    return {
      total: data.length,
      active: data.filter(item => item.status === 'active').length,
      pending: data.filter(item => item.status === 'pending').length,
      completed: data.filter(item => item.status === 'completed').length,
      totalRevenue: data.reduce((sum, item) => sum + item.amount, 0)
    }
  }, [data])
  
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h4">{stats.total}</Typography>
            <Typography variant="body2">Total Items</Typography>
          </CardContent>
        </Card>
      </Grid>
      {/* More stat cards */}
    </Grid>
  )
}
```

### 2. Advanced Filtering and Search
```typescript
const AdvancedFilters = ({ onFilter }: { onFilter: (filters: FilterType) => void }) => {
  const [filters, setFilters] = useState<FilterType>({
    search: '',
    status: '',
    dateRange: null,
    category: '',
    amountRange: { min: 0, max: 10000 }
  })
  
  const handleFilterChange = (field: keyof FilterType, value: any) => {
    const newFilters = { ...filters, [field]: value }
    setFilters(newFilters)
    onFilter(newFilters)
  }
  
  return (
    <Box className="p-4 bg-gray-50 rounded-lg">
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <TextField
            label="Search"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        {/* More filter fields */}
      </Grid>
    </Box>
  )
}
```

### 3. Export and Import Functionality
```typescript
const ExportImport = ({ data }: { data: AppType[] }) => {
  const handleExport = () => {
    const csvContent = convertToCSV(data)
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `app-data-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const csvData = e.target?.result as string
        const importedData = parseCSV(csvData)
        // Process imported data
      }
      reader.readAsText(file)
    }
  }
  
  return (
    <Box className="flex gap-2">
      <Button
        variant="outlined"
        startIcon={<IconDownload />}
        onClick={handleExport}
      >
        Export CSV
      </Button>
      <Button
        variant="outlined"
        component="label"
        startIcon={<IconUpload />}
      >
        Import CSV
        <input
          type="file"
          accept=".csv"
          onChange={handleImport}
          hidden
        />
      </Button>
    </Box>
  )
}
```

## Testing Apps

### 1. Component Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import InvoiceList from '@/views/apps/invoice/list'

const mockData = [
  {
    id: '1',
    name: 'Test User',
    company: 'Test Company',
    total: 100,
    invoiceStatus: 'Paid',
    // ... other required fields
  }
]

test('renders invoice list', () => {
  render(<InvoiceList data={mockData} />)
  expect(screen.getByText('Test User')).toBeInTheDocument()
})

test('filters invoices by search', () => {
  render(<InvoiceList data={mockData} />)
  const searchInput = screen.getByPlaceholderText('Search invoices...')
  fireEvent.change(searchInput, { target: { value: 'Test' } })
  expect(screen.getByText('Test User')).toBeInTheDocument()
})
```

### 2. API Testing
```typescript
import { GET, POST } from '@/app/api/apps/invoice/route'

test('GET /api/apps/invoice returns invoice data', async () => {
  const response = await GET()
  const data = await response.json()
  
  expect(response.status).toBe(200)
  expect(Array.isArray(data)).toBe(true)
})

test('POST /api/apps/invoice creates new invoice', async () => {
  const newInvoice = {
    name: 'New User',
    company: 'New Company',
    total: 200,
    // ... other required fields
  }
  
  const response = await POST(new Request('http://localhost:3000/api/apps/invoice', {
    method: 'POST',
    body: JSON.stringify(newInvoice)
  }))
  
  expect(response.status).toBe(201)
})
```

## Troubleshooting

### Issue: App Not Loading
**Symptoms**: 404 error or blank page
**Solutions**:
1. Check file location and naming (`page.tsx`)
2. Verify route structure in `src/app/(dashboard)/apps/`
3. Ensure proper export of default component
4. Check for TypeScript errors

### Issue: Multi-Page Navigation Issues
**Symptoms**: Links between app pages not working
**Solutions**:
1. Verify dynamic route structure (`[id]/page.tsx`)
2. Check parameter passing in server components
3. Ensure proper Next.js routing conventions
4. Test with different parameter values

### Issue: Complex State Management
**Symptoms**: State not updating across components
**Solutions**:
1. Use React Context for app-wide state
2. Implement proper state lifting
3. Consider using state management libraries
4. Debug with React DevTools

### Issue: Performance Issues
**Symptoms**: Slow loading or rendering
**Solutions**:
1. Implement proper data pagination
2. Use React.memo for expensive components
3. Optimize API calls with caching
4. Implement virtual scrolling for large lists

## Related Documentation

- [Pages Setup](./PAGES_SETUP.md) - Basic page development
- [Next.js API Routes](./NEXTJS_API_ROUTES.md) - API development
- [Theming Guide](./THEMING_GUIDE.md) - App styling
- [Folder Structure](./FOLDER_STRUCTURE.md#app-folder)

---
**Source**: [Materialize Apps Setup Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/apps-and-pages-setup/apps)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
list_dir
