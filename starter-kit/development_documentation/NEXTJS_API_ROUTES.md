# Next.js API Routes Documentation

## Overview
This document provides a comprehensive guide to utilizing Next.js API Routes in the Materialize Next.js Admin Template, based on the [official Next.js API documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/nextjs-api).

## What are Next.js API Routes?

Next.js API routes offer a user-friendly way to construct APIs within your Next.js application. These routes enable you to design server-side logic and API endpoints directly inside your app. They provide:

- **Server-side logic** - Handle backend operations
- **API endpoints** - Create RESTful APIs
- **Data processing** - Process requests and responses
- **Database integration** - Connect to databases
- **Authentication** - Handle user authentication

## Current Project API Structure

### Starter Kit Analysis
The Materialize starter kit **does not include API routes by default**. The current project structure shows:

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
```

**No API routes found:**
- ❌ `src/app/api/` - Directory doesn't exist
- ❌ `src/fake-db/` - Directory doesn't exist
- ❌ API route files - Not present

### Adding API Routes to Starter Kit
If you need API functionality for your ERP project, you'll need to create the API structure manually following the procedures below.

## API Routes Setup Guide

Based on the [official guide](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/nextjs-api):

### Step 1: Setting Up the Location
API routes reside in the `src/app/api` folder. To establish a new API route, create a new file within this directory.

**Create the API directory structure:**
```bash
mkdir -p src/app/api
```

### Step 2: Managing the Data
Data for the API routes is located in the `src/fake-db` folder by default. You can use your own database and API endpoints.

**Create the fake-db directory:**
```bash
mkdir -p src/fake-db
```

### Step 3: Configuring the Routing
Routes and API endpoints are managed in the `src/app/[lang]/` folder. You're encouraged to develop your API endpoints within this area.

**Note**: If you are not utilizing multiple languages in your app, you can bypass the `[lang]` folder in the `src/app/[lang]/**/**` path.

## Complete Example: Creating an API Route

Let's create a complete example following the official guide:

### Step 1: Create Data File
Create a data file at `src/fake-db/example/example.tsx`:

```typescript
import type { ExampleType } from '@/types/exampleTypes'

export const db: ExampleType[] = [
  {
    userId: 1,
    id: 1,
    title: 'delectus aut autem',
    completed: false
  },
  {
    userId: 1,
    id: 2,
    title: 'quis ut nam facilis et officia qui',
    completed: false
  },
  {
    userId: 1,
    id: 3,
    title: 'fugiat veniam minus',
    completed: false
  },
  {
    userId: 1,
    id: 4,
    title: 'et porro tempora',
    completed: true
  },
  {
    userId: 1,
    id: 5,
    title: 'laboriosam mollitia et enim quasi adipisci quia provident illum',
    completed: false
  }
]
```

### Step 2: Define Data Types
Define the data types in `src/types/exampleTypes.tsx` file:

```typescript
export type ExampleType = {
  userId: number
  id: number
  title: string
  completed: boolean
}

export type CreateExampleType = {
  userId: number
  title: string
  completed: boolean
}

export type UpdateExampleType = {
  title?: string
  completed?: boolean
}
```

### Step 3: Create API Routes
Establish your API routes in `src/app/api/example/route.ts` file:

```typescript
// Next Imports
import { NextRequest, NextResponse } from 'next/server'

// Data Imports
import { db } from '@/fake-db/example/example'

// GET - Fetch all examples
export async function GET() {
  try {
    return NextResponse.json(db)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch examples' },
      { status: 500 }
    )
  }
}

// POST - Create new example
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, title, completed } = body

    // Validate required fields
    if (!userId || !title) {
      return NextResponse.json(
        { error: 'userId and title are required' },
        { status: 400 }
      )
    }

    // Create new example
    const newExample = {
      userId,
      id: db.length + 1,
      title,
      completed: completed || false
    }

    db.push(newExample)

    return NextResponse.json(newExample, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create example' },
      { status: 500 }
    )
  }
}
```

### Step 4: Create Individual Resource API Route
For individual resource operations, create `src/app/api/example/[id]/route.ts`:

```typescript
// Next Imports
import { NextRequest, NextResponse } from 'next/server'

// Data Imports
import { db } from '@/fake-db/example/example'

// GET - Fetch single example
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const example = db.find(item => item.id === id)

    if (!example) {
      return NextResponse.json(
        { error: 'Example not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(example)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch example' },
      { status: 500 }
    )
  }
}

// PUT - Update example
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const { title, completed } = body

    const exampleIndex = db.findIndex(item => item.id === id)

    if (exampleIndex === -1) {
      return NextResponse.json(
        { error: 'Example not found' },
        { status: 404 }
      )
    }

    // Update example
    db[exampleIndex] = {
      ...db[exampleIndex],
      ...(title && { title }),
      ...(completed !== undefined && { completed })
    }

    return NextResponse.json(db[exampleIndex])
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update example' },
      { status: 500 }
    )
  }
}

// DELETE - Delete example
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const exampleIndex = db.findIndex(item => item.id === id)

    if (exampleIndex === -1) {
      return NextResponse.json(
        { error: 'Example not found' },
        { status: 404 }
      )
    }

    // Remove example
    const deletedExample = db.splice(exampleIndex, 1)[0]

    return NextResponse.json(deletedExample)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete example' },
      { status: 500 }
    )
  }
}
```

### Step 5: Create API Endpoints Page
Define your API endpoints in `src/app/(dashboard)/example/page.tsx` file:

```typescript
import type { ExampleType } from '@/types/exampleTypes'

