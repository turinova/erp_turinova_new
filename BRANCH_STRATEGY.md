# 🌿 Branch Strategy: Optimization Development

## 📋 Branch Overview

### `main` (Production)
- **Purpose:** Clean production code deployed to turinova.hu
- **Optimization:** Multi-Panel Look-Ahead + Hosszúság sorting (default, automatic)
- **UI:** Simple, clean - just "Optimalizálás" button
- **Testing UI:** ❌ None (removed for production)
- **Deployment:** Auto-deploys to Vercel on push

### `dev-optimization-testing` (Internal Testing)
- **Purpose:** Full A/B testing framework for algorithm evaluation
- **Optimization:** All 3 algorithms available (Original, Look-Ahead, Multi-Panel)
- **UI:** Full testing interface with comparison cards
- **Features:**
  - ✅ Algorithm testing button
  - ✅ Sorting strategy dropdown
  - ✅ Side-by-side comparison cards
  - ✅ Real-time metrics comparison
  - ✅ Debug logging
- **Deployment:** ❌ Not deployed (local use only)

---

## 🔄 Daily Workflow

### Working on Production (Normal Use)
```bash
# Switch to main branch
git checkout main

# Start dev server
cd main-app && npm run dev
# Visit: http://localhost:3000/opti

# Users see clean UI with best optimization
# No testing buttons, just "Optimalizálás"
```

### Testing New Algorithms
```bash
# Switch to testing branch
git checkout dev-optimization-testing

# Start dev server
cd main-app && npm run dev
# Visit: http://localhost:3000/opti

# You see full testing UI:
# - "Algoritmusok Tesztelése" button
# - Sorting strategy dropdown
# - 3 comparison cards
# - All debugging tools
```

---

## 🚀 Deploying Algorithm Improvements

When you develop a new algorithm or sorting strategy:

### Step 1: Develop & Test on Testing Branch
```bash
git checkout dev-optimization-testing

# Add new algorithm:
# - Create main-app/src/lib/optimization/newAlgorithm.ts
# - Update main-app/src/app/api/optimize/route.ts

# Test using A/B comparison UI
# Compare with existing algorithms
# Verify it's better
```

### Step 2: Merge Only Algorithm Code to Main
```bash
git checkout main

# Cherry-pick only the algorithm files (not UI):
git checkout dev-optimization-testing -- \
  main-app/src/lib/optimization/newAlgorithm.ts \
  main-app/src/app/api/optimize/route.ts

# Update OptiClient.tsx to use new algorithm as default:
# Change: algorithm: 'multipanel' → algorithm: 'newalgorithm'

git add .
git commit -m "feat(optimization): Implement improved X algorithm"
git push origin main
```

### Step 3: Keep Testing Branch Updated
```bash
# Periodically merge main back into testing branch
git checkout dev-optimization-testing
git merge main
git push origin dev-optimization-testing
```

---

## 📊 What's Different Between Branches?

### Files ONLY on `dev-optimization-testing`:
- **OptiClient.tsx differences:**
  - `compareAlgorithms()` function
  - `comparisonMode` state
  - `comparisonResults` state
  - Sorting strategy dropdown UI
  - "Algoritmusok Tesztelése" button
  - 3 comparison cards (Original, Look-Ahead, Multi-Panel)
  - Extra debug logging

### Files IDENTICAL on both branches:
- ✅ `main-app/src/lib/optimization/multiPanelLookAhead.ts`
- ✅ `main-app/src/lib/optimization/lookahead.ts`
- ✅ `main-app/src/lib/optimization/sorting.ts`
- ✅ `main-app/src/lib/optimization/algorithms.ts`
- ✅ `main-app/src/app/api/optimize/route.ts`
- ✅ All documentation files

---

## 🎯 Current Production Configuration

**Algorithm:** Multi-Panel Look-Ahead  
**Sorting:** Hosszúság szerint (height, tallest first)  
**Adaptive Testing:**
- ≤20 panels: Test 3 initial panels (8 combinations)
- 21-100 panels: Test 2 initial panels (4 combinations)
- 100+ panels: Test 1 initial panel (2 combinations)

**Performance:**
- 10-20% fewer boards vs. original
- Better panel placement
- Lower material waste

---

## 📝 Quick Commands Reference

```bash
# Switch to production branch
git checkout main

# Switch to testing branch
git checkout dev-optimization-testing

# See current branch
git branch

# Update testing branch from main
git checkout dev-optimization-testing
git merge main

# Cherry-pick algorithm files to main
git checkout main
git checkout dev-optimization-testing -- path/to/file.ts
```

---

## 🔍 How to Know Which Branch You're On

### Terminal:
```bash
git branch
# Shows * next to current branch
```

### Browser Console (while testing /opti page):
```javascript
// On dev-optimization-testing: You'll see the testing button
// On main: Clean UI, no testing button
```

### Visual Indicator:
- **Testing Branch:** UI has "Algoritmusok Tesztelése" button
- **Main Branch:** UI has only "Optimalizálás" button

---

## 🎉 Benefits of This Strategy

1. ✅ **Clean Production** - Users don't see internal testing tools
2. ✅ **Full Testing Capability** - You keep all A/B testing features
3. ✅ **Version Control** - Both versions tracked in git
4. ✅ **Easy Switching** - One command to switch context
5. ✅ **No Accidents** - Can't accidentally deploy testing UI
6. ✅ **Professional** - Industry-standard approach

---

## 🆘 Troubleshooting

### "I pushed to main but testing UI is showing!"
```bash
# Check which branch you're on
git branch

# If on dev-optimization-testing:
git checkout main
git pull origin main
```

### "My testing branch is out of date"
```bash
git checkout dev-optimization-testing
git merge main
```

### "I want to test a quote on both branches"
```bash
# Test on testing branch first (save quote)
git checkout dev-optimization-testing
cd main-app && npm run dev
# Test, save quote_id

# Switch to main, load same quote
git checkout main
cd main-app && npm run dev
# Visit http://localhost:3000/opti?quote_id=...
```

---

**Created:** 2025-11-06  
**Last Updated:** 2025-11-06  
**Status:** ✅ Active

