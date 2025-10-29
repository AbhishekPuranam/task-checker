const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('api') || text.includes('error') || text.includes('Error')) {
      console.log('CONSOLE:', text);
    }
  });

  try {
    await page.goto('http://localhost/');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('#loginBtn');
    await page.waitForURL('**/admin/dashboard', { timeout: 5000 });
    await page.waitForTimeout(2000);

    await page.click('text=New Project');
    await page.waitForURL('**/admin/projects/new', { timeout: 5000 });
    await page.waitForTimeout(2000);

    console.log('\n=== Filling form ===');
    await page.fill('input[name="title"]', 'UI Test ' + Date.now());
    await page.fill('textarea[name="description"]', 'Test description');
    await page.fill('input[name="location"]', 'Test location');
    
    console.log('=== Submitting form ===');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(5000);
    
    console.log('\n=== Console logs with "api" or "error": ===');
    const apiLogs = consoleLogs.filter(log => 
      log.toLowerCase().includes('api') || 
      log.toLowerCase().includes('error') ||
      log.toLowerCase().includes('failed')
    );
    apiLogs.slice(-10).forEach(log => console.log(log));
    
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
