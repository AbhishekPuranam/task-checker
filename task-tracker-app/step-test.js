const { chromium } = require('playwright');

async function stepByStepTest() {
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 1000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🌐 Step 1: Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    console.log('✅ Current URL:', page.url());
    
    console.log('\n⏳ Step 2: Waiting for page to load...');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: 'step-1-loaded.png', fullPage: true });
    
    console.log('\n🔍 Step 3: Looking for login form...');
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    console.log('✅ Found username field');
    
    console.log('\n📝 Step 4: Filling login form...');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.screenshot({ path: 'step-2-form-filled.png', fullPage: true });
    
    console.log('\n🔘 Step 5: Clicking Sign In...');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(3000);
    console.log('✅ Current URL after login:', page.url());
    await page.screenshot({ path: 'step-3-after-login.png', fullPage: true });
    
    console.log('\n🏠 Step 6: Checking if we reached dashboard...');
    
    // Wait and see what happens
    await page.waitForTimeout(5000);
    console.log('📍 Final URL:', page.url());
    
    // Check for different possible states
    if (page.url().includes('/login')) {
      console.log('❌ Still on login page - login may have failed');
      const errorMsg = await page.locator('.error, .alert, [role="alert"]').first().textContent().catch(() => 'No error message found');
      console.log('🔍 Error message:', errorMsg);
    } else if (page.url().includes('/dashboard') || page.url() === 'http://localhost:3000/') {
      console.log('✅ Successfully logged in!');
      
      // Look for navigation options
      const navElements = await page.$$('nav a, .nav-link, button');
      console.log(`🔍 Found ${navElements.length} navigation elements`);
      
      for (let i = 0; i < Math.min(10, navElements.length); i++) {
        const text = await navElements[i].textContent();
        console.log(`  Nav ${i+1}: "${text}"`);
      }
    }
    
    await page.screenshot({ path: 'step-4-final.png', fullPage: true });
    console.log('\n🔍 Check screenshots: step-1-loaded.png, step-2-form-filled.png, step-3-after-login.png, step-4-final.png');
    
    // Keep browser open for inspection
    console.log('\n⏸️ Keeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

stepByStepTest().catch(console.error);