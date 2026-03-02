# Quick Start - Extract Baseline

The original script was getting stuck. Here are **3 options** to extract your baseline:

## Option 1: Simple Script (Recommended) ⭐

```bash
cd admin-portal/scripts
./extract-baseline-simple.sh bsfqomjdjqvqdqdlbczy
```

**Features:**
- Shows progress at each step
- Has timeout protection
- Cleans up automatically

## Option 2: Direct Dump (Fastest)

If you're already in a Supabase project directory:

```bash
cd admin-portal/scripts
supabase db dump --project-ref bsfqomjdjqvqdqdlbczy --schema public > baseline-migration.sql
```

**Note:** This might not work if `--project-ref` isn't supported. Try Option 1 instead.

## Option 3: Manual via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run: `pg_dump --schema-only --schema=public`
4. Copy the output to `baseline-migration.sql`

## Troubleshooting

**If scripts hang:**
- Check you're logged in: `supabase login`
- Verify project ref is correct
- Try the manual dashboard approach

**If you get "not logged in":**
```bash
supabase login
```

**If link fails:**
- Check project ref in Supabase Dashboard > Settings > General
- Verify you have access to the project

## Next Steps After Extraction

Once you have `baseline-migration.sql`:

```bash
# Setup new tenant
./setup-new-tenant.sh <new-tenant-project-ref> baseline-migration.sql
```
