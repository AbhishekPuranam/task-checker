const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost/');
    await page.waitForTimeout(1000);

    console.log('2. Checking localStorage before login...');
    const beforeLogin = await page.evaluate(() => {
      return {
        token: localStorage.getItem('token'),
        user: localStorage.getItem('user')
      };
    });
    console.log('Before login localStorage:', beforeLogin);

    console.log('3. Filling login form...');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');

    console.log('4. Submitting login...');
    await page.click('#loginBtn');
    
    console.log('5. Waiting for redirect to dashboard...');
    await page.waitForURL('**/admin/dashboard', { timeout: 5000 });
    console.log('Redirected to:', page.url());

    await page.waitForTimeout(1000);

    console.log('6. Checking localStorage after login...');
    const afterLogin = await page.evaluate(() => {
      return {
        token: localStorage.getItem('token'),
        user: localStorage.getItem('user')
      };
    });
    console.log('After login localStorage:', afterLogin);

    console.log('7. Clicking New Project button...');
    // Look for the button with text "New Project"
    const newProjectButton = await page.locator('text=New Project').first();
    if (await newProjectButton.isVisible()) {
      await newProjectButton.click();
      console.log('Clicked New Project button');
      
      await page.waitForTimeout(2000);
      
      console.log('8. Current URL after clicking:', page.url());
      console.log('9. Page title:', await page.title());
      
      const pageContent = await page.content();
      if (pageContent.includes('404') || pageContent.includes('This page could not be found')) {
        console.log('❌ Got 404 page!');
      } else if (pageContent.includes('Redirecting to login')) {
        console.log('❌ Got redirect to login!');
      } else {
        console.log('✅ Page loaded successfully!');
      }
      
    } else {
      console.log('❌ New Project button not found on page');
    }

    console.log('\n10. Keeping browser open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
