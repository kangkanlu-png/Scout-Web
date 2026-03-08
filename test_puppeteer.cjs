const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // Set cookie to bypass login
  await context.addCookies([{
    name: 'admin_session',
    value: 'authenticated',
    domain: '127.0.0.1',
    path: '/'
  }]);

  const page = await context.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('dialog', async dialog => {
    console.log('DIALOG:', dialog.message());
    await dialog.accept();
  });

  console.log('Navigating to admin/members...');
  await page.goto('http://127.0.0.1:3000/admin/members');
  
  console.log('Opening import modal...');
  await page.click('button:has-text("CSV 匯入")');
  
  console.log('Uploading file...');
  const input = await page.$('input#csv-file');
  await input.setInputFiles('/home/user/uploaded_files/115年資料-格式輸入.xlsx');
  
  // Wait a bit to let parsing finish
  await page.waitForTimeout(3000);
  
  const preview = await page.$('#csv-preview');
  const classList = await preview.evaluate(el => Array.from(el.classList));
  console.log('Preview classes:', classList);
  
  const headerHtml = await page.$eval('#csv-header', el => el.innerHTML);
  console.log('Header HTML:', headerHtml);
  
  await browser.close();
})();
