/**
 * Performance Test Script
 * 
 * Run this in the browser console on the product edit page to measure performance improvements.
 * 
 * Usage:
 * 1. Open the product edit page: http://localhost:3000/products/[id]
 * 2. Open browser DevTools (F12)
 * 3. Go to Console tab
 * 4. Paste this entire script and press Enter
 * 5. Wait for results
 */

(function() {
  console.log('🚀 Starting Performance Test...\n');
  
  const results = {
    initialLoad: {},
    apiCalls: [],
    tabSwitching: {},
    memoryUsage: {}
  };
  
  // Track API calls
  const originalFetch = window.fetch;
  const apiCallTimes = [];
  
  window.fetch = function(...args) {
    const startTime = performance.now();
    const url = args[0];
    
    return originalFetch.apply(this, args).then(response => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (typeof url === 'string' && url.startsWith('/api/')) {
        apiCallTimes.push({
          url,
          duration: Math.round(duration),
          timestamp: performance.now()
        });
      }
      
      return response;
    });
  };
  
  // Measure initial load
  const measureInitialLoad = () => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    
    results.initialLoad = {
      domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
      loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime ? Math.round(paint.find(p => p.name === 'first-paint').startTime) : null,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime ? Math.round(paint.find(p => p.name === 'first-contentful-paint').startTime) : null,
      totalLoadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart)
    };
    
    // Count API calls made during initial load (first 3 seconds)
    const initialApiCalls = apiCallTimes.filter(call => call.timestamp < 3000);
    results.apiCalls = {
      total: apiCallTimes.length,
      duringInitialLoad: initialApiCalls.length,
      calls: initialApiCalls.map(c => ({ url: c.url, duration: c.duration }))
    };
  };
  
  // Measure tab switching performance
  const measureTabSwitch = async (tabIndex) => {
    const tabButton = document.querySelector(`button[role="tab"][aria-controls="product-tab-${tabIndex}"]`);
    if (!tabButton) {
      console.warn(`Tab ${tabIndex} not found`);
      return;
    }
    
    const startTime = performance.now();
    tabButton.click();
    
    // Wait for tab content to load (check for loading spinner disappearance)
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const tabPanel = document.querySelector(`#product-tabpanel-${tabIndex}`);
        const hasSpinner = tabPanel?.querySelector('.MuiCircularProgress-root');
        
        if (!hasSpinner && tabPanel && !tabPanel.hidden) {
          clearInterval(checkInterval);
          const endTime = performance.now();
          results.tabSwitching[`tab-${tabIndex}`] = Math.round(endTime - startTime);
          resolve();
        }
      }, 50);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
  };
  
  // Measure memory usage
  const measureMemory = () => {
    if (performance.memory) {
      results.memoryUsage = {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
      };
    }
  };
  
  // Run tests
  const runTests = async () => {
    console.log('⏱️  Measuring initial load...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for initial load
    measureInitialLoad();
    measureMemory();
    
    console.log('✅ Initial load measurement complete');
    console.log('\n📊 Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📈 Initial Load Performance:');
    console.table(results.initialLoad);
    console.log('\n🌐 API Calls:');
    console.log(`   Total API calls: ${results.apiCalls.total}`);
    console.log(`   During initial load (first 3s): ${results.apiCalls.duringInitialLoad}`);
    if (results.apiCalls.calls.length > 0) {
      console.log('\n   API Calls made:');
      results.apiCalls.calls.forEach(call => {
        console.log(`   - ${call.url}: ${call.duration}ms`);
      });
    }
    console.log('\n💾 Memory Usage:');
    if (Object.keys(results.memoryUsage).length > 0) {
      console.table(results.memoryUsage);
    } else {
      console.log('   Memory API not available in this browser');
    }
    
    console.log('\n🔄 Testing tab switching...');
    console.log('   (This will automatically switch through tabs)');
    
    // Test tab switching (skip tab 0 as it's already loaded)
    for (let i = 1; i <= 4; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tabs
      await measureTabSwitch(i);
      console.log(`   Tab ${i} switched in ${results.tabSwitching[`tab-${i}`]}ms`);
    }
    
    console.log('\n📊 Tab Switching Performance:');
    console.table(results.tabSwitching);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ Performance Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   Initial Load Time: ${results.initialLoad.totalLoadTime}ms`);
    console.log(`   First Contentful Paint: ${results.initialLoad.firstContentfulPaint}ms`);
    console.log(`   API Calls (initial load): ${results.apiCalls.duringInitialLoad}`);
    console.log(`   Total API Calls: ${results.apiCalls.total}`);
    if (results.memoryUsage.usedJSHeapSize) {
      console.log(`   Memory Used: ${results.memoryUsage.usedJSHeapSize}MB`);
    }
    
    // Return results for programmatic access
    window.performanceTestResults = results;
    console.log('\n💡 Results saved to window.performanceTestResults');
    
    return results;
  };
  
  // Start tests after a short delay to ensure page is ready
  setTimeout(runTests, 1000);
  
  return 'Performance test started. Results will appear in console...';
})();
