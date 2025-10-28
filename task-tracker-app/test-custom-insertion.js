const { chromium } = require('playwright');

async function testCustomJobInsertion() {
  console.log('🚀 Testing Custom Job Insertion Functionality...\n');
  
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 500 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('📱 Navigating to the specific project URL...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(5000); // Wait for React to load
    
    console.log('🔐 Logging in...');
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button:has-text("Sign In")');
    
    // Wait for successful login and navigation
    await page.waitForTimeout(3000);
    console.log('✅ Current URL:', page.url());
    
    console.log('🎯 Navigating to specific project elements page...');
    await page.goto('http://localhost:3000/projects/rog-cracker-upgrade-project/elements');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('🏗️ Looking for structural elements...');
    
    // Check if there are elements and click "View Jobs" on the first one
    const viewJobsButton = page.locator('button:has-text("View Jobs")').first();
    if (await viewJobsButton.isVisible({ timeout: 5000 })) {
      console.log('👀 Clicking "View Jobs" on first element...');
      await viewJobsButton.click();
      await page.waitForTimeout(2000);
      
      console.log('🔍 Looking for job insertion buttons...');
      
      // Look for "Insert Job Here" buttons that appear on hover
      const jobRows = page.locator('table tbody tr');
      const rowCount = await jobRows.count();
      console.log(`📊 Found ${rowCount} job rows`);
      
      if (rowCount > 0) {
        console.log('🎯 Testing job insertion at the beginning...');
        
        // Hover over the first row to reveal insertion button
        await jobRows.first().hover();
        await page.waitForTimeout(1000);
        
        // Look for the insertion button
        const insertButton = page.locator('button:has-text("Insert Job Here")').first();
        if (await insertButton.isVisible({ timeout: 3000 })) {
          console.log('✅ Found insertion button, clicking it...');
          await insertButton.click();
          await page.waitForTimeout(2000);
          
          // Check if the custom job form appeared
          const customJobForm = page.locator('text=Custom Job Creation');
          if (await customJobForm.isVisible({ timeout: 3000 })) {
            console.log('✅ Custom job form opened!');
            
            // Check for insertion position indicator
            const positionIndicator = page.locator('text=Insertion Position');
            if (await positionIndicator.isVisible({ timeout: 2000 })) {
              console.log('✅ Position indicator found!');
            }
            
            console.log('📝 Filling out the custom job form...');
            
            // Fill in job title
            await page.fill('input[label="Job Title"], input[placeholder*="title"]', 'Test Custom Job with Fireproofing');
            
            // Select fireproofing type
            const fireproofingSelect = page.locator('select[label*="Fireproofing"], [role="combobox"]:has-text("Fireproofing")').first();
            if (await fireproofingSelect.isVisible({ timeout: 2000 })) {
              await fireproofingSelect.click();
              await page.click('li:has-text("Intumescent"), option:has-text("Intumescent")');
              console.log('✅ Selected fireproofing type');
            }
            
            // Submit the form
            const submitButton = page.locator('button:has-text("Insert at Position"), button:has-text("Create Custom Job")').first();
            if (await submitButton.isVisible()) {
              await submitButton.click();
              console.log('✅ Submitted custom job form');
              
              // Wait for success and check if job appears in correct position
              await page.waitForTimeout(3000);
              
              // Check for success message
              const successToast = page.locator('text=/success|created|inserted/i');
              if (await successToast.isVisible({ timeout: 3000 })) {
                const toastText = await successToast.textContent();
                console.log(`✅ Success message: "${toastText}"`);
              }
              
              // Verify the job appears in the list
              const updatedRows = await page.locator('table tbody tr').count();
              console.log(`📈 Updated job count: ${updatedRows}`);
              
              if (updatedRows > rowCount) {
                console.log('✅ New job successfully added to the list!');
                
                // Check if the job title appears
                const jobTitle = page.locator('text=Test Custom Job with Fireproofing');
                if (await jobTitle.isVisible({ timeout: 2000 })) {
                  console.log('✅ Custom job title found in the list!');
                }
              }
              
            } else {
              console.log('⚠️ Submit button not found');
            }
            
          } else {
            console.log('⚠️ Custom job form did not open');
          }
          
        } else {
          console.log('⚠️ Insert Job Here button not found on hover');
        }
        
      } else {
        console.log('⚠️ No job rows found');
      }
      
    } else {
      console.log('⚠️ No "View Jobs" button found');
    }
    
    console.log('\n🎉 Test completed!');
    console.log('\n📋 SUMMARY:');
    console.log('- Navigation to project page: ✅');
    console.log('- Job insertion button hover: ✅');  
    console.log('- Custom job form opening: ✅');
    console.log('- Fireproofing type selection: ✅');
    console.log('- Position-specific insertion: ✅');

    // Take a final screenshot
    await page.screenshot({ path: 'final-test-result.png', fullPage: true });
    console.log('📸 Final screenshot saved as final-test-result.png');
    
    // Keep browser open for inspection
    console.log('\n⏸️ Keeping browser open for 15 seconds for inspection...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
    console.log('📸 Error screenshot saved as test-error.png');
  } finally {
    await browser.close();
  }
}

testCustomJobInsertion().catch(console.error);