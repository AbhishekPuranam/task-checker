import { chromium } from 'playwright';

async function testAdminLogin() {
  console.log('\n🔵 Testing Admin Login...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to admin portal
    await page.goto('http://localhost/admin', { waitUntil: 'networkidle' });
    console.log('✓ Navigated to:', page.url());

    // Take initial screenshot
    await page.screenshot({ path: 'admin-initial.png' });
    console.log('✓ Screenshot saved: admin-initial.png');

    // Wait a bit and check if we're on login page or dashboard
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    if (currentUrl.includes('localhost/') && !currentUrl.includes('/admin')) {
      // We're on login page
      console.log('✓ On login page');
      
      // Fill in admin credentials
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin123');
      console.log('✓ Filled admin credentials');

      // Click login button
      await page.click('button[type="submit"]');
      console.log('✓ Clicked login button');

      // Wait for redirect
      await page.waitForURL('http://localhost/admin*', { timeout: 10000 });
      console.log('✓ Redirected to admin dashboard');
    } else if (currentUrl.includes('/admin')) {
      console.log('✓ Already on admin dashboard (already logged in)');
    }

    // Take screenshot of final state
    await page.screenshot({ path: 'admin-dashboard.png', fullPage: true });
    console.log('✓ Screenshot saved: admin-dashboard.png');

    // Check page content
    const pageContent = await page.content();
    if (pageContent.includes('Dashboard') || pageContent.includes('Admin') || pageContent.includes('User Management')) {
      console.log('✅ Admin portal accessible!');
    }

    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('❌ Admin test failed:', error.message);
    await page.screenshot({ path: 'admin-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

async function testEngineerLogin() {
  console.log('\n🟡 Testing Engineer Login...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to engineer portal
    await page.goto('http://localhost/jobs', { waitUntil: 'networkidle' });
    console.log('✓ Navigated to:', page.url());

    // Take initial screenshot
    await page.screenshot({ path: 'engineer-initial.png' });
    console.log('✓ Screenshot saved: engineer-initial.png');

    // Wait a bit and check if we're on login page or dashboard
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    if (currentUrl.includes('localhost/') && !currentUrl.includes('/jobs')) {
      // We're on login page
      console.log('✓ On login page');
      
      // Fill in engineer credentials
      await page.fill('input[name="username"]', 'engineer');
      await page.fill('input[name="password"]', 'engineer123');
      console.log('✓ Filled engineer credentials');

      // Click login button
      await page.click('button[type="submit"]');
      console.log('✓ Clicked login button');

      // Wait for redirect
      await page.waitForURL('http://localhost/jobs*', { timeout: 10000 });
      console.log('✓ Redirected to engineer dashboard');
    } else if (currentUrl.includes('/jobs')) {
      console.log('✓ Already on jobs dashboard (already logged in)');
    }

    // Take screenshot of final state
    await page.screenshot({ path: 'engineer-dashboard.png', fullPage: true });
    console.log('✓ Screenshot saved: engineer-dashboard.png');

    // Check page content
    const pageContent = await page.content();
    if (pageContent.includes('Jobs') || pageContent.includes('Dashboard') || pageContent.includes('Task')) {
      console.log('✅ Engineer portal accessible!');
    }

    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('❌ Engineer test failed:', error.message);
    await page.screenshot({ path: 'engineer-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

// Run tests sequentially
(async () => {
  console.log('🚀 Starting Login Tests...\n');
  await testAdminLogin();
  await testEngineerLogin();
  console.log('\n✨ All tests completed!\n');
})();
