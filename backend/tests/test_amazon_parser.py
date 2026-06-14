"""Tests anti-casse du parser Amazon.fr (structure s-search-result réelle).

Si Amazon change son markup, ces tests échouent immédiatement au lieu de
laisser l'app renvoyer silencieusement « 0 résultat ».
"""

from src.connectors.amazon import parse_search_page

REAL_MARKUP = """
<div class="s-main-slot">
  <div data-component-type="s-search-result" data-asin="B0CHWRXH8B">
    <h2 class="a-size-base-plus"><a class="a-link-normal" href="/sspa/click?u=/dp/B0CHWRXH8B">
      <span>Apple AirPods Pro 2 avec boitier de charge MagSafe USB-C</span></a></h2>
    <div class="a-row a-size-small">
      <span class="a-icon-alt">4,8 sur 5 etoiles</span>
      <span class="a-size-base s-underline-text">12 345</span>
    </div>
    <div class="a-price"><span class="a-offscreen">249,00 &euro;</span><span aria-hidden="true">
      <span class="a-price-whole">249<span class="a-price-decimal">,</span></span>
      <span class="a-price-fraction">00</span></span></div>
    <div data-cy="delivery-recipe"><span>Livraison GRATUITE des demain</span></div>
  </div>
  <div data-component-type="s-search-result" data-asin="B09JQMJHXY">
    <h2><a href="/dp/B09JQMJHXY"><span>Casque Bluetooth sans fil</span></a></h2>
    <div class="a-price"><span class="a-offscreen">39,99 &euro;</span></div>
  </div>
  <div data-component-type="s-search-result" data-asin="">
    <h2><a href="#"><span>Ligne placeholder sans ASIN</span></a></h2>
    <div class="a-price"><span class="a-offscreen">10,00 &euro;</span></div>
  </div>
  <div data-component-type="s-search-result" data-asin="B0NOPRICE1">
    <h2><a href="#"><span>Produit sans prix affiche</span></a></h2>
  </div>
</div>
"""


def test_parse_extracts_canonical_fields():
    results = parse_search_page(REAL_MARKUP, max_results=10)
    # 2 produits valides : placeholder (ASIN vide) et sans-prix sont ignorés.
    assert len(results) == 2
    first = results[0]
    assert first.title.startswith("Apple AirPods Pro 2")
    assert first.price_raw == "249,00 €"
    # URL canonique /dp/ASIN, sans le tracking sponsorise du href
    assert first.url == "https://www.amazon.fr/dp/B0CHWRXH8B"
    assert first.extra["asin"] == "B0CHWRXH8B"
    assert "4,8" in first.extra["rating_raw"]
    assert "12 345" in first.reviews_raw
    assert "livraison" in first.delivery_raw.lower()
    assert first.extra["sponsored"] is False


def test_parse_skips_placeholder_and_priceless():
    titles = [r.title for r in parse_search_page(REAL_MARKUP, max_results=10)]
    assert "Ligne placeholder sans ASIN" not in titles
    assert "Produit sans prix affiche" not in titles


def test_price_fallback_to_whole_and_fraction():
    html = """
    <div data-component-type="s-search-result" data-asin="B0WHOLE001">
      <h2><a href="#"><span>Prix en parties</span></a></h2>
      <div class="a-price"><span aria-hidden="true">
        <span class="a-price-whole">19</span><span class="a-price-fraction">90</span></span></div>
    </div>
    """
    results = parse_search_page(html, max_results=5)
    assert len(results) == 1
    assert "19" in results[0].price_raw and "90" in results[0].price_raw


def test_max_results_cap():
    assert len(parse_search_page(REAL_MARKUP, max_results=1)) == 1
