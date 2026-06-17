import re
import logging
from collections.abc import Iterable
from typing import Any
from .models import ProductNormalized
from ..connectors.base import ProductRaw

logger = logging.getLogger("normalization")

class NormalizationEngine:
    def normalize(self, raw: ProductRaw) -> ProductNormalized:
        value = self._parse_price(raw.price_raw or "")

        delivery_days = self._extract_delivery_days(raw.delivery_raw)
        reviews_count = self._extract_reviews_count(raw.reviews_raw)
        rating = self._extract_rating(raw.extra.get("rating_raw", "") if raw.extra else "")
        site_domain = self._extract_site_domain(raw.url, raw.extra)
        image_url = self._clean_image_url(raw.extra.get("image_url") if raw.extra else None)

        return ProductNormalized(
            name=raw.title,
            total_price=round(value, 2),
            currency="EUR",
            rating=rating,
            review_count=reviews_count,
            delivery_days=delivery_days,
            site_domain=site_domain,
            source_url=raw.url,
            seller=raw.seller,
            image_url=image_url,
            in_stock=True,
            raw=raw.__dict__,
        )

    def normalize_many(self, items: Iterable[ProductRaw]) -> list[ProductNormalized]:
        out: list[ProductNormalized] = []
        for raw in items:
            try:
                out.append(self.normalize(raw))
            except Exception as exc:
                logger.warning("Normalization failed for %s: %s", raw.title, exc)
        return out

    @staticmethod
    def _parse_price(text: str) -> float:
        """Extrait le premier prix d'un texte, formats FR et EN.

        Gère "29,99 €", "1 234,56 €", "1.234,56 €", "$1,234.56", "29.99",
        sans fusionner deux prix distincts ("12,34 EUR à 25,00 EUR" → 12.34).
        """
        cleaned = text.replace(" ", " ").replace(" ", " ")
        m = re.search(r"\d[\d ,.]*", cleaned)
        if not m:
            return 0.0
        token = m.group(0).strip().strip(".,")

        # Espaces : séparateurs de milliers uniquement si groupes de 3 chiffres
        chunks = token.split(" ")
        merged = chunks[0]
        for chunk in chunks[1:]:
            if re.fullmatch(r"\d{3}(?:[.,]\d{1,2})?", chunk) and not re.search(r"[.,]\d{1,2}$", merged):
                merged += chunk
            else:
                break  # autre nombre dans le texte, pas un groupe de milliers
        token = merged

        if "," in token and "." in token:
            # Le séparateur le plus à droite est le décimal
            if token.rfind(",") > token.rfind("."):
                token = token.replace(".", "").replace(",", ".")
            else:
                token = token.replace(",", "")
        elif "," in token:
            head, *rest = token.split(",")
            if rest and all(len(p) == 3 for p in rest):
                token = head + "".join(rest)  # "1,234" → milliers (format EN)
            else:
                token = head + "." + "".join(rest)  # virgule décimale (FR)
        elif "." in token:
            head, *rest = token.split(".")
            if len(rest) > 1 or (rest and len(rest[0]) == 3 and len(head) <= 3 and head != "0"):
                token = head + "".join(rest)  # "1.234" → milliers (format EU)
            else:
                token = head + "." + "".join(rest)

        try:
            value = float(token)
        except ValueError:
            return 0.0
        return round(value, 2) if value > 0 else 0.0

    @staticmethod
    def _extract_delivery_days(text: str) -> int | None:
        text = (text or "").lower()
        m = re.search(r"(\d+)\s*(?:jours?|j\b|business days?|day)", text)
        if not m:
            return None
        return int(m.group(1))

    @staticmethod
    def _extract_reviews_count(text: str) -> int | None:
        # Capture le premier nombre avec ses separateurs de milliers (espace,
        # virgule, point) puis les retire : "1,234 avis" -> 1234 (et non 1).
        m = re.search(r"\d[\d.,\s]*", text or "")
        if not m:
            return None
        digits = re.sub(r"\D", "", m.group(0))
        return int(digits) if digits else None

    @staticmethod
    def _extract_rating(text: str) -> float | None:
        m = re.search(r"(\d+(?:[.,]\d+)?)", text.replace(",", "."))
        if not m:
            return None
        value = float(m.group(1))
        return value if value <= 5 else None

    @staticmethod
    def _clean_image_url(url: Any) -> str | None:
        """N'accepte qu'une URL http(s) d'image (sécurité : pas de data:/javascript:)."""
        if not isinstance(url, str):
            return None
        url = url.strip()
        return url if url.startswith("http") else None

    @staticmethod
    def _extract_site_domain(url: str, extra: dict[str, Any] | None) -> str:
        if extra and extra.get("site"):
            return extra["site"]
        # Security: only accept http/https URLs, reject javascript: and other schemes
        m = re.search(r"^https?://[^/]+", url or "")
        if not m:
            return "invalid"
        m = re.search(r"https?://(?:www\.)?([^/]+)", url or "")
        return m.group(1) if m else "unknown"
