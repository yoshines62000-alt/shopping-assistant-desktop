"""Navigateur Chromium headless partagé et persistant.

L'API sync de Playwright est liée au thread qui l'a créée : chaque thread du
pool de connecteurs garde donc sa propre instance (playwright + browser +
contextes par profil) réutilisée entre les recherches. Gain : ~2-4 s de
lancement économisés par fetch, et les cookies par profil (eBay) évitent le
warmup par la page d'accueil après la première visite.
"""

import atexit
import logging
import threading

from playwright.sync_api import sync_playwright
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from ..config import get_settings

logger = logging.getLogger("connectors.browser")

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

_user_agent_idx = 0
_user_agent_lock = threading.Lock()

# Ressources inutiles au parsing : les bloquer accélère nettement le chargement
BLOCKED_RESOURCE_TYPES = {"image", "media", "font"}

_local = threading.local()
_instances_lock = threading.Lock()
_instances: list[object] = []  # toutes les sessions créées, pour le nettoyage final


def _next_user_agent() -> str:
    global _user_agent_idx
    with _user_agent_lock:
        ua = USER_AGENTS[_user_agent_idx % len(USER_AGENTS)]
        _user_agent_idx += 1
        return ua


proxy_idx = 0
proxy_lock = threading.Lock()


def _next_proxy() -> str | None:
    settings = get_settings()
    if not settings.proxy_list:
        return None
    global proxy_idx
    with proxy_lock:
        proxy = settings.proxy_list[proxy_idx % len(settings.proxy_list)]
        proxy_idx += 1
        return proxy


class _BrowserSession:
    """Playwright + Chromium + contextes nommés, propres à un thread."""

    def __init__(self) -> None:
        self.playwright = sync_playwright().start()
        proxy = _next_proxy()
        launch_args = ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        self.browser = self.playwright.chromium.launch(
            headless=True,
            args=launch_args,
            proxy={"server": proxy} if proxy else None,
        )
        self.contexts: dict[str, object] = {}
        self.warmed_up: set[str] = set()

    def context(self, profile: str):
        ctx = self.contexts.get(profile)
        if ctx is None:
            ua = _next_user_agent()
            ctx = self.browser.new_context(
                user_agent=ua,
                locale="fr-FR",
                timezone_id="Europe/Paris",
                viewport={"width": 1366, "height": 900},
                extra_http_headers={"Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5"},
            )
            ctx.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
            self.contexts[profile] = ctx
        return ctx

    def close(self) -> None:
        try:
            self.browser.close()
        except Exception:
            pass
        try:
            self.playwright.stop()
        except Exception:
            pass


def _get_session() -> _BrowserSession:
    session = getattr(_local, "session", None)
    if session is None:
        session = _BrowserSession()
        _local.session = session
        with _instances_lock:
            _instances.append(session)
        logger.info("Nouvelle session navigateur pour %s", threading.current_thread().name)
    return session


def _drop_session() -> None:
    session = getattr(_local, "session", None)
    if session is not None:
        session.close()
        with _instances_lock:
            if session in _instances:
                _instances.remove(session)
        _local.session = None


@atexit.register
def _cleanup() -> None:
    with _instances_lock:
        for session in _instances:
            session.close()
        _instances.clear()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _fetch(
    url: str,
    wait_selector: str | None,
    timeout_ms: int,
    warmup_url: str | None,
    profile: str,
) -> str:
    session = _get_session()
    context = session.context(profile)
    page = context.new_page()
    page.route(
        "**/*",
        lambda route: route.abort()
        if route.request.resource_type in BLOCKED_RESOURCE_TYPES
        else route.continue_(),
    )
    try:
        # Warmup une seule fois par profil : les cookies persistent ensuite
        if warmup_url and profile not in session.warmed_up:
            page.goto(warmup_url, wait_until="domcontentloaded", timeout=timeout_ms)
            page.wait_for_timeout(1500)
            session.warmed_up.add(profile)
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        if wait_selector:
            try:
                page.wait_for_selector(wait_selector, timeout=8000)
            except Exception:
                logger.debug("Selector '%s' never appeared on %s", wait_selector, url)
        else:
            page.wait_for_timeout(1500)
        return page.content()
    finally:
        page.close()


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _evaluate_fetch(api_url: str, warmup_url: str, profile: str, timeout_ms: int) -> str | None:
    session = _get_session()
    context = session.context(profile)
    page = context.new_page()
    try:
        # Le challenge anti-bot (Datadome...) est résolu par la vraie page ;
        # le fetch est ensuite émis depuis le contexte authentifié.
        if profile not in session.warmed_up:
            page.goto(warmup_url, wait_until="domcontentloaded", timeout=timeout_ms)
            page.wait_for_timeout(3000)
            session.warmed_up.add(profile)
        elif page.url == "about:blank":
            page.goto(warmup_url, wait_until="domcontentloaded", timeout=timeout_ms)
            page.wait_for_timeout(500)
        result = page.evaluate(
            """async (url) => {
                const r = await fetch(url, { headers: { Accept: 'application/json' } });
                return { status: r.status, body: await r.text() };
            }""",
            api_url,
        )
        if result["status"] != 200:
            logger.warning("API fetch %s -> %s", api_url, result["status"])
            return None
        return result["body"]
    finally:
        page.close()


def fetch_json_via_page(
    api_url: str,
    warmup_url: str,
    profile: str,
    timeout_ms: int = 25000,
) -> str | None:
    """Appelle une API JSON depuis le contexte d'une vraie page du site.

    Contourne les protections qui bloquent les clients HTTP directs (Vinted).
    Retourne le corps JSON brut, ou None en cas d'échec (avec un retry après
    recyclage de session, comme fetch_page_html).
    """
    try:
        return _evaluate_fetch(api_url, warmup_url, profile, timeout_ms)
    except Exception as exc:
        logger.warning("Session navigateur recyclée après erreur : %s", exc)
        _drop_session()
        return _evaluate_fetch(api_url, warmup_url, profile, timeout_ms)


def fetch_page_html(
    url: str,
    wait_selector: str | None = None,
    timeout_ms: int = 25000,
    warmup_url: str | None = None,
    profile: str = "default",
) -> str:
    """Charge une page dans un Chromium persistant et retourne son HTML rendu.

    `profile` isole les cookies par site (ex. "ebay") ; `warmup_url` n'est
    visitée qu'à la première utilisation du profil. En cas d'erreur (navigateur
    mort, contexte périmé), la session du thread est recyclée et un second
    essai est tenté.
    """
    try:
        return _fetch(url, wait_selector, timeout_ms, warmup_url, profile)
    except Exception as exc:
        logger.warning("Session navigateur recyclée après erreur : %s", exc)
        _drop_session()
        return _fetch(url, wait_selector, timeout_ms, warmup_url, profile)
