from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone


def utcnow_naive() -> datetime:
    """UTC naïf : remplace datetime.utcnow() (déprécié) pour les colonnes TIMESTAMP."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PriceHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: str = Field(index=True)
    price: float
    connector: str
    observed_at: datetime = Field(default_factory=utcnow_naive)


class Alert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(default="me")
    product_id: str = Field(index=True)
    threshold_price: float
    channels: str = Field(default="email")
    active: bool = Field(default=True)
    triggered_at: Optional[datetime] = None  # date de déclenchement (alerte désactivée ensuite)
    created_at: datetime = Field(default_factory=utcnow_naive)


class Expense(SQLModel, table=True):
    """Dépense annexe (emballage, essence, abonnement...) pour la compta nette."""

    id: Optional[int] = Field(default=None, primary_key=True)
    label: str
    amount: float
    category: str = Field(default="autre")
    expense_date: datetime = Field(default_factory=utcnow_naive)


class AppSetting(SQLModel, table=True):
    """Réglages applicatifs (JSON) : frais par plateforme, webhook Discord..."""

    key: str = Field(primary_key=True)
    value: str = Field(default="{}")


class ProductRef(SQLModel, table=True):
    """Référence produit : relie l'ID haché (sha256 de l'URL) à l'offre d'origine.

    Permet aux alertes et à l'historique de retrouver l'URL à re-scraper.
    """

    product_id: str = Field(primary_key=True)
    source_url: str
    name: str = Field(default="")
    site_domain: str = Field(default="")
    updated_at: datetime = Field(default_factory=utcnow_naive)


class StockItem(SQLModel, table=True):
    """Objet acheté (saisi manuellement) en vue d'une revente."""

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    purchase_price: float  # prix d'achat unitaire
    quantity: int = Field(default=1)
    remaining: int = Field(default=1)  # restant en stock (décrémenté à la vente)
    purchase_date: datetime = Field(default_factory=utcnow_naive)
    source_url: str = Field(default="")
    estimated_resale: Optional[float] = None  # estimation de revente unitaire
    previous_estimate: Optional[float] = None  # estimation précédente (tendance ↗↘)
    estimated_at: Optional[datetime] = None  # date de la dernière estimation
    status: str = Field(default="in_stock")  # in_stock | listed | sold
    notes: str = Field(default="")
    created_at: datetime = Field(default_factory=utcnow_naive)


class Sale(SQLModel, table=True):
    """Vente (totale ou partielle) d'un objet du stock."""

    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(index=True, foreign_key="stockitem.id")
    item_name: str = Field(default="")  # dénormalisé pour l'affichage compta
    quantity: int = Field(default=1)
    unit_price: float
    fees: float = Field(default=0.0)  # frais plateforme + livraison à charge
    platform: str = Field(default="")
    sale_date: datetime = Field(default_factory=utcnow_naive)


class SiteReputation(SQLModel, table=True):
    domain: str = Field(primary_key=True)
    trust_score: int = Field(default=50)
    classification: str = Field(default="grey")
    https_valid: bool = Field(default=False)
    domain_age_days: Optional[int] = None
    has_legal_mentions: bool = Field(default=False)
    last_checked: datetime = Field(default_factory=utcnow_naive)
    captcha_encounters: int = Field(default=0)
