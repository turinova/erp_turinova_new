# Git Workflow Documentation for ERP Turinova

## Overview
This document provides comprehensive instructions for the correct git workflow when working with the ERP Turinova project. It covers the proper commands, best practices, and troubleshooting for version control operations.

## Prerequisites
- Git is installed and configured
- Access to the remote repository: `https://github.com/turinova/erp_turinova_new.git`
- Proper authentication (SSH keys or personal access token)

## Repository Information
- **Remote URL**: `https://github.com/turinova/erp_turinova_new.git`
- **Main Branch**: `main`
- **Working Directory**: `/Volumes/T7/erp_turinova_new/starter-kit`

## Basic Git Workflow

### 1. Check Current Status
Always start by checking the current status of your working directory:

```bash
cd /Volumes/T7/erp_turinova_new/starter-kit
git status
```

**Expected Output:**
```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   src/app/(dashboard)/opti/page.tsx

no changes added to commit (use "git add" and/or "git commit -a")
```

### 2. Add Files to Staging Area
Add specific files or all changes to the staging area:

**For specific files:**
```bash
# Single file (escape parentheses in path)
git add src/app/\(dashboard\)/opti/page.tsx

# Multiple files
git add src/app/\(dashboard\)/opti/page.tsx src/app/api/customers/route.ts

# All modified files
git add .
```

**For all changes:**
```bash
git add -A
```

### 3. Commit Changes
Create a meaningful commit with a descriptive message:

```bash
git commit -m "Descriptive commit message explaining the changes

- Bullet point 1: What was changed
- Bullet point 2: Why it was changed
- Bullet point 3: Any additional context"
```

**Example:**
```bash
git commit -m "Fix edge finishing visualization: correct field order, rotated labels, and proper edge highlighting

- Reordered edge finishing fields: Hosszú felső, Hosszú alsó, Széles bal, Széles jobb
- Fixed visual labels to match correct edge positions
- Rotated side labels (Széles bal/jobb) vertically for better readability
- Corrected edge highlighting logic to match field mapping
- Adjusted label positioning for better visual alignment"
```

### 4. Push to Remote Repository
Push your committed changes to the remote repository:

```bash
git push origin main
```

**Expected Output:**
```
Enumerating objects: 13, done.
Counting objects: 100% (13/13), done.
Delta compression using up to 8 threads
Compressing objects: 100% (7/7), done.
Writing objects: 100% (7/7), 1.22 KiB | 1.22 MiB/s, done.
Total 7 (delta 5), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (5/5), completed with 5 local objects.
To https://github.com/turinova/erp_turinova_new.git
   8e832b0..58fd354  main -> main
```

## Complete Workflow Example

Here's a complete example of the git workflow:

```bash
# 1. Navigate to project directory
cd /Volumes/T7/erp_turinova_new/starter-kit

# 2. Check current status
git status

# 3. Add specific file (escape parentheses)
git add src/app/\(dashboard\)/opti/page.tsx

# 4. Commit with descriptive message
git commit -m "Fix edge finishing visualization: correct field order, rotated labels, and proper edge highlighting

- Reordered edge finishing fields: Hosszú felső, Hosszú alsó, Széles bal, Széles jobb
- Fixed visual labels to match correct edge positions
- Rotated side labels (Széles bal/jobb) vertically for better readability
- Corrected edge highlighting logic to match field mapping
- Adjusted label positioning for better visual alignment"

# 5. Push to remote repository
git push origin main
```

## File Path Escaping

When working with files in directories that contain parentheses, you need to escape them:

**Correct:**
```bash
git add src/app/\(dashboard\)/opti/page.tsx
```

**Incorrect:**
```bash
git add src/app/(dashboard)/opti/page.tsx
```

## Common Commands Reference

### Status and Information
```bash
# Check repository status
git status

# Check current branch
git branch

# Check remote repositories
git remote -v

# View commit history
git log --oneline

# Check differences
git diff
```

### Adding and Committing
```bash
# Add all changes
git add .

# Add specific file
git add filename.tsx

# Add multiple files
git add file1.tsx file2.tsx

# Commit with message
git commit -m "Your commit message"

# Commit all tracked files (skip staging)
git commit -am "Your commit message"
```

### Pushing and Pulling
```bash
# Push to main branch
git push origin main

# Pull latest changes
git pull origin main

# Fetch without merging
git fetch origin
```

### Branching (if needed)
```bash
# Create new branch
git checkout -b feature/new-feature

# Switch to existing branch
git checkout main

# List all branches
git branch -a

# Merge branch
git merge feature/new-feature
```

## Troubleshooting

### Issue: "non-monotonic index" Warnings
**Warning Message**: `error: non-monotonic index .git/objects/pack/._pack-*.idx`

**Solution**: These are harmless warnings that don't affect git operations. They can be ignored as they don't prevent commits or pushes from working.

### Issue: "No such file or directory" Error
**Error Message**: `fatal: pathspec 'src/app/(dashboard)/opti/page.tsx' did not match any files`

**Solution**: Escape parentheses in the file path:
```bash
git add src/app/\(dashboard\)/opti/page.tsx
```

### Issue: "Permission denied" Error
**Error Message**: `Permission denied (publickey)`

**Solution**: 
1. Check SSH key configuration
2. Ensure you have access to the repository
3. Use HTTPS with personal access token if SSH fails

### Issue: "Your branch is ahead" Warning
**Warning Message**: `Your branch is ahead of 'origin/main' by X commits`

**Solution**: Push your local commits:
```bash
git push origin main
```

### Issue: "Merge conflicts"
**Error Message**: `Automatic merge failed; fix conflicts and then commit the result`

**Solution**:
1. Open conflicted files and resolve conflicts
2. Add resolved files: `git add filename.tsx`
3. Complete merge: `git commit`

## Best Practices

### 1. Commit Messages
- Use clear, descriptive commit messages
- Start with a verb in imperative mood
- Include bullet points for multiple changes
- Keep the first line under 50 characters

**Good Examples:**
```
Fix edge finishing visualization: correct field order and rotated labels

- Reordered edge finishing fields
- Fixed visual labels to match correct edge positions
- Rotated side labels vertically for better readability
```

**Bad Examples:**
```
fix stuff
changes
update
```

### 2. File Organization
- Only commit files that are ready for production
- Use `.gitignore` to exclude temporary files
- Test changes before committing

### 3. Regular Workflow
- Check status before starting work
- Make small, focused commits
- Push changes regularly
- Pull latest changes before starting new work

### 4. Branch Strategy
- Use `main` branch for stable code
- Create feature branches for major changes
- Keep commits atomic and focused

## Quick Reference Card

```bash
# Daily workflow
cd /Volumes/T7/erp_turinova_new/starter-kit
git status
git add src/app/\(dashboard\)/opti/page.tsx
git commit -m "Your descriptive message"
git push origin main

# Check what changed
git diff

# View recent commits
git log --oneline -5

# Pull latest changes
git pull origin main
```

## Verification Commands

After pushing, verify your changes are on the remote:

```bash
# Check if push was successful
git status

# View recent commits
git log --oneline -3

# Check remote status
git remote show origin
```

## Security Notes

- Never commit sensitive information (passwords, API keys)
- Use environment variables for configuration
- Review changes before committing
- Keep your SSH keys secure

---

**Last Updated**: September 2025
**Project**: ERP Turinova
**Repository**: https://github.com/turinova/erp_turinova_new.git
