"""Detection des pages anti-bot / captcha.

Probleme : une page de blocage (captcha Amazon, DataDome, Cloudflare, Akamai...)
revient en HTTP 200. Sans ce controle, le parser extrait 0 produit et l'echec
passe totalement inapercu -- indiscernable d'une recherche reellement vide.

`detect_block(html)` renvoie une raison courte si la page ressemble a un blocage,
sinon None. On retient uniquement des signatures TRES specifiques aux pages de
blocage (jamais presentes sur une page de resultats normale) pour eviter les
faux positifs.
"""

# (signature en minuscules, libelle renvoye)
_SIGNATURES: list[tuple[str, str]] = [
    # Amazon : page "robot check" / captcha
    ("validatecaptcha", "captcha Amazon"),
    ("api-services-support@amazon.com", "robot check Amazon"),
    ("saisissez les caracteres que vous voyez", "captcha Amazon"),
    ("type the characters you see", "captcha Amazon"),
    ("enter the characters you see below", "captcha Amazon"),
    # DataDome (Vinted, etc.) : seul le host du captcha n'apparait que sur un blocage
    ("captcha-delivery.com", "DataDome"),
    # Cloudflare : page de challenge
    ("checking your browser before accessing", "Cloudflare"),
    ("attention required! | cloudflare", "Cloudflare"),
    ("cf-browser-verification", "Cloudflare"),
    # Imperva / Incapsula
    ("pardon our interruption", "Imperva"),
    # PerimeterX
    ("access to this page has been denied", "PerimeterX"),
    ("px-captcha", "PerimeterX"),
    # Akamai / serveur : page "Access Denied"
    ("you don't have permission to access", "Access Denied"),
    # Generique
    ("unusual traffic", "trafic inhabituel"),
]


def detect_block(html: str | None) -> str | None:
    """Renvoie le type de blocage detecte, ou None si la page semble normale."""
    if not html:
        return None
    low = html.lower()
    for signature, label in _SIGNATURES:
        if signature in low:
            return label
    return None
