# Authentication Documentation

## Overview
This document provides a comprehensive guide to authentication in the Materialize Next.js Admin Template, covering NextAuth.js implementation, credentials provider, Google provider with Prisma adapter, and page security. Based on the [official Materialize authentication documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/intro).

## Current Project Analysis

### Current Project Authentication Status

The Materialize starter kit includes a basic authentication structure but **does not include full NextAuth.js implementation by default**:

```
src/
├── views/
│   └── Login.tsx                    ← Basic login form (UI only)
├── app/
│   └── (blank-layout-pages)/
│       └── login/
│           └── page.tsx            ← Login page route
└── components/
    └── layout/
        └── shared/
            └── UserDropdown.tsx     ← User dropdown component
```

**Current Authentication Status:**
- ❌ **NextAuth.js**: Not implemented in starter kit
- ❌ **API Routes**: No authentication API routes present
- ❌ **Auth Configuration**: No auth.ts file present
- ❌ **Database Integration**: No Prisma setup for authentication
- ❌ **Session Management**: No session handling implemented
- ✅ **Login UI**: Basic login form present (UI only)
- ✅ **Login Route**: Login page route present
- ✅ **User Components**: User dropdown component present

**Note**: The starter kit provides the UI components for authentication but requires implementation of the actual authentication logic using NextAuth.js or custom authentication.

## Authentication with NextAuth.js

Based on the [official authentication introduction documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/intro):

### Overview
Welcome to the world of modern authentication powered by NextAuth.js! The Materialize template focuses on password-less authentication to enhance security and user experience. NextAuth.js provides robust features and flexibility for authentication implementation.

### Why NextAuth.js?

At the heart of the authentication philosophy lies the idea of password-less authentication, which enhances security and user experience. NextAuth.js is chosen for its:

- **Robust Features**: Comprehensive authentication capabilities
- **Flexibility**: Multiple authentication methods support
- **Security**: Built-in security best practices
- **Integration**: Seamless integration with Next.js
- **Provider Support**: Multiple OAuth providers support

### Getting Started

NextAuth.js implementation focuses on two widely used authentication methods:

1. **Credentials Provider** - Traditional username/password authentication
2. **Google Provider and Prisma Adapter** - OAuth integration with database management

### Authentication Methods

#### 1. Credentials Provider
- Traditional username and password authentication
- Fundamental authentication approach
- Often used as starting point for applications
- Custom authentication logic implementation

#### 2. Google Provider and Prisma Adapter
- OAuth integration with Google accounts
- Database management with Prisma
- Convenient sign-in with existing Google accounts
- Integrated data management

## Credentials Provider Implementation

Based on the [official credentials provider documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/credentials-provider):

### Prerequisites
Before implementing credentials provider, ensure you have:
- Basic understanding of NextAuth.js
- Next.js 13.2+ with App Router
- Environment variables configured

### Initialize NextAuth.js

#### 1. Create Route Handler
Next.js 13.2+ uses Route Handlers for API routes in App Router:

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/libs/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

**Note**: The `api/` prefix is not necessary in Route Handlers but kept for easier migration.

#### 2. Create Auth Configuration
Create the authentication configuration file:

```typescript
// src/libs/auth.ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Implement your authentication logic here
        // This could be an API call to your backend
        const user = await authenticateUser(credentials.email, credentials.password)
        
        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        }
        
        return null
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name
        session.user.role = token.role
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET
}
```

### Provider Configuration

#### CredentialsProvider Options

| Option | Description | Example |
|--------|-------------|---------|
| `name` | Display name on sign-in form | `'Sign in with Email'` |
| `type` | Provider type | `'credentials'` |
| `credentials` | Required credentials fields | `{ email: { label: 'Email', type: 'email' } }` |
| `authorize` | Authentication callback function | `async (credentials) => { ... }` |

#### Authorize Function
The `authorize` callback executes when user authentication is attempted:

```typescript
async authorize(credentials) {
  // Validate credentials
  if (!credentials?.email || !credentials?.password) {
    return null
  }

  // Make API call to authenticate user
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password
      })
    })

    const user = await response.json()

    if (response.ok && user) {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    }
  } catch (error) {
    console.error('Authentication error:', error)
  }

  return null
}
```

### Session Configuration

#### Strategy Options
- `jwt`: Encrypted JWT stored in session cookie (default)
- `database`: Session stored in database with session token

