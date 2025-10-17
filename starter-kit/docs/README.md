# Documentation System

This folder contains comprehensive documentation for the Turinova ERP project, organized for easy reference and context restoration.

---

## 📁 Folder Structure

```
docs/
├── README.md                 # This file
├── CHANGELOG.md              # Chronological feature log
├── chat-archives/            # Cursor chat session exports
│   └── 2025-10-01-media-library-implementation.md
└── decisions/                # Technical decision records (ADRs)
    └── (future decision docs here)
```

---

## 📖 Documentation Types

### 1. **Chat Archives** (`chat-archives/`)
**Purpose**: Preserve Cursor AI chat sessions for context restoration  
**Format**: Markdown files with date prefix  
**Naming**: `YYYY-MM-DD-brief-description.md`

**What to Include**:
- Session overview (date, focus, status)
- Features implemented
- Technical decisions and rationale
- Issues encountered and solutions
- Code changes and file locations
- Git commit references
- Performance metrics
- Future considerations

**When to Create**:
- After completing major feature work
- Before losing chat history
- At end of significant development sessions

### 2. **Changelog** (`CHANGELOG.md`)
**Purpose**: Quick reference for "what changed when"  
**Format**: Reverse chronological (newest first)  
**Sections**: Added, Changed, Fixed, Removed

**Update When**:
- Deploying to production
- Completing feature milestones
- Making breaking changes
- Fixing critical bugs

### 3. **Decision Records** (`decisions/`)
**Purpose**: Document architectural and technical decisions  
**Format**: ADR (Architecture Decision Record)  
**Naming**: `001-decision-title.md`, `002-next-decision.md`

**Template**:
```markdown
# Decision: [Title]

**Date**: YYYY-MM-DD  
**Status**: Accepted | Superseded | Deprecated

## Context
What is the issue we're trying to solve?

## Options Considered
1. Option A - pros/cons
2. Option B - pros/cons
3. Option C - pros/cons (chosen)

## Decision
What did we decide and why?

## Consequences
What becomes easier/harder as a result?

## Implementation
Files changed, code references, commands to run
```

---

## 🔍 How to Use This System

### Scenario 1: Chat History Lost
1. Open `docs/chat-archives/`
2. Find most recent session file
3. Read "Session Overview" and "Features Implemented"
4. Reference "Files Modified" to understand code changes
5. Check `CHANGELOG.md` for quick feature summary

### Scenario 2: Why Was This Decision Made?
1. Check `decisions/` folder for ADRs
2. Search by topic (e.g., "Why media_files table?")
3. Read "Context" and "Decision" sections
4. Understand trade-offs in "Consequences"

### Scenario 3: What Changed Recently?
1. Open `CHANGELOG.md`
2. Review entries from newest to oldest
3. See file locations and commit hashes
4. Cross-reference with git: `git show [commit-hash]`

### Scenario 4: New Developer Onboarding
1. Start with `CHANGELOG.md` for overview
2. Read recent chat archives for detailed context
3. Review decision records for architectural understanding
4. Check `development_documentation/` for technical guides

---

## 📝 Contributing to Documentation

### After Major Features
1. Create chat archive in `chat-archives/`
2. Update `CHANGELOG.md` with changes
3. Create decision record if applicable
4. Commit docs with code changes

### Naming Conventions
- **Chat archives**: `2025-10-01-feature-name.md`
- **Decisions**: `001-decision-title.md` (numbered)
- **Use lowercase with hyphens** for filenames

### Keep It Updated
- Document as you build (not after)
- Include "why" not just "what"
- Reference file paths and line numbers
- Add code snippets for complex changes
- Link related documentation

---

## 🔗 Related Documentation Locations

### Development Documentation
- `development_documentation/` - Technical guides
  - `AUTHENTICATION_DOCUMENTATION.md`
  - `CRUD_FUNCTIONALITY_GUIDE.md`
  - `PERFORMANCE_OPTIMIZATION_GUIDE.md`
  - `SUPABASE_FILES_INDEX.md`
  - And more...

### Database Scripts
- Root folder: `*.sql` files
- `supabase/migrations/` - Versioned migrations

### Configuration
- `README.md` - Project overview
- `package.json` - Dependencies
- `next.config.ts` - Next.js configuration
- `.env.local` - Environment variables (not in git)

---

## 💡 Tips for Effective Documentation

### For Chat Archives
✅ **DO**:
- Include exact error messages
- Reference specific file paths and line numbers
- Document performance before/after metrics
- List all files changed
- Include git commit hashes
- Explain "why" decisions were made

❌ **DON'T**:
- Copy entire file contents (reference line numbers instead)
- Include sensitive data (API keys, passwords)
- Write vague descriptions ("fixed some stuff")
- Forget to update CHANGELOG

### For Decision Records
✅ **DO**:
- Explain the problem context
- List alternatives considered
- Document trade-offs
- Update status if decision changes
- Reference related decisions

❌ **DON'T**:
- Skip the "why" (most important part)
- Make decisions in isolation
- Forget to communicate to team
- Leave outdated decisions without status update

---

## 🎯 Current Project Status

### Latest Major Features
1. ✅ Media library with SSR (Oct 1, 2025)
2. ✅ Material pricing & price history
3. ✅ Excel import/export with filtering
4. ✅ New material creation & bulk delete
5. ✅ Material page restructuring
6. ✅ Usage limit field

### Next Steps
- Deploy Media library to production
- Run database migrations in production Supabase
- Re-enable permission system
- Consider additional ERP features (inventory, orders)

### Tech Stack Reference
- **Framework**: Next.js 15.1.2
- **Language**: TypeScript
- **UI**: Material-UI (MUI)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel
- **Package Manager**: pnpm

---

**Documentation System Created**: October 1, 2025  
**Maintained By**: Development team  
**Update Frequency**: After each major feature or significant change

