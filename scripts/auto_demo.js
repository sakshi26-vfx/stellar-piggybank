// auto_demo.js – Automated demo script for Stellar Piggy Bank
// Run with: npm run demo

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
const __dirname = path.dirname(new URL(import.meta.url).pathname);


(async () => {
   // Ensure screenshots folder exists
   const screenshotsDir = path.resolve('screenshots');
   if (!fs.existsSync(screenshotsDir)) {
     fs.mkdirSync(screenshotsDir, { recursive: true });
   }

  // Launch Chromium (no headless) so user can interact with Freighter popup
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔎 Opening dApp...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Connect wallet if button exists
  const connectBtn = await page.$('text=Connect Wallet');
  if (connectBtn) {
    console.log('🔗 Connecting wallet...');
    await connectBtn.click();
    // Freighter will open a new page for the permission request – we just wait a moment
    await page.waitForTimeout(2000);
  }

  // Initiate a deposit (assumes the UI has a Deposit button with that text)
  const depositBtn = await page.$('text=Deposit to the Future');
  if (depositBtn) {
    console.log('💰 Initiating deposit...');
    await depositBtn.click();
  } else {
    console.warn('⚠️ Deposit button not found – aborting script.');
    await browser.close();
    return;
  }

  // At this point Freighter popup should appear in a separate page
  // Wait for the popup page to appear
  const popup = await context.waitForEvent('page', { timeout: 15000 });
  console.log('🔐 Freighter signing popup opened.');
  await popup.bringToFront();
  await popup.waitForLoadState();
  // Capture screenshot of the popup
  await popup.screenshot({ path: path.join(screenshotsDir, '02_freighter_popup.png') });

   // Automatically click the Sign button in the Freighter popup
   const signBtn = await popup.$('button:has-text("Sign"), button:has-text("Approve")');
   if (signBtn) {
       await signBtn.click();
       console.log('✍️ Auto-signed transaction.');
   } else {
       console.warn('⚠️ Sign button not found, proceeding without clicking.');
   }

  // Back to main page – wait for success toast
  await page.waitForSelector('.toast-success', { timeout: 20000 });
  console.log('🎉 Transaction succeeded.');

  // Capture screenshots of the final UI states
  await page.screenshot({ path: path.join(screenshotsDir, '01_dashboard.png'), fullPage: true });
  await page.screenshot({ path: path.join(screenshotsDir, '03_success.png'), fullPage: true });

  // Scroll to bottom (history) and capture
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotsDir, '04_history.png'), fullPage: true });

  // Extract transaction hash from toast if present
  const toast = await page.$('.toast-success');
  if (toast) {
    const text = await toast.textContent();
    const hashMatch = text && text.match(/[a-f0-9]{64}/i);
    if (hashMatch) {
      console.log('🔗 Transaction hash:', hashMatch[0]);
    }
  }

  await browser.close();
})();
