-- Les types d'événements évoluent avec les parcours métier.
-- VARCHAR évite qu'un nouvel événement valide soit rejeté par un ancien ENUM.
ALTER TABLE request_events
  MODIFY COLUMN type VARCHAR(64) NOT NULL;
