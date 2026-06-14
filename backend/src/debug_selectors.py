from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(user_agent="Mozilla/5.0", locale="fr-FR")
    page.goto("https://www.amazon.fr/s?k=t+shirt+noir", wait_until="domcontentloaded", timeout=25000)
    page.wait_for_timeout(1500)
    items = page.query_selector_all('[data-component-type="s-search-result"]')
    print("ITEMS", len(items))
    if items:
        first = items[0]
        print("DELIVERY:", first.query_selector(".s-align-children-center .a-color-base").inner_text() if first.query_selector(".s-align-children-center .a-color-base") else "None")
        print("REVIEWS:", first.query_selector(".a-size-small .a-offscreen").inner_text() if first.query_selector(".a-size-small .a-offscreen") else "None")
        print("RATING:", first.query_selector(".a-icon-alt").inner_text() if first.query_selector(".a-icon-alt") else "None")
        alt = first.query_selector('[data-csa-c-content-id="s-delivery-desktop"] .a-color-base')
        if alt:
            print("DELIVERY_ALT:", alt.inner_text())
    browser.close()
