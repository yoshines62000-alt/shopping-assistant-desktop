from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

@dataclass
class ProductRaw:
    title: str
    price_raw: str
    delivery_raw: str
    seller: str
    reviews_raw: str
    url: str
    extra: dict[str, Any] | None = None

class BaseConnector(ABC):
    site_key: str = "base"
    base_url: str = ""

    @abstractmethod
    def search(self, query: str, max_results: int = 20) -> list[ProductRaw]:
        raise NotImplementedError
