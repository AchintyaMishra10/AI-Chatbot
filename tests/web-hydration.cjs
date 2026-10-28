const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../.repair/browser/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [390, 1280]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      const response = await page.goto((process.env.TEST_BASE_URL || 'http://localhost:8090'), { waitUntil: 'networkidle', timeout: 120000 });
      const html = await response.text();
      assert.match(html, /What’s on your mind/);
      const button = page.getByRole('button', { name: 'Start a new chat' });
      await button.waitFor();
      await page.waitForFunction(expected => document.querySelector('[aria-label="Start a new chat"]')?.textContent === expected, width < 600 ? '+ New' : '+ New chat');
      const bg = await page.getByRole('textbox', { name: 'Message mishirji ka bot' }).evaluate(el => getComputedStyle(el).color);
      assert.equal(bg, colorScheme === 'dark' ? 'rgb(237, 243, 237)' : 'rgb(36, 57, 46)');
      assert.deepEqual(errors.filter(x => /hydration|hydrated|server rendered|didn't match/i.test(x)), []);
      await page.setViewportSize({ width: width < 600 ? 1280 : 390, height: 900 });
      await page.waitForFunction(expected => document.querySelector('[aria-label="Start a new chat"]')?.textContent === expected, width < 600 ? '+ New chat' : '+ New');
      await page.goto((process.env.TEST_BASE_URL || (process.env.TEST_BASE_URL || 'http://localhost:8090')) + '/explore', { waitUntil: 'networkidle', timeout: 60000 });
      assert.deepEqual(errors.filter(x => /hydration|hydrated|server rendered|didn't match/i.test(x)), []);
      console.log(`PASS SSR hydration, theme, resize, Explore: ${width}px ${colorScheme}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

