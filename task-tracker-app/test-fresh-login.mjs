import { chromium } from 'playwright';

async function testAdminLogin() {
  console.log('\n🔵 Testing Admin Fresh Login...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();  // Fresh context with no cookies
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto('http://localhost/', { waitUntil: 'networkidle' });
    console.log('✓ Navigated to login page');

    // Take screenshot of login page
    await page.screenshot({ path: 'login-page.png' });
    console.log('✓ Screenshot saved: login-page.png');

    // Fill in admin credentials
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    console.log('✓ Filled admin credentials (username: admin)');

    // Take screenshot before login
    await page.screenshot({ path: 'before-admin-login.png' });

    // Click login button
    await page.click('button[type="submit"]');
    console.log('✓ Clicked login button');

    // Wait for navigation
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    // Check if redirected to admin dashboard
    if (currentUrl.includes('/admin')) {
      console.log('✅ Successfully logged in and redirected to admin dashboard!');
      
      // Take screenshot of admin dashboard
      await page.screenshot({ path: 'admin-logged-in.png', fullPage: true });
      console.log('✓ Screenshot saved: admin-logged-in.png');

      // Check page content
      const pageContent = await page.textContent('body');
      if (pageContent.includes('Dashboard') || pageContent.includes('Admin')) {
        console.log('✅ Admin dashboard loaded successfully!');
      }
    } else {
      console.log('⚠️  Not redirected to admin dashboard. Current URL:', currentUrl);
      await page.screenshot({ path: 'admin-login-failed.png', fullPage: true });
    }

    // Keep browser open for 3 seconds
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('❌ Admin login failed:', error.message);
    await page.screenshot({ path: 'admin-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

async function testEngineerLogin() {
  console.log('\n🟡 Testing Engineer Fresh Login...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();  // Fresh context with no cookies
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto('http://localhost/', { waitUntil: 'networkidle' });
    console.log('✓ Navigated to login page');

    // Fill in engineer credentials
    await page.fill('input[name="username"]', 'engineer');
    await page.fill('input[name="password"]', 'engineer123');
    console.log('✓ Filled engineer credentials (username: engineer)');

    // Take screenshot before login
    await page.screenshot({ path: 'before-engineer-login.png' });

    // Click login button
    await page.click('button[type="submit"]');
    console.log('✓ Clicked login button');

    // Wait for navigation
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    // Check if redirected to engineer dashboard
    if (currentUrl.includes('/jobs')) {
      console.log('✅ Successfully logged in and redirected to engineer dashboard!');
      
      // Take screenshot of engineer dashboard
      await page.screenshot({ path: 'engineer-logged-in.png', fullPage: true });
      console.log('✓ Screenshot saved: engineer-logged-in.png');

      // Check page content
      const pageContent = await page.textContent('body');
      if (pageContent.includes('Jobs') || pageContent.includes('Dashboard')) {
        console.log('✅ Engineer dashboard loaded successfully!');
      }
    } else {
      console.log('⚠️  Not redirected to jobs dashboard. Current URL:', currentUrl);
      await page.screenshot({ path: 'engineer-login-failed.png', fullPage: true });
    }

    // Keep browser open for 3 seconds
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('❌ Engineer login failed:', error.message);
    await page.screenshot({ path: 'engineer-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

// Run tests sequentially
(async () => {
  console.log('🚀 Starting Fresh Login Tests...\n');
  console.log('These tests will perform actual logins with username/password\n');
  
  await testAdminLogin();
  await testEngineerLogin();
  
  console.log('\n✨ All tests completed!');
  console.log('\nCheck the following screenshots:');
  console.log('  - login-page.png');
  console.log('  - before-admin-login.png');
  console.log('  - admin-logged-in.png');
  console.log('  - before-engineer-login.png');
  console.log('  - engineer-logged-in.png\n');
})();
