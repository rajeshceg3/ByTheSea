import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        file_path = f"file://{os.getcwd()}/public/index.html"
        print(f"Loading {file_path}")
        page.goto(file_path)

        page.wait_for_selector('.custom-marker')

        markers = page.locator('.leaflet-marker-icon')
        first_marker = markers.nth(0)
        inner_marker = first_marker.locator('.marker-container')

        # Check tabindex attribute directly
        outer_tabindex = first_marker.get_attribute('tabindex')
        inner_tabindex = inner_marker.get_attribute('tabindex')

        print(f"Outer tabindex: {outer_tabindex}")
        print(f"Inner tabindex: {inner_tabindex}")

        if outer_tabindex is not None and inner_tabindex is not None:
            print("BUG: Double tab stop exists (Both have tabindex).")
        elif outer_tabindex is None and inner_tabindex == "0":
            print("VERIFIED: Single tab stop (Inner only). Correct.")
        else:
            print("Unknown State.")

        # Test Click
        print("\nTesting Click...")
        inner_marker.click()
        page.wait_for_timeout(2000)

        panel = page.locator('#panel')
        if 'active' in panel.get_attribute('class'):
            print("Panel is ACTIVE.")
        else:
            print("BUG: Panel is NOT active.")

        # Verify active state class on marker
        if 'active-state' in first_marker.get_attribute('class'):
            print("Marker has 'active-state' class.")
        else:
            print("BUG: Marker MISSING 'active-state' class.")

        # Take screenshot
        page.screenshot(path="verification_screenshot.png")
        print("Screenshot saved to verification_screenshot.png")

        browser.close()

if __name__ == "__main__":
    run()
