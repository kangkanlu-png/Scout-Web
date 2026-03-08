const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    if (err.stack) console.log('STACK:', err.stack);
  });
  await page.goto('http://127.0.0.1:3000/admin/login');
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin');
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  await page.goto('http://127.0.0.1:3000/admin/members');
  await page.waitForTimeout(2000);
  await browser.close();
})();