#### Session Options
```typescript
session: {
  strategy: 'jwt',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  updateAge: 24 * 60 * 60    // 24 hours in seconds
}
```

### Callbacks Configuration

#### JWT Callback
Called when JWT is created or updated:

```typescript
async jwt({ token, user }) {
  if (user) {
    // Add custom parameters to token
    token.name = user.name
    token.role = user.role
    token.accessToken = user.accessToken
  }
  return token
}
```

#### Session Callback
Called when session is checked:

```typescript
async session({ session, token }) {
  if (session.user) {
    // Forward token data to session
    session.user.name = token.name
    session.user.role = token.role
    session.accessToken = token.accessToken
  }
  return session
}
```

### Login Form Implementation

#### Update Login Component
```typescript
// src/views/Login.tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const LoginV2 = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid credentials')
      } else {
        router.push('/')
      }
    } catch (error) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <Typography color="error" className="mb-4">
          {error}
        </Typography>
      )}
      
      <TextField
        fullWidth
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      
      <TextField
        fullWidth
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      
      <Button
        fullWidth
        variant="contained"
        type="submit"
        disabled={loading}
      >
        {loading ? 'Signing In...' : 'Log In'}
      </Button>
    </form>
  )
}
```

### Login API Implementation

#### Create Login API Route
```typescript
// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Implement your authentication logic
    const user = await authenticateUser(email, password)

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function authenticateUser(email: string, password: string) {
  // Implement your authentication logic here
  // This could be:
  // - Database query
  // - External API call
  // - Hash comparison
  
  // Example implementation
  const user = await getUserByEmail(email)
  
  if (user && await verifyPassword(password, user.passwordHash)) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  }
  
  return null
}
```

## Google Provider with Prisma Adapter

Based on the [official Google Prisma documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/google-prisma):

### Prerequisites
- Google Cloud Console setup
- Prisma database setup
- Environment variables configured

### Google Cloud Setup

#### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API

#### 2. Create OAuth 2.0 Credentials
1. Go to "Credentials" in the API & Services section
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Configure consent screen
4. Set authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`

#### 3. Get Client ID and Secret
Copy the generated Client ID and Client Secret for environment variables.

### Prisma Adapter Setup

#### 1. Install Dependencies
```bash
npm install @prisma/client prisma
npm install @next-auth/prisma-adapter
```

#### 2. Initialize Prisma
```bash
npx prisma init
```

#### 3. Configure Database Schema
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  role          String    @default("user")
  accounts      Account[]
  sessions      Session[]
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

#### 4. Run Database Migration
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### NextAuth Configuration with Google Provider

#### Update Auth Configuration
```typescript
// src/libs/auth.ts
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        session.user.role = user.role
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // Custom logic for sign-in
      return true
    }
  },
  secret: process.env.NEXTAUTH_SECRET
}
```

### Environment Variables
```bash
# .env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## Page Security

Based on the [official page security documentation](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/securing-page):

### Protecting Pages

#### 1. Server-Side Protection
```typescript
// src/app/protected/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { redirect } from 'next/navigation'

export default async function ProtectedPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div>
      <h1>Protected Page</h1>
      <p>Welcome, {session.user?.name}!</p>
    </div>
  )
}
```

#### 2. Client-Side Protection
```typescript
// src/components/ProtectedRoute.tsx
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session) {
      router.push('/login')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}
```

#### 3. Middleware Protection
```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // Add custom logic here
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
}
```

### Role-Based Access Control

#### 1. Role-Based Page Protection
```typescript
// src/app/admin/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user?.role !== 'admin') {
    redirect('/unauthorized')
  }

  return (
    <div>
      <h1>Admin Panel</h1>
      <p>Welcome, Admin {session.user?.name}!</p>
    </div>
  )
}
```

#### 2. Role-Based Component Protection
```typescript
// src/components/RoleGuard.tsx
'use client'

import { useSession } from 'next-auth/react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: string[]
  fallback?: React.ReactNode
}

export default function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { data: session } = useSession()

  if (!session?.user?.role || !allowedRoles.includes(session.user.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// Usage
<RoleGuard allowedRoles={['admin', 'moderator']}>
  <AdminPanel />
</RoleGuard>
```

## Extending NextAuth Types

