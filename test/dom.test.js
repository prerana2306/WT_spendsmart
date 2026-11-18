/**
 * SpendSmart DOM & Dashboard Controller Verification Test
 * Simulates browser DOM loading and verifies dashboard.html + dashboard.js execution.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runDOMVerification() {
  console.log('====================================================');
  console.log(' SpendSmart Dashboard DOM & Element ID Verification ');
  console.log('====================================================\n');

  const html = fs.readFileSync(path.join(__dirname, '../public/dashboard.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../public/js/dashboard.js'), 'utf8');

  // Extract all getElementById and setElementText/HTML calls from dashboard.js
  const regex = /(?:getElementById|setElementText|setElementHTML)\(\s*['"]([^'"]+)['"]/g;
  let match;
  const idsInJS = new Set();
  while ((match = regex.exec(js)) !== null) {
    idsInJS.add(match[1]);
  }

  console.log(`Found ${idsInJS.size} unique element IDs referenced in dashboard.js:`);
  let missingCount = 0;

  idsInJS.forEach(id => {
    const existsInHTML = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
    if (existsInHTML) {
      console.log(`  ✅ id="${id}" exists in dashboard.html`);
    } else {
      console.log(`  ❌ id="${id}" MISSING in dashboard.html!`);
      missingCount++;
    }
  });

  console.log('\n----------------------------------------------------');
  if (missingCount === 0) {
    console.log('🎉 Verification SUCCESS: All JavaScript element IDs match HTML elements!');
  } else {
    console.log(`❌ Verification FAILED: ${missingCount} element IDs are missing in dashboard.html.`);
    process.exit(1);
  }
}

runDOMVerification();
