from src.connectors.ebay import parse_search_page

# Markup 2025+ d'eBay (li.s-card / su-card-container), tel qu'observé en réel
NEW_MARKUP = """
<ul class="srp-results srp-list">
  <li class="s-card s-card--horizontal">
    <div class="su-card-container su-card-container--horizontal">
      <div class="su-card-container__header">
        <a class="su-link" href="https://www.ebay.fr/itm/377035127834?_skw=casque&hash=abc">
          <span class="s-card__title"><span class="su-styled-text">Casque Sport Sans Fil Conduction Osseuse</span></span>
        </a>
      </div>
      <div class="su-card-container__attributes">
        <div class="s-card__attribute-row"><span class="s-card__price su-styled-text">65,00 EUR</span></div>
        <div class="s-card__attribute-row"><span class="su-styled-text">Achat immédiat</span></div>
        <div class="s-card__attribute-row"><span class="su-styled-text">+7,99 EUR pour la livraison</span></div>
      </div>
    </div>
  </li>
  <li class="s-card">
    <div class="su-card-container">
      <div class="su-card-container__header">
        <a class="su-link" href="https://www.ebay.fr/itm/196698125453">
          <span class="s-card__title">Casque tour de cou <span class="clipped">La page s'ouvre dans une nouvelle fenêtre</span></span>
        </a>
      </div>
      <div class="s-card__attribute-row"><span class="s-card__price">5,50 EUR</span></div>
    </div>
  </li>
  <li class="s-card">
    <!-- Placeholder sans lien /itm/ : doit être ignoré -->
    <a class="su-link" href="https://www.ebay.fr/sch/i.html?_nkw=autre">
      <span class="s-card__title">Shop on eBay</span>
    </a>
    <span class="s-card__price">20,00 EUR</span>
  </li>
  <li class="s-card">
    <!-- Sans prix affiché : doit être ignoré -->
    <a class="su-link" href="https://www.ebay.fr/itm/111111111111">
      <span class="s-card__title">Annonce sans prix</span>
    </a>
  </li>
</ul>
"""

# Ancien markup (li.s-item), encore servi sur certaines pages
OLD_MARKUP = """
<ul class="srp-results">
  <li class="s-item">
    <a class="s-item__link" href="https://www.ebay.fr/itm/203002148304?hash=xyz">lien</a>
    <div class="s-item__title">Nouvelle annonce Oreillette Bluetooth Pro</div>
    <span class="s-item__price">35,27 EUR</span>
    <span class="s-item__shipping">Livraison gratuite</span>
  </li>
</ul>
"""


def test_parse_new_markup():
    results = parse_search_page(NEW_MARKUP, max_results=10)
    assert len(results) == 2
    first = results[0]
    assert first.title == "Casque Sport Sans Fil Conduction Osseuse"
    assert first.price_raw == "65,00 EUR"
    assert first.url == "https://www.ebay.fr/itm/377035127834"  # URL canonique sans tracking
    assert "livraison" in first.delivery_raw.lower()


def test_accessibility_text_stripped_from_title():
    results = parse_search_page(NEW_MARKUP, max_results=10)
    assert results[1].title == "Casque tour de cou"
    assert results[1].url == "https://www.ebay.fr/itm/196698125453"


def test_placeholder_and_priceless_items_skipped():
    results = parse_search_page(NEW_MARKUP, max_results=10)
    titles = [r.title.lower() for r in results]
    assert "shop on ebay" not in titles
    assert "annonce sans prix" not in titles


def test_parse_old_markup():
    results = parse_search_page(OLD_MARKUP, max_results=10)
    assert len(results) == 1
    assert results[0].title == "Oreillette Bluetooth Pro"  # préfixe "Nouvelle annonce" retiré
    assert results[0].url == "https://www.ebay.fr/itm/203002148304"


def test_max_results_cap():
    results = parse_search_page(NEW_MARKUP, max_results=1)
    assert len(results) == 1
