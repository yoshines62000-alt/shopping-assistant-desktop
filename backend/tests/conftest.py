import os

# Doit être défini avant tout import de src.* : désactive la boucle de fond
# (alertes/ré-estimation) qui lancerait des navigateurs pendant les tests.
os.environ["BACKGROUND_TASKS_ENABLED"] = "false"