### Custom User Fields
```typescript
// next-auth.d.ts
import 'next-auth/jwt'
import { DefaultSession } from 'next-auth'

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    accessToken?: string
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      role: string
    } & DefaultSession['user']
  }

  interface User {
    role: string
  }
}
```

### Using Custom Fields
```typescript
// In components
import { useSession } from 'next-auth/react'

const MyComponent = () => {
  const { data: session } = useSession()
  const userRole = session?.user?.role || 'user'

  return (
    <div>
      <p>User Role: {userRole}</p>
    </div>
  )
}
```

## Implementation Guide for Starter Kit

### Step 1: Install Dependencies
```bash
npm install next-auth @next-auth/prisma-adapter
npm install @prisma/client prisma
```

### Step 2: Create Auth Configuration
```typescript
// src/libs/auth.ts
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // Implement your authentication logic
        return null
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
}
```

### Step 3: Create API Route
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/libs/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

### Step 4: Update Login Component
```typescript
// src/views/Login.tsx
import { signIn } from 'next-auth/react'

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  const result = await signIn('credentials', {
    email,
    password,
    redirect: false
  })

  if (result?.ok) {
    router.push('/')
  }
}
```

### Step 5: Add Session Provider
```typescript
// src/components/Providers.tsx
import { SessionProvider } from 'next-auth/react'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}
```

## Testing Authentication

### 1. Manual Testing
```bash
# Test login endpoint
curl -X POST http://localhost:3000/api/auth/signin/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 2. Unit Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { signIn } from 'next-auth/react'
import Login from '@/views/Login'

jest.mock('next-auth/react')

test('login form submission', async () => {
  const mockSignIn = signIn as jest.MockedFunction<typeof signIn>
  mockSignIn.mockResolvedValue({ ok: true, error: null })

  render(<Login />)
  
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'test@example.com' }
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'password' }
  })
  fireEvent.click(screen.getByText('Log In'))

  expect(mockSignIn).toHaveBeenCalledWith('credentials', {
    email: 'test@example.com',
    password: 'password',
    redirect: false
  })
})
```

## Troubleshooting

### Issue: Authentication Not Working
**Symptoms**: Login form not authenticating users
**Solutions**:
1. Check NextAuth configuration
2. Verify environment variables
3. Check API route implementation
4. Ensure proper session provider setup

### Issue: Session Not Persisting
**Symptoms**: User logged out after page refresh
**Solutions**:
1. Check NEXTAUTH_SECRET configuration
2. Verify session strategy
3. Check cookie settings
4. Ensure proper session provider

### Issue: Google OAuth Not Working
**Symptoms**: Google sign-in failing
**Solutions**:
1. Verify Google Cloud Console setup
2. Check redirect URIs configuration
3. Verify client ID and secret
4. Check environment variables

### Issue: Database Connection Issues
**Symptoms**: Prisma adapter errors
**Solutions**:
1. Check DATABASE_URL configuration
2. Run database migrations
3. Verify Prisma schema
4. Check database permissions

## Best Practices

### 1. Security
- Use strong NEXTAUTH_SECRET
- Implement proper password hashing
- Use HTTPS in production
- Validate all inputs
- Implement rate limiting

### 2. Session Management
- Set appropriate session timeouts
- Implement session refresh
- Use secure cookies
- Handle session expiration gracefully

### 3. Error Handling
- Provide clear error messages
- Log authentication attempts
- Implement proper error boundaries
- Handle network failures

### 4. User Experience
- Provide loading states
- Show clear feedback
- Implement remember me functionality
- Handle edge cases gracefully

## Related Documentation

- [Environment Variables](./ENVIRONMENT_VARIABLES.md) - Environment configuration
- [Next.js API Routes](./NEXTJS_API_ROUTES.md) - API implementation
- [Hooks Documentation](./HOOKS_DOCUMENTATION.md) - React hooks usage
- [Theme Configurations](./THEME_CONFIGURATIONS.md) - Theme settings

---
**Sources**: 
- [Authentication Introduction](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/intro)
- [Credentials Provider](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/credentials-provider)
- [Google Provider with Prisma](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/google-prisma)
- [Securing Pages](https://demos.pixinvent.com/materialize-nextjs-admin-template/documentation/docs/guide/authentication/securing-page)
**Last Updated**: December 2024
**Template Version**: Materialize Next.js Admin Template v5.0.0
