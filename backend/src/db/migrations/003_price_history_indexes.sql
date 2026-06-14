-- Migration 003: index sur l'historique des prix.
-- pricehistory grossit a chaque recherche. Ces index evitent les balayages
-- complets sur les requetes chaudes.
--   (product_id, observed_at DESC) sert la fiche produit, l'historique,
--   l'ingestion et la sous-requete "prix precedent" du digest.
--   (observed_at DESC) sert le balayage par fenetre temporelle du digest.
CREATE INDEX IF NOT EXISTS idx_pricehistory_product_observed
    ON pricehistory (product_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricehistory_observed
    ON pricehistory (observed_at DESC);
