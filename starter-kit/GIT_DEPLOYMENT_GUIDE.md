# Git Deployment Guide - ERP Turinova

## Overview
This guide documents the correct process for committing and pushing changes to the main branch for Vercel deployment. This process was successfully tested and used for commit `769ddc8`.

## Prerequisites
- Git repository initialized with remote origin
- All changes ready for deployment
- Working directory: `/Volumes/T7/erp_turinova_new` (root directory)

## Step-by-Step Process

### 1. Verify Current Status
```bash
# Check current directory (should be root)
pwd
# Should show: /Volumes/T7/erp_turinova_new

# Check git status
git status
```

### 2. Add Files to Staging
```bash
# Add all changes
git add .

# Or add specific files
git add package.json package-lock.json src/ public/ supabase/
```

### 3. Commit Changes
```bash
# Create commit with descriptive message
git commit -m "feat: Add shop order management system with dynamic accessory creation"

# Alternative commit messages:
# git commit -m "fix: Move project files to root directory for Vercel deployment"
# git commit -m "feat: Implement customer orders and supplier orders pages"
# git commit -m "feat: Add enhanced search system with server-side pagination"
```

### 4. Push to Main Branch
```bash
# Force push to main (use when local is ahead of remote)
git push origin main --force

# Regular push (use when branches are in sync)
git push origin main
```

## Important Notes

### When to Use Force Push
- **Use `--force`** when:
  - Local repository has changes that should overwrite remote
  - Remote has outdated or conflicting changes
  - You're certain the local state is correct
  - Previous deployments failed due to file structure issues

- **Don't use `--force`** when:
  - Working in a team environment
  - Unsure about remote changes
  - Remote has important changes not in local

### File Structure Requirements
For successful Vercel deployment, ensure these files are in the **root directory**:
```
/Volumes/T7/erp_turinova_new/
├── package.json          # Required for dependency detection
├── package-lock.json      # Required for exact dependency versions
├── next.config.ts         # Next.js configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── postcss.config.mjs     # PostCSS configuration
├── src/                   # Source code directory
├── public/                # Static assets
├── supabase/              # Database migrations
├── .env.example           # Environment variables template
├── .eslintrc.js           # ESLint configuration
├── .prettierrc.json       # Prettier configuration
└── .stylelintrc.json      # Stylelint configuration
```

### Common Issues and Solutions

#### Issue: "No Next.js version detected"
**Cause**: `package.json` not in root directory
**Solution**: Move `package.json` and `package-lock.json` to root directory

#### Issue: "Cannot find module '/vercel/path0/src/...'"
**Cause**: `src/` directory not in root directory
**Solution**: Move `src/` directory to root directory

#### Issue: "non-monotonic index" warnings
**Cause**: Git pack file corruption (harmless)
**Solution**: Ignore these warnings - they don't affect the push

#### Issue: "origin does not appear to be a git repository"
**Cause**: Remote origin not configured
**Solution**: 
```bash
git remote add origin https://github.com/turinova/erp_turinova_new.git
```

## Successful Deployment Pattern

### Example: Shop Order System Deployment (769ddc8)
1. **Problem**: Vercel couldn't find project files
2. **Solution**: Moved all files from `starter-kit/` to root directory
3. **Commands Used**:
   ```bash
   # Move config files
   cp starter-kit/package.json . && cp starter-kit/package-lock.json .
   cp starter-kit/next.config.ts . && cp starter-kit/tsconfig.json .
   cp starter-kit/tailwind.config.ts . && cp starter-kit/postcss.config.mjs .
   
   # Move source directories
   cp -r starter-kit/src . && cp -r starter-kit/public .
   cp -r starter-kit/supabase . && cp starter-kit/.env.example .
   cp starter-kit/.eslintrc.js . && cp starter-kit/.prettierrc.json .
   cp starter-kit/.stylelintrc.json .
   
   # Commit and push
   git add .
   git commit -m "fix: Move project files to root directory for Vercel deployment"
   git push origin main --force
   ```

## Verification Steps

### After Push
1. Check Vercel deployment logs
2. Verify all files are in root directory on GitHub
3. Confirm build process starts successfully
4. Test deployed application

### GitHub Repository Check
- Visit: https://github.com/turinova/erp_turinova_new
- Verify `package.json` is in root directory
- Verify `src/` directory is in root directory
- Check commit history for latest push

## Best Practices

### Commit Messages
- Use descriptive commit messages
- Follow conventional commit format: `type: description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### File Organization
- Keep all project files in root directory for Vercel
- Maintain `starter-kit/` as development workspace
- Copy files to root only when ready for deployment

### Testing
- Test locally before pushing
- Verify file structure matches requirements
- Check for missing dependencies

## Troubleshooting

### If Push Fails
1. Check internet connection
2. Verify GitHub credentials
3. Check remote URL: `git remote -v`
4. Try force push: `git push origin main --force`

### If Deployment Fails
1. Check Vercel build logs
2. Verify file structure in GitHub
3. Check for missing dependencies
4. Verify environment variables

### If Files Are Missing
1. Check if files were copied to root directory
2. Verify git add included all files
3. Check git status for untracked files

## Quick Reference Commands

```bash
# Complete deployment process
git add .
git commit -m "feat: Your feature description"
git push origin main --force

# Check status
git status
git log --oneline -5

# Verify remote
git remote -v

# Check current branch
git branch
```

## Success Indicators

### Successful Push
- Output shows: `[commit_hash]..[new_hash]  main -> main`
- No error messages (warnings about non-monotonic index are OK)
- GitHub repository shows latest commit

### Successful Deployment
- Vercel build starts without errors
- Dependencies install successfully
- Build completes without module resolution errors
- Application deploys and is accessible

---

**Last Updated**: October 17, 2025
**Last Successful Deployment**: Commit 769ddc8
**Tested With**: Shop Order Management System
