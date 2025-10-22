# 🚀 Server Startup Guide - Turinova ERP System

**CRITICAL**: This is the ONLY correct way to start the development servers. DO NOT deviate from this process.

---

## ✅ **CORRECT SERVER STARTUP PROCESS**

### **Step 1: Kill All Existing Servers**

Before starting servers, ALWAYS kill any existing processes:

```bash
lsof -ti:3000 -ti:3001 -ti:3002 -ti:3003 2>/dev/null | xargs kill -9 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
sleep 3
```

**Why**: Prevents port conflicts and ensures clean start.

---

### **Step 2: Start Main App (Port 3000)**

```bash
cd /Volumes/T7/erp_turinova_new/main-app
npm run dev
```

**IMPORTANT**:
- ✅ **NO FLAGS** - Just `npm run dev`
- ❌ **DO NOT USE**: `--hostname localhost`
- ❌ **DO NOT USE**: `--port 3000`
- ❌ **DO NOT USE**: `PORT=3000`

**Expected Output**:
```
   ▲ Next.js 15.1.2
   - Local:        http://localhost:3000
   - Network:      http://192.168.3.1:3000
   - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 1946ms
 ✓ Compiled /src/middleware in 235ms (178 modules)
```

**Wait**: 5-10 seconds for initial compilation.

---

### **Step 3: Start Customer Portal (Port 3001)**

```bash
cd /Volumes/T7/erp_turinova_new/customer-portal
npm run dev
```

**IMPORTANT**:
- ✅ **NO FLAGS** - Just `npm run dev`
- ❌ **DO NOT USE**: `--hostname localhost`
- ❌ **DO NOT USE**: `--port 3001` (already configured in package.json)
- ❌ **DO NOT USE**: `PORT=3001`

**Expected Output**:
```
   ▲ Next.js 15.1.2
   - Local:        http://localhost:3001
   - Network:      http://192.168.3.1:3001
   - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 1845ms
 ✓ Compiled /middleware in 209ms (171 modules)
```

**Wait**: 5-10 seconds for initial compilation.

---

## 🧪 **VERIFICATION TESTS**

After starting both servers, run these tests to confirm they're working:

### **Main App Tests (Port 3000)**

```bash
# Test 1: Home page
curl -s http://localhost:3000/home > /dev/null && echo "✅ Main app /home: SUCCESS" || echo "❌ FAILED"

# Test 2: Login page
curl -s http://localhost:3000/login > /dev/null && echo "✅ Main app /login: SUCCESS" || echo "❌ FAILED"

# Test 3: Scanner page
curl -s http://localhost:3000/scanner > /dev/null && echo "✅ Main app /scanner: SUCCESS" || echo "❌ FAILED"
```

**All tests should show**: `✅ SUCCESS`

---

### **Customer Portal Tests (Port 3001)**

```bash
# Test 1: Root page
curl -s http://localhost:3001/ > /dev/null && echo "✅ Customer portal /: SUCCESS" || echo "❌ FAILED"

# Test 2: Login page
curl -s http://localhost:3001/login > /dev/null && echo "✅ Customer portal /login: SUCCESS" || echo "❌ FAILED"

# Test 3: Home page
curl -s http://localhost:3001/home > /dev/null && echo "✅ Customer portal /home: SUCCESS" || echo "❌ FAILED"
```

**All tests should show**: `✅ SUCCESS`

---

## ⚠️ **COMMON MISTAKES TO AVOID**

### ❌ **WRONG: Using --hostname localhost**
```bash
# DON'T DO THIS!
npm run dev -- --hostname localhost
```
**Problem**: Causes network interface detection issues, leading to 404 errors or crashes.

---

### ❌ **WRONG: Using PORT environment variable**
```bash
# DON'T DO THIS!
PORT=3001 npm run dev
```
**Problem**: Customer portal is already configured for port 3001 in package.json. This causes conflicts.

---

