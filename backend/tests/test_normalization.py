from src.connectors.base import ProductRaw
from src.normalization.engine import NormalizationEngine


def _raw(price_raw: str, delivery_raw: str = "", reviews_raw: str = "", url: str = "https://www.amazon.fr/dp/B000TEST00"):
    return ProductRaw(
        title="Produit test",
        price_raw=price_raw,
        delivery_raw=delivery_raw,
        seller="Vendeur",
        reviews_raw=reviews_raw,
        url=url,
        extra={"rating_raw": "4,5 sur 5 étoiles"},
    )


def test_parse_simple_price():
    product = NormalizationEngine().normalize(_raw("29,99 €"))
    assert product.total_price == 29.99


def test_parse_price_with_spaces():
    product = NormalizationEngine().normalize(_raw("1 234,56 €"))
    assert product.total_price == 1234.56


def test_parse_delivery_days():
    product = NormalizationEngine().normalize(_raw("19,99 €", delivery_raw="livraison sous 3 jours"))
    assert product.delivery_days == 3


def test_parse_rating():
    product = NormalizationEngine().normalize(_raw("19,99 €"))
    assert product.rating == 4.5


def test_site_domain_from_url():
    product = NormalizationEngine().normalize(_raw("19,99 €"))
    assert product.site_domain == "amazon.fr"


def test_unparseable_price_is_zero():
    product = NormalizationEngine().normalize(_raw("prix indisponible"))
    assert product.total_price == 0.0


def test_parse_price_ebay_format():
    product = NormalizationEngine().normalize(_raw("65,00 EUR"))
    assert product.total_price == 65.0


def test_parse_price_eu_thousands_dot():
    product = NormalizationEngine().normalize(_raw("1.234,56 €"))
    assert product.total_price == 1234.56


def test_parse_price_en_format():
    product = NormalizationEngine().normalize(_raw("$1,234.56"))
    assert product.total_price == 1234.56


def test_parse_price_does_not_merge_two_prices():
    """Régression : "12,34 EUR à 25,00 EUR" fusionnait en 12342500."""
    product = NormalizationEngine().normalize(_raw("12,34 EUR à 25,00 EUR"))
    assert product.total_price == 12.34


def test_parse_price_narrow_nbsp_thousands():
    product = NormalizationEngine().normalize(_raw("1 234 567,89 €"))
    assert product.total_price == 1234567.89


def test_parse_price_plain_decimal_dot():
    product = NormalizationEngine().normalize(_raw("29.99"))
    assert product.total_price == 29.99
