// Simple script to update OptiClient.tsx to use the new Node.js API
const fs = require('fs');
const path = require('path');

const optiClientPath = path.join(__dirname, 'src/app/(dashboard)/opti/OptiClient.tsx');

// Read the file
let content = fs.readFileSync(optiClientPath, 'utf8');

// Update the fetch URL
content = content.replace(
  "fetch('http://localhost:8000/test_optimization.php',",
  "fetch('/api/optimize',"
);

// Write back to file
fs.writeFileSync(optiClientPath, content);

console.log('✅ Updated OptiClient.tsx to use /api/optimize endpoint');
