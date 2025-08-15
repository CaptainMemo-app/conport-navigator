const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('Browser console:', msg.text()));
  page.on('pageerror', error => console.log('Page error:', error.message));
  
  try {
    console.log('Testing http://localhost:3456...');
    
    // Try to navigate to the page
    const response = await page.goto('http://localhost:3456', {
      waitUntil: 'networkidle',
      timeout: 10000
    });
    
    console.log('Response status:', response.status());
    console.log('Response headers:', response.headers());
    
    // Get the page content
    const content = await page.content();
    console.log('Page content length:', content.length);
    console.log('First 500 chars:', content.substring(0, 500));
    
    // Check if it's the error page or actual content
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    
    // Try to get the body text
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Body text:', bodyText.substring(0, 200));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'server-test.png' });
    console.log('Screenshot saved as server-test.png');
    
  } catch (error) {
    console.error('Error during test:', error.message);
  } finally {
    await browser.close();
  }
})();