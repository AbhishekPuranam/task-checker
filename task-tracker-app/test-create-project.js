const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  try {
    console.log('1. Logging in...');
    await page.goto('http://localhost/');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('#loginBtn');
    
    await page.waitForURL('**/admin/dashboard', { timeout: 5000 });
    console.log('✅ Logged in successfully');
    
    await page.waitForTimeout(1000);

    console.log('2. Clicking New Project...');
    await page.click('text=New Project');
    
    await page.waitForURL('**/admin/projects/new', { timeout: 5000 });
    console.log('✅ Navigated to New Project page');
    
    await page.waitForTimeout(1000);

    console.log('3. Filling project form...');
    await page.fill('input[name="title"]', 'UI Test Project ' + Date.now());
    await page.fill('textarea[name="description"]', 'This is a test project created from UI');
    await page.fill('input[name="location"]', 'Mumbai, India');
    
    console.log('4. Submitting form...');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(3000);
    
    console.log('5. Current URL:', page.url());
    
    const pageContent = await page.content();
    if (pageContent.includes('Project created successfully') || pageContent.includes('success')) {
      console.log('✅ Project created successfully!');
    } else if (pageContent.includes('error') || pageContent.includes('Error')) {
      console.log('❌ Error creating project');
      console.log('Page content snippet:', pageContent.substring(0, 500));
    }

    console.log('\nKeeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
