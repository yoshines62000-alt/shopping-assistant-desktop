"""Point d'entree du backend pour le packaging PyInstaller.

uvicorn est lance par objet `app` (pas par chaine "src.main:app") et SANS
--reload : un seul process, pas de multiprocessing -> compatible avec un .exe
gele. Le port vient de --port (passe par Electron) ou de la variable PORT.
"""

import multiprocessing
import os
import sys


def _parse_port(default: int = 8756) -> int:
    if "--port" in sys.argv:
        try:
            return int(sys.argv[sys.argv.index("--port") + 1])
        except (IndexError, ValueError):
            pass
    try:
        return int(os.environ.get("PORT", default))
    except ValueError:
        return default


def main() -> None:
    # Indispensable pour un binaire gele sous Windows si du multiprocessing
    # devait etre declenche quelque part.
    multiprocessing.freeze_support()

    import uvicorn

    from src.main import app

    # 127.0.0.1 par défaut (desktop seul). BACKEND_HOST=0.0.0.0 expose le backend
    # sur le réseau local pour que l'app mobile (téléphone) puisse l'atteindre.
    host = os.environ.get("BACKEND_HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=_parse_port(), log_level="info")


if __name__ == "__main__":
    main()
