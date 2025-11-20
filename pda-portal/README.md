# Turinova PDA Portal

Lightweight PDA terminal application with PIN-based authentication.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xgkaviefifbllbmfbyfe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PDA_JWT_SECRET=your-random-secret-here
NODE_ENV=development
```

3. Generate JWT secret:
```bash
openssl rand -base64 32
```

4. Run database migration:
   - Execute `create_user_pins_table.sql` in Supabase SQL Editor

5. Create a test PIN for a user:
```sql
INSERT INTO public.user_pins (user_id, pin, is_active)
SELECT id, '123456', true
FROM public.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO UPDATE SET pin = EXCLUDED.pin;
```

## Development

```bash
npm run dev
```

Server runs on `http://localhost:3005`

## Build

```bash
npm run build
npm start
```

## Features

- PIN-based authentication (6 digits)
- JWT token sessions
- Tailwind CSS for styling
- Lightweight and fast

