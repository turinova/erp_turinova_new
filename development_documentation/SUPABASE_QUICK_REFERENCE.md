# Supabase Quick Reference Guide

## 🚀 Quick Setup Commands

### Initial Setup
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Initialize project
supabase init

# Login to Supabase
supabase login

# Link to remote project
supabase link --project-ref xgkaviefifbllbmfbyfe
```

### Daily Commands
```bash
# Create new migration
supabase migration new migration_name

# Apply migrations to remote database
supabase db push

# Check migration status
supabase migration list

# View project info
supabase projects list
```

## 📊 Database Operations

### Migration Management
```bash
# Create migration
supabase migration new add_soft_delete_to_table_name

# Apply all pending migrations
supabase db push

# Reset local database (development only)
supabase db reset

# Generate SQL diff
supabase db diff
```

### Schema Management
```bash
# Pull remote schema changes
supabase db pull

# Push local schema to remote
supabase db push

# Generate types from database
supabase gen types typescript --local > types/database.types.ts
```

## 🔧 API Development

### Environment Variables
```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Client Configuration
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## 🗃️ Soft Delete Pattern

### Database Schema
```sql
-- Add soft delete columns
ALTER TABLE table_name ADD COLUMN deleted_at timestamptz;
ALTER TABLE table_name ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Add performance index
CREATE INDEX IF NOT EXISTS ix_table_name_deleted_at 
ON table_name(deleted_at) WHERE deleted_at IS NULL;

-- Add automatic timestamp trigger
CREATE TRIGGER update_table_name_updated_at 
BEFORE UPDATE ON table_name 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
```

### API Implementation
```typescript
// GET endpoint - filter soft deleted records
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .is('deleted_at', null)
  .order('name')

// DELETE endpoint - soft delete
const { error } = await supabase
  .from('table_name')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id)
```

## 🧪 Testing Commands

### API Testing
```bash
# Test GET endpoint
curl http://localhost:3000/api/table_name

# Test DELETE endpoint
curl -X DELETE http://localhost:3000/api/table_name/{id}

# Test with authentication
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/table_name
```

### Database Testing
```sql
-- Check if soft delete is working
SELECT * FROM table_name WHERE deleted_at IS NULL;

-- Check soft deleted records
SELECT * FROM table_name WHERE deleted_at IS NOT NULL;

-- Restore soft deleted record
UPDATE table_name SET deleted_at = NULL WHERE id = 'record-id';
```

## 🚨 Troubleshooting

### Common Issues
```bash
# Check Supabase CLI version
supabase --version

# Check project connection
supabase projects list

# Check migration status
supabase migration list

# View logs
supabase logs
```

### Error Solutions
```bash
# Permission denied during installation
brew install supabase/tap/supabase

# Migration conflicts
supabase db reset  # Development only!

# Connection issues
supabase link --project-ref YOUR_PROJECT_REF
```

## 📁 Project Structure
```
starter-kit/
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── YYYYMMDDHHMMSS_migration_name.sql
├── src/
│   ├── lib/supabase.ts
│   └── app/api/
│       └── table_name/
│           ├── route.ts
│           └── [id]/route.ts
└── development_documentation/
    ├── SUPABASE_CONNECTION_GUIDE.md
    └── SUPABASE_QUICK_REFERENCE.md
```

## 🔑 Key Files

### Configuration Files
- `supabase/config.toml` - Project configuration
- `src/lib/supabase.ts` - Supabase client setup
- `.env.local` - Environment variables (not tracked)

### Migration Files
- `supabase/migrations/` - Database migration files
- Timestamped format: `YYYYMMDDHHMMSS_migration_name.sql`

### API Files
- `src/app/api/table_name/route.ts` - GET/POST endpoints
- `src/app/api/table_name/[id]/route.ts` - PUT/DELETE endpoints

## 📋 Migration Checklist

### Before Creating Migration
- [ ] Plan the schema changes
- [ ] Consider backward compatibility
- [ ] Test locally first

### During Migration
- [ ] Use descriptive migration name
- [ ] Include rollback procedures
- [ ] Test with sample data

### After Migration
- [ ] Update API endpoints
- [ ] Test all CRUD operations
- [ ] Update documentation
- [ ] Deploy to production

## 🎯 Best Practices

### Migration Best Practices
1. Always test migrations locally first
2. Use `IF NOT EXISTS` for safety
3. Include rollback procedures
4. Version control all migration files

### API Best Practices
1. Handle missing columns gracefully
2. Implement consistent error handling
3. Use soft delete for data preservation
4. Include comprehensive logging

### Security Best Practices
1. Never commit environment files
2. Use service role keys carefully
3. Implement proper validation
4. Monitor access patterns

---

**Quick Access**: Bookmark this file for daily Supabase operations!  
**Last Updated**: December 2024  
**Project**: ERP Turinova
