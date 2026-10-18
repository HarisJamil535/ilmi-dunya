const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(error.message));
    const session = await page.context().newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 64000, uploadThroughput: 32000 });
    await page.route('**/api/**', route => route.fulfill({ json: { boards: [], classes: [], groups: [] } }));
    await page.goto('http://127.0.0.1:5182/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true', null, { timeout: 60000 });
    for (const [width, height] of [[360, 640], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible' });
      const bounds = await dialog.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
      await page.getByRole('button', { name: 'Try connection' }).click();
      await dialog.waitFor({ state: 'hidden' });
    }
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('app-network-error', { detail: { service: true } })));
    await page.getByRole('heading', { name: 'Temporarily unavailable' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    console.log('Slow-network load (512 kbps / 300 ms), desktop/mobile dialog bounds, recovery, service message and keyboard dismissal passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