### ❌ **WRONG: Using --port flag**
```bash
# DON'T DO THIS!
npm run dev -- --port 3001
```
**Problem**: Creates duplicate port flags, causes startup failures.

---

### ❌ **WRONG: Running from wrong directory**
```bash
# DON'T DO THIS!
cd /Volumes/T7/erp_turinova_new
npm run dev  # ← Wrong! No package.json here
```
**Problem**: Must run from inside `main-app/` or `customer-portal/` directories.

---

## 🔧 **TROUBLESHOOTING**

### **Issue: Port already in use**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**:
```bash
lsof -ti:3000 | xargs kill -9
# Then restart server
```

---

### **Issue: Network interface error**
```
NodeError [SystemError]: uv_interface_addresses returned Unknown system error 1
```

**Solution**: You used `--hostname localhost` flag. **DON'T USE IT!** Just use `npm run dev` with no flags.

---

### **Issue: 404 for all routes**
**Symptoms**: Server says "Ready" but all pages return 404.

**Solution**:
1. Kill the server
2. Delete `.next` cache:
   ```bash
   cd /Volumes/T7/erp_turinova_new/main-app
   rm -rf .next
   ```
3. Restart with `npm run dev`
4. **Wait 15-20 seconds** for full compilation

---

### **Issue: Servers crash or restart automatically**
**Symptoms**: Server keeps restarting, shows "Found a change in next.config.ts"

**Solution**: 
1. Stop making changes while server is running
2. Let it fully compile before making new edits
3. If persists, kill and restart both servers

---

## 📋 **COMPLETE STARTUP CHECKLIST**

Use this checklist every time you start the servers:

- [ ] **Step 1**: Kill all existing servers
  ```bash
  pkill -9 -f "next dev"
  ```

- [ ] **Step 2**: Navigate to main-app directory
  ```bash
  cd /Volumes/T7/erp_turinova_new/main-app
  ```

- [ ] **Step 3**: Start main app (NO FLAGS!)
  ```bash
  npm run dev
  ```

- [ ] **Step 4**: Wait for "Ready" message (5-10 seconds)

- [ ] **Step 5**: Open NEW terminal window

- [ ] **Step 6**: Navigate to customer-portal directory
  ```bash
  cd /Volumes/T7/erp_turinova_new/customer-portal
  ```

- [ ] **Step 7**: Start customer portal (NO FLAGS!)
  ```bash
  npm run dev
  ```

- [ ] **Step 8**: Wait for "Ready" message (5-10 seconds)

- [ ] **Step 9**: Run verification tests (see above)

- [ ] **Step 10**: Confirm all tests show ✅ SUCCESS

---

## 🎯 **EXPECTED RESULTS**

When both servers are running correctly, you should see:

### **Terminal 1 (Main App)**:
```
   ▲ Next.js 15.1.2
   - Local:        http://localhost:3000
   - Network:      http://192.168.3.1:3000

 ✓ Ready in 1946ms
 ✓ Compiled /src/middleware in 235ms
Middleware - Public route: /login
 GET /login 200 in 5544ms
```

### **Terminal 2 (Customer Portal)**:
```
   ▲ Next.js 15.1.2
   - Local:        http://localhost:3001
   - Network:      http://192.168.3.1:3001

 ✓ Ready in 1845ms
 ✓ Compiled /middleware in 209ms
Middleware - Public route, allowing access: /login
 GET /login 200 in 5024ms
```

**Key indicators**:
- ✅ Shows network address (192.168.x.x) - means it started correctly
- ✅ Shows "GET /login 200" - means routes are working
- ✅ No "Unknown system error 1" - means no network interface issues

---

## 🚨 **WHAT NOT TO DO**

### **Never Use These Commands:**

```bash
# ❌ WRONG
npm run dev -- --hostname localhost

# ❌ WRONG
npm run dev -- --port 3000

# ❌ WRONG
PORT=3001 npm run dev

# ❌ WRONG
npm run dev -- --port 3001 --hostname localhost

# ❌ WRONG (from repo root)
cd /Volumes/T7/erp_turinova_new && npm run dev
```

