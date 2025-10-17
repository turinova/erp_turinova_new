# Decision: [Title Here]

**Date**: YYYY-MM-DD  
**Status**: Proposed | Accepted | Superseded | Deprecated  
**Deciders**: [Names or roles]  
**Tags**: #architecture #database #ui #performance

---

## Context

**What is the problem or opportunity?**

Describe the situation that requires a decision. Include:
- Current state
- Pain points or limitations
- Business/technical drivers
- Constraints (time, budget, tech stack)

---

## Options Considered

### Option 1: [Name]
**Description**: Brief explanation of this approach

**Pros**:
- ✅ Advantage 1
- ✅ Advantage 2
- ✅ Advantage 3

**Cons**:
- ❌ Disadvantage 1
- ❌ Disadvantage 2

**Effort**: [Low | Medium | High]  
**Risk**: [Low | Medium | High]

---

### Option 2: [Name]
**Description**: Brief explanation of this approach

**Pros**:
- ✅ Advantage 1
- ✅ Advantage 2

**Cons**:
- ❌ Disadvantage 1
- ❌ Disadvantage 2

**Effort**: [Low | Medium | High]  
**Risk**: [Low | Medium | High]

---

### Option 3: [Name] ← **CHOSEN**
**Description**: Brief explanation of this approach

**Pros**:
- ✅ Advantage 1
- ✅ Advantage 2
- ✅ Advantage 3

**Cons**:
- ❌ Disadvantage 1
- ❌ Disadvantage 2

**Effort**: [Low | Medium | High]  
**Risk**: [Low | Medium | High]

---

## Decision

**We decided to**: [One sentence summary]

**Rationale**:
1. [Reason 1]
2. [Reason 2]
3. [Reason 3]

**Key factors**:
- [Factor 1]: [Why it mattered]
- [Factor 2]: [Why it mattered]

---

## Consequences

### What Becomes Easier
- ✅ [Benefit 1]
- ✅ [Benefit 2]
- ✅ [Benefit 3]

### What Becomes Harder
- ⚠️ [Trade-off 1]
- ⚠️ [Trade-off 2]

### Technical Debt
- [Any compromises or future cleanup needed]

---

## Implementation

### Files Changed
```
src/app/api/[feature]/route.ts - [Description]
src/components/[Component].tsx - [Description]
src/lib/[utility].ts - [Description]
```

### Database Changes
```sql
CREATE TABLE example (...);
ALTER TABLE existing ADD COLUMN ...;
```

### Configuration
- Added environment variable: `FEATURE_FLAG`
- Updated `next.config.ts`: [what changed]

### Commands to Run
```bash
# Development
pnpm install [package]

# Database
psql -f migration.sql

# Deployment
vercel deploy
```

---

## References

### Related Decisions
- [001-previous-decision.md] - Related architectural choice
- [005-future-decision.md] - Depends on this decision

### External Resources
- [Link to docs/articles that influenced decision]
- [Relevant GitHub issues or PRs]

### Chat Archive
- `docs/chat-archives/2025-10-01-feature-name.md` - Full session context

---

## Review & Updates

### When to Review
- [ ] After 1 month (to validate decision)
- [ ] Before major refactoring
- [ ] When similar problems arise

### Update Log
- YYYY-MM-DD: [What changed, why, new status]

---

**Created**: YYYY-MM-DD  
**Last Updated**: YYYY-MM-DD  
**Next Review**: YYYY-MM-DD

