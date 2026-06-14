import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = await browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale="fr-FR",
        )
        url = "https://www.amazon.fr/s?k=t+shirt+noir+personnalisé&language=fr"
        await page.goto(url, wait_until="domcontentloaded", timeout=25000)
        await page.wait_for_timeout(2000)
        print("TITLE:", await page.title())
        print("URL:", page.url)
        items = await page.query_selector_all('[data-component-type="s-search-result"]')
        print("ITEMS:", len(items))
        if len(items) == 0:
            items = await page.query_selector_all("[data-asin][data-index]")
            print("FALLBACK_ITEMS:", len(items))
        if items:
            first = items[0]
            title_el = await first.query_selector("h2 a span")
            print("TITLE_EL:", await title_el.inner_text() if title_el else "None")
            price_el = await first.query_selector(".a-price .a-offscreen")
            print("PRICE_EL:", await price_el.inner_text() if price_el else "None")
        await page.screenshot(path="C:/Users/jonat/Documents/shopping-assistant/debug_amazon.png", full_page=False)
        await browser.close()

asyncio.run(main())
