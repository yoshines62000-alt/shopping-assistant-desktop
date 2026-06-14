from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

DEFAULT_WEIGHTS = {
    "price": 0.40,
    "delivery": 0.20,
    "reviews": 0.20,
    "site": 0.10,
    "popularity": 0.10,
}


@dataclass(frozen=True)
class ScoringWeights:
    price: float = DEFAULT_WEIGHTS["price"]
    delivery: float = DEFAULT_WEIGHTS["delivery"]
    reviews: float = DEFAULT_WEIGHTS["reviews"]
    site: float = DEFAULT_WEIGHTS["site"]
    popularity: float = DEFAULT_WEIGHTS["popularity"]

    def normalized(self) -> dict[str, float]:
        s = self.price + self.delivery + self.reviews + self.site + self.popularity
        return {k: getattr(self, k) / s for k in DEFAULT_WEIGHTS}


@dataclass(frozen=True)
class ProductScore:
    price: float
    delivery: float
    reviews: float
    site: float
    popularity: float
    final: float


class ScoringEngine:
    def score_many(self, products: Iterable[dict], weights: ScoringWeights | None = None) -> list[ProductScore]:
        items = list(products)
        if not items:
            return []

        w = (weights or ScoringWeights()).normalized()

        def _vals(key: str):
            return [p[key] for p in items if p.get(key) is not None]

        def _min_max(key: str):
            vals = _vals(key)
            if not vals:
                return None, None
            return min(vals), max(vals)

        p_min, p_max = _min_max("total_price")
        d_min, d_max = _min_max("delivery_days")
        r_min, r_max = _min_max("rating")
        rc_min, rc_max = _min_max("review_count")

        results: list[ProductScore] = []
        for p in items:
            price = self._norm(p.get("total_price"), p_min, p_max, lower_better=True)
            delivery = self._norm(p.get("delivery_days"), d_min, d_max, lower_better=True)
            reviews = self._norm(p.get("rating"), r_min, r_max)
            site_value = p.get("site_reputation")
            site = float(site_value) if site_value is not None else 40.0
            popularity = self._norm(p.get("review_count"), rc_min, rc_max)

            # Sponsored penalty : reduce score by 25% for sponsored listings.
            # Le flag vient des connecteurs via ProductRaw.extra (pipeline réel),
            # mais on accepte aussi raw["sponsored"] pour les payloads à plat.
            raw = p.get("raw", {})
            is_sponsored = False
            if isinstance(raw, dict):
                extra = raw.get("extra")
                is_sponsored = bool(raw.get("sponsored")) or (
                    isinstance(extra, dict) and bool(extra.get("sponsored"))
                )
            sponsored_penalty = 0.75 if is_sponsored else 1.0

            final = sum(
                v * w[k]
                for k, v in {
                    "price": price,
                    "delivery": delivery,
                    "reviews": reviews,
                    "site": site,
                    "popularity": popularity,
                }.items()
            ) * sponsored_penalty
            results.append(ProductScore(price, delivery, reviews, site, popularity, round(final, 2)))
        return results

    @staticmethod
    def _norm(value, mn, mx, lower_better: bool = False) -> float:
        if value is None or mn is None or mx is None or mx == mn:
            return 50.0
        if lower_better:
            return 100.0 * (mx - value) / (mx - mn)
        return 100.0 * (value - mn) / (mx - mn)
