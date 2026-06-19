const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:5174');
  await page.click('button:has-text("Connect Wallet")');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
