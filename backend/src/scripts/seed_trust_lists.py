from sqlmodel import Session

from ..db import engine
from ..models import SiteReputation

SITES = [
    {"domain": "amazon.fr", "trust_score": 95, "classification": "white", "https_valid": True, "domain_age_days": 3650, "has_legal_mentions": True},
    {"domain": "cdiscount.com", "trust_score": 85, "classification": "white", "https_valid": True, "domain_age_days": 2920, "has_legal_mentions": True},
    {"domain": "etsy.com", "trust_score": 90, "classification": "white", "https_valid": True, "domain_age_days": 4015, "has_legal_mentions": True},
    {"domain": "shein.com", "trust_score": 65, "classification": "grey", "https_valid": True, "domain_age_days": 1825, "has_legal_mentions": False},
    {"domain": "aliexpress.com", "trust_score": 70, "classification": "grey", "https_valid": True, "domain_age_days": 3650, "has_legal_mentions": True},
    {"domain": "ebay.fr", "trust_score": 88, "classification": "white", "https_valid": True, "domain_age_days": 4015, "has_legal_mentions": True},
    {"domain": "temu.com", "trust_score": 55, "classification": "grey", "https_valid": True, "domain_age_days": 730, "has_legal_mentions": False},
    {"domain": "vinted.fr", "trust_score": 80, "classification": "white", "https_valid": True, "domain_age_days": 4380, "has_legal_mentions": True},
]


def seed_trust_lists():
    with Session(engine) as session:
        for site in SITES:
            existing = session.get(SiteReputation, site["domain"])
            if not existing:
                session.add(SiteReputation(**site))
        session.commit()


if __name__ == "__main__":
    seed_trust_lists()