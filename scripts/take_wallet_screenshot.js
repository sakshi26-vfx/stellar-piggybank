import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const screenshotsDir = path.resolve('screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('🚀 Launching headless browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔎 Navigating to http://localhost:5173/...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Locate the "Connect Wallet" button.
  // Wait, let's find the text "Connect Wallet".
  console.log('🔗 Finding "Connect Wallet" button...');
  const connectBtn = page.getByRole('button', { name: /connect wallet/i });
  await connectBtn.waitFor({ state: 'visible', timeout: 5000 });
  await connectBtn.click();

  console.log('⏳ Waiting for wallet kit modal to appear...');
  // The StellarWalletsKit modal typically has a container or dialog element, or we can just wait for modal text.
  // Let's wait for a button with text "Freighter" or similar inside the modal.
  await page.waitForTimeout(2000); // Give it a short moment

  console.log('📸 Taking screenshot...');
  const screenshotPath = path.join(screenshotsDir, 'wallet_options.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`✅ Screenshot saved to ${screenshotPath}`);

  await browser.close();
})();