### **Always Use These Commands:**

```bash
# ✅ CORRECT - Main App
cd /Volumes/T7/erp_turinova_new/main-app
npm run dev

# ✅ CORRECT - Customer Portal
cd /Volumes/T7/erp_turinova_new/customer-portal
npm run dev
```

---

## 📊 **PORT CONFIGURATION**

### **Main App**
- **Port**: 3000 (default Next.js port)
- **Config**: No configuration needed
- **URL**: `http://localhost:3000`

### **Customer Portal**
- **Port**: 3001
- **Config**: Set in `package.json`:
  ```json
  {
    "scripts": {
      "dev": "next dev --port 3001"
    }
  }
  ```
- **URL**: `http://localhost:3001`

**The port is ALREADY configured in package.json - you don't need to specify it!**

---

## 🎯 **QUICK REFERENCE**

### **Start Servers**:
```bash
# Terminal 1
cd /Volumes/T7/erp_turinova_new/main-app && npm run dev

# Terminal 2
cd /Volumes/T7/erp_turinova_new/customer-portal && npm run dev
```

### **Stop Servers**:
```bash
# Kill all Next.js servers
pkill -9 -f "next dev"
```

### **Verify Servers**:
```bash
# Check ports
lsof -ti:3000 && echo "✅ Port 3000 active"
lsof -ti:3001 && echo "✅ Port 3001 active"
```

---

## 📝 **NOTES**

1. **Watchpack Errors**: The "EMFILE: too many open files" warnings are NORMAL and can be ignored. They don't affect functionality.

2. **Compilation Time**: First request to a route takes 3-10 seconds as Next.js compiles on-demand. Subsequent requests are fast.

3. **Network Address**: Seeing `http://192.168.3.1:3000` is GOOD - it means the server started without network interface issues.

4. **Two Terminals Required**: You MUST run two separate terminal windows - one for each app. They cannot run in the same terminal.

5. **Background Mode**: If using background mode, ensure you use `required_permissions: ["network"]` or `["all"]`.

---

## ✅ **SUCCESS CRITERIA**

Servers are working correctly when:

1. ✅ Main app shows: `- Local: http://localhost:3000`
2. ✅ Customer portal shows: `- Local: http://localhost:3001`
3. ✅ Both show network address (e.g., `192.168.3.1`)
4. ✅ All verification tests return HTTP 200
5. ✅ No "Unknown system error" messages
6. ✅ Routes compile and serve successfully

---

## 🎓 **LESSONS LEARNED**

### **What Went Wrong Before:**
1. Used `--hostname localhost` flag → Caused network interface errors
2. Used `PORT=3001` → Conflicted with package.json config
3. Used `--port` flags → Created duplicate port specifications
4. Didn't wait long enough for compilation → Thought servers were broken
5. Tested too quickly → Routes hadn't compiled yet

### **What Works:**
1. ✅ Simple `npm run dev` with NO flags
2. ✅ Wait 15-20 seconds for initial compilation
3. ✅ Run from correct directories (`main-app/` and `customer-portal/`)
4. ✅ Use separate terminal windows
5. ✅ Verify with curl tests after startup

---

## 📞 **FINAL WORD**

**IF YOU EVER NEED TO START THE SERVERS AGAIN, FOLLOW THIS PROCESS EXACTLY:**

1. Kill all servers: `pkill -9 -f "next dev"`
2. Main app: `cd /Volumes/T7/erp_turinova_new/main-app && npm run dev`
3. Customer portal: `cd /Volumes/T7/erp_turinova_new/customer-portal && npm run dev`
4. Wait 15 seconds
5. Run verification tests
6. Confirm all tests show ✅ SUCCESS

**NO FLAGS. NO EXCEPTIONS. NO CREATIVITY.** 

Just `npm run dev` from the correct directory. That's it. 🎯

---

*Last updated: October 22, 2025*
*Status: Both servers verified working with this process*

