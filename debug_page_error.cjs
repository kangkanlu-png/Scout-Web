const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([{ name: 'admin_session', value: 'authenticated', domain: '127.0.0.1', path: '/' }]);
  const page = await context.newPage();
  
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message, err.stack));
  
  await page.goto('http://127.0.0.1:3000/admin/members');
  await browser.close();
})();
