"""Résolution d'un code-barres (EAN/UPC) vers un nom de produit.

Permet au scan en brocante de donner une vraie estimation : on traduit le
numéro EAN affiché sur l'objet en libellé produit avant de chercher les ventes
réussies sur eBay (chercher le numéro brut ne renvoie quasiment rien).

Sources gratuites sans clé : UPCitemdb (offre d'essai, produits généraux) puis
OpenFoodFacts en repli. En cas d'échec, on renvoie None et l'appelant retombe
sur le texte d'origine.
"""

import logging
import re

import requests

logger = logging.getLogger("barcode")

_BARCODE_RE = re.compile(r"^\d{8,14}$")


def is_barcode(text: str) -> bool:
    """Vrai si la chaîne ressemble à un code EAN/UPC (8 à 14 chiffres)."""
    return bool(_BARCODE_RE.match((text or "").strip()))


def _from_upcitemdb(code: str) -> str | None:
    resp = requests.get(
        "https://api.upcitemdb.com/prod/trial/lookup",
        params={"upc": code},
        timeout=6,
    )
    if resp.status_code != 200:
        return None
    items = resp.json().get("items") or []
    if items:
        return (items[0].get("title") or "").strip() or None
    return None


def _from_openfoodfacts(code: str) -> str | None:
    resp = requests.get(
        f"https://world.openfoodfacts.org/api/v0/product/{code}.json",
        timeout=6,
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    if data.get("status") != 1:
        return None
    product = data.get("product", {})
    name = (product.get("product_name") or product.get("generic_name") or "").strip()
    if not name:
        return None
    brand = (product.get("brands") or "").split(",")[0].strip()
    if brand and brand.lower() not in name.lower():
        return f"{brand} {name}"
    return name


def resolve_barcode(code: str) -> str | None:
    """Nom de produit pour un code-barres, ou None si introuvable."""
    code = (code or "").strip()
    if not is_barcode(code):
        return None
    for source in (_from_upcitemdb, _from_openfoodfacts):
        try:
            name = source(code)
        except Exception as exc:
            logger.warning("Résolution code-barres via %s échouée : %s", source.__name__, exc)
            continue
        if name:
            logger.info("Code-barres %s -> %s (%s)", code, name, source.__name__)
            return name
    logger.info("Code-barres %s non résolu", code)
    return None
