const { test, expect } = require('@playwright/test');

test.describe('CodeMirror Editor UI', () => {
  test.beforeEach(async ({ page }) => {
    // Start a local server to serve the application
    await page.goto('http://localhost:3456');
  });

  test('should load JSON with proper syntax highlighting and newlines', async ({ page }) => {
    // Wait for the projects to load
    await page.waitForSelector('#project-select option');

    console.log('Project selector options:', await page.innerHTML('#project-select'));

    // Click on a data type to load data into the editor
    await page.click('[data-type="decisions"]');

    // Wait for the editor to be populated
    await page.waitForSelector('.cm-editor');

    await page.pause();

    // Check for syntax highlighting
    const stringToken = await page.locator('.cm-string').first();
    await expect(stringToken).toBeVisible();

    const numberToken = await page.locator('.cm-number').first();
    await expect(numberToken).toBeVisible();

    const propertyNameToken = await page.locator('.cm-property').first();
    await expect(propertyNameToken).toBeVisible();

    // Check for newlines
    const lines = await page.locator('.cm-line').count();
    expect(lines).toBeGreaterThan(1);
  });
});