const getExampleData = async () => {
  // API_URL variable is defined in .env file
  const res = await fetch(`${process.env.API_URL}/example`, {
    cache: 'no-store' // For development, use 'no-store' to always fetch fresh data
  })
  
  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }
  
  return res.json()
}

const ExamplePage = async () => {
  // Vars
  const data: ExampleType[] = await getExampleData()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Example Data</h1>
      <div className="grid gap-4">
        {data.map(item => (
          <div key={item.id} className="p-4 border rounded-lg">
            <div className="font-semibold">{item.title}</div>
            <div className="text-sm text-gray-600">
              Status: {item.completed ? 'Completed' : 'Pending'}
            </div>
            <div className="text-xs text-gray-500">
              User ID: {item.userId} | ID: {item.id}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ExamplePage
```

### Step 6: Update Environment Variables
Ensure your `.env` file includes the API URL:

```bash
# .env
API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## API Route Patterns

### Basic CRUD Operations

#### Collection Routes (`/api/example`)
- `GET /api/example` - Fetch all items
- `POST /api/example` - Create new item

#### Individual Resource Routes (`/api/example/[id]`)
- `GET /api/example/[id]` - Fetch single item
- `PUT /api/example/[id]` - Update item
- `DELETE /api/example/[id]` - Delete item

### Advanced Patterns

#### Query Parameters
```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page')
  const limit = searchParams.get('limit')
  
  // Handle pagination
  const startIndex = (parseInt(page || '1') - 1) * parseInt(limit || '10')
  const endIndex = startIndex + parseInt(limit || '10')
  
  const paginatedData = db.slice(startIndex, endIndex)
  
  return NextResponse.json({
    data: paginatedData,
    pagination: {
      page: parseInt(page || '1'),
      limit: parseInt(limit || '10'),
      total: db.length
    }
  })
}
```

#### Error Handling
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validation
    if (!body.title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }
    
    // Business logic
    const newItem = { ...body, id: Date.now() }
    
    return NextResponse.json(newItem, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Authentication Middleware
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check for authentication token
  const token = request.headers.get('authorization')
  
  if (!token && request.nextUrl.pathname.startsWith('/api/protected')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/protected/:path*'
}
```

## Testing API Routes

### Manual Testing with curl
```bash
# GET request
curl http://localhost:3000/api/example

# POST request
curl -X POST http://localhost:3000/api/example \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "title": "New Example", "completed": false}'

# PUT request
curl -X PUT http://localhost:3000/api/example/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Example", "completed": true}'

# DELETE request
curl -X DELETE http://localhost:3000/api/example/1
```

### Testing with JavaScript
```typescript
// Test API endpoints
const testAPI = async () => {
  try {
    // GET
    const getResponse = await fetch('/api/example')
    const getData = await getResponse.json()
    console.log('GET:', getData)

    // POST
    const postResponse = await fetch('/api/example', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 1,
        title: 'Test Example',
        completed: false
      })
    })
    const postData = await postResponse.json()
    console.log('POST:', postData)

    // PUT
    const putResponse = await fetch('/api/example/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated Test Example',
        completed: true
      })
    })
    const putData = await putResponse.json()
    console.log('PUT:', putData)

    // DELETE
    const deleteResponse = await fetch('/api/example/1', {
      method: 'DELETE'
    })
    const deleteData = await deleteResponse.json()
    console.log('DELETE:', deleteData)

  } catch (error) {
    console.error('API Test Error:', error)
  }
}
```

## Best Practices

### 1. API Design
- Use RESTful conventions
- Implement proper HTTP status codes
- Include error handling
- Validate input data
- Use consistent response formats

### 2. Security
- Implement authentication/authorization
- Validate and sanitize inputs
- Use HTTPS in production
- Implement rate limiting
- Handle CORS properly

### 3. Performance
- Implement caching where appropriate
- Use pagination for large datasets
- Optimize database queries
- Consider using streaming for large responses

### 4. Error Handling
- Use appropriate HTTP status codes
- Provide meaningful error messages
- Log errors for debugging
- Handle edge cases gracefully

## Troubleshooting

### Issue: API Route Not Found
**Symptoms**: 404 error when accessing API endpoint
**Solutions**:
1. Check file location (`src/app/api/`)
2. Verify file naming (`route.ts` not `api.ts`)
3. Ensure proper export of HTTP methods
4. Check Next.js version compatibility

### Issue: CORS Errors
**Symptoms**: Cross-origin request blocked
**Solutions**:
1. Configure CORS headers in API route
2. Check browser developer tools
3. Verify request origin
4. Use proper CORS middleware

### Issue: Data Not Persisting
**Symptoms**: Changes don't persist between requests
**Solutions**:
1. Check if using in-memory storage (fake-db)
2. Implement proper database integration
3. Verify data mutation logic
4. Check for concurrent access issues

## Related Documentation

- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [Folder Structure](./FOLDER_STRUCTURE.md#app-folder)

---
**Source**: [Materialize Next.js API Documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/development/nextjs-api)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
list_dir
