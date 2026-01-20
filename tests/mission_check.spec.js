import { test, expect } from '@playwright/test';

test.describe('Mamallapuram Map Mission Check', () => {
    test('System initialization and interaction check', async ({ page }) => {
        // Navigate to local server (Assumes 'npm start' or similar running on port 3000)
        // Using 'npx serve public' defaults to 3000.
        await page.goto('http://localhost:3000/');

        // 1. Verify Title
        await expect(page).toHaveTitle(/Mamallapuram Guide/);

        // 2. Map Check
        const map = page.locator('#map');
        await expect(map).toBeVisible();

        // 3. Wait for markers
        const markerWrapper = page.locator('.marker-wrapper').first();
        await markerWrapper.waitFor({ state: 'visible', timeout: 10000 });

        // 4. Interaction: Keyboard Activation (Enter) to trigger Focus Management
        await markerWrapper.focus();
        await page.keyboard.press('Enter');

        // 5. Verify Panel Open
        const panel = page.locator('#info-panel');
        await expect(panel).toHaveClass(/active/);
        await expect(panel).toBeVisible();

        // 6. Verify Focus Management (Button should be focused after delay)
        const closeBtn = page.locator('#close-panel');
        await expect(closeBtn).toBeFocused({ timeout: 2000 });

        // 7. Close Panel (via Keyboard Escape)
        await page.keyboard.press('Escape');

        // 8. Verify Panel Closed
        await expect(panel).not.toHaveClass(/active/);

        // 9. Verify Focus Return to Marker
        await expect(markerWrapper).toBeFocused();
    });
});
