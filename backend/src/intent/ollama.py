import json
import requests
from ..config import get_settings

settings = get_settings()
OLLAMA_HOST = settings.ollama_host
OLLAMA_MODEL = settings.ollama_model


def parse_intent_with_ollama(query: str) -> dict:
    system_prompt = """You are the intent parser for a product search engine.
Extract structured search parameters from the user's natural language query.

Output ONLY valid JSON matching this exact schema:
{
  "query": "normalized product category and description",
  "minPriceEur": number or null,
  "maxPriceEur": number or null,
  "maxDeliveryDays": number or null,
  "minRating": number or null,
  "priority": "price" | "quality" | "speed" | "balanced",
  "weights": {"price": 0.4, "delivery": 0.2, "reviews": 0.2, "site": 0.1, "popularity": 0.1},
  "keywords": ["important", "attributes"],
  "excludeKeywords": ["unwanted", "terms"]
}

RULES:
- If user mentions price priority (pas cher, moins cher, économique, budget serré), set priority=price and weights.price >= 0.50
- If user mentions quality (qualité, meilleur, fiable, premium), set priority=quality and boost weights.reviews and weights.site
- If user mentions speed (rapide, vite, urgent), set priority=speed and weights.delivery >= 0.45
- Extract minPriceEur/maxPriceEur from any budget mention; convert EUR to floats (20€ => 20.0)
- Extract minRating from "4 étoiles", "5 étoiles", "note 4", etc.
- Extract maxDeliveryDays from delivery mentions (une semaine => 7, 3 jours => 3)
- Keywords must be lowercase product attributes
- NEVER include markdown fences or explanations"""

    try:
        response = requests.post(
            f"{OLLAMA_HOST}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.05, "num_predict": 300},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query},
                ],
            },
            timeout=8,
        )
        response.raise_for_status()
        raw = response.json().get("message", {}).get("content", "{}")
        parsed = json.loads(raw)
        return {
            "query": parsed.get("query", query),
            "minPriceEur": parsed.get("minPriceEur"),
            "maxPriceEur": parsed.get("maxPriceEur"),
            "maxDeliveryDays": parsed.get("maxDeliveryDays"),
            "minRating": parsed.get("minRating"),
            "priority": parsed.get("priority", "balanced"),
            "weights": {
                "price": float(parsed.get("weights", {}).get("price", 0.4)),
                "delivery": float(parsed.get("weights", {}).get("delivery", 0.2)),
                "reviews": float(parsed.get("weights", {}).get("reviews", 0.2)),
                "site": float(parsed.get("weights", {}).get("site", 0.1)),
                "popularity": float(parsed.get("weights", {}).get("popularity", 0.1)),
            },
            "keywords": parsed.get("keywords", []),
            "excludeKeywords": parsed.get("excludeKeywords", []),
        }
    except Exception as exc:
        print(f"[ollama] fallback to keyword extraction: {exc}")
        return _fallback_intent(query)


def _fallback_intent(query: str) -> dict:
    import re

    lower = query.lower()

    def _parse_price(value: str) -> float | None:
        try:
            parsed = float(value.replace(",", "."))
        except (TypeError, ValueError):
            return None
        return parsed if parsed >= 0 else None

    min_price = None
    min_match = re.search(
        r"(?:à partir de|min(?:imum)?\s*(?:de)?|minimum)\s*(\d+(?:[.,]\d+)?)\s*€?",
        lower,
    )
    if min_match:
        min_price = _parse_price(min_match.group(1))

    max_price = None
    max_match = re.search(
        r"(?:max(?:imum)?\s*(?:de)?|moins de|pas plus de|inférieur\s*(?:à|au)\s*)\s*(\d+(?:[.,]\d+)?)\s*€?",
        lower,
    )
    if max_match:
        max_price = _parse_price(max_match.group(1))

    if max_price is None:
        max_match = re.search(
            r"(\d+(?:[.,]\d+)?)\s*€?\s*(?:max(?:imum)?|ou moins)$",
            lower,
        )
        if max_match:
            max_price = _parse_price(max_match.group(1))

    if min_price is None or max_price is None:
        range_match = re.search(r"(\d+(?:[.,]\d+)?)\s*€?\s*(?:et|à|a)\s*(\d+(?:[.,]\d+)?)\s*€?", lower)
        if range_match:
            parsed_prices = [parsed for amount in range_match.groups() if (parsed := _parse_price(amount)) is not None]
            if len(parsed_prices) == 2:
                min_price = min(parsed_prices)
                max_price = max(parsed_prices)

        price_matches = re.findall(r"(\d+(?:[.,]\d+)?)\s*€", lower)
        if len(price_matches) >= 2:
            parsed_prices = [parsed for amount in price_matches if (parsed := _parse_price(amount)) is not None]
            if parsed_prices:
                min_price = min(parsed_prices)
                max_price = max(parsed_prices)
        elif price_matches:
            parsed = _parse_price(price_matches[0])
            if parsed is not None:
                max_price = parsed

    if min_price is not None and max_price is not None and min_price > max_price:
        min_price, max_price = max_price, min_price

    min_rating = None
    rating_match = re.search(
        r"(?:note|min(?:imum)?|au moins)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:étoiles?|/5)?",
        lower,
    )
    if rating_match:
        try:
            min_rating = float(rating_match.group(1).replace(",", "."))
        except ValueError:
            min_rating = None
        if min_rating is not None and min_rating > 5:
            min_rating = 5

    max_delivery_days = None
    delivery_match = re.search(
        r"(?:sous|en|livraison|délai(?:\s*max(?:imum)?)?)\s*(?:\d+\s*)?(\d+)\s*(?:jours?|j\b|business days?|day)",
        lower,
    )
    if delivery_match:
        max_delivery_days = int(delivery_match.group(1))

    is_price = any(w in lower for w in ["pas cher", "moins cher", "économique", "budget", "prix"])
    is_quality = any(w in lower for w in ["qualité", "meilleur", "fiable", "premium"])
    is_speed = any(w in lower for w in ["rapide", "vite", "urgent", "livraison"])
    priority = "price" if is_price else "quality" if is_quality else "speed" if is_speed else "balanced"
    weights = {"price": 0.4, "delivery": 0.2, "reviews": 0.2, "site": 0.1, "popularity": 0.1}
    if priority == "price":
        weights = {"price": 0.6, "delivery": 0.15, "reviews": 0.1, "site": 0.1, "popularity": 0.05}
    elif priority == "quality":
        weights = {"price": 0.2, "delivery": 0.15, "reviews": 0.35, "site": 0.2, "popularity": 0.1}
    elif priority == "speed":
        weights = {"price": 0.2, "delivery": 0.45, "reviews": 0.15, "site": 0.1, "popularity": 0.1}
    return {
        "query": query,
        "minPriceEur": min_price,
        "maxPriceEur": max_price,
        "maxDeliveryDays": max_delivery_days,
        "minRating": min_rating,
        "priority": priority,
        "weights": weights,
        "keywords": [],
        "excludeKeywords": [],
    }
