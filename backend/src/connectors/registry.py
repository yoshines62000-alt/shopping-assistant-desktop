from .base import BaseConnector
from .amazon import AmazonConnector
from .ebay import EbayConnector
from .vinted import VintedConnector
from .leboncoin import LeboncoinConnector

# Uniquement des sources réelles : chaque résultat doit pointer vers la page
# produit exacte du site marchand. Aucun connecteur de données factices.
CONNECTORS: list[type[BaseConnector]] = [
    AmazonConnector,     # amazon.fr via Playwright (rendu JS requis)
    EbayConnector,       # ebay.fr via Playwright + BeautifulSoup
    VintedConnector,     # vinted.fr via API catalogue (contexte navigateur)
    LeboncoinConnector,  # leboncoin.fr via __NEXT_DATA__ (DataDome : best-effort)
]
