-- Migration: suppression du modèle Client, ajout lastHeartbeat, dureePrevu requis
-- Cette migration documente l'état final de la DB (déjà appliqué manuellement)

-- Reconstruction de la table sessions sans clientId, avec lastHeartbeat
CREATE TABLE IF NOT EXISTS "sessions_new" (
    "id"            TEXT NOT NULL PRIMARY KEY,
    "machineId"     TEXT NOT NULL,
    "debut"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin"           DATETIME,
    "dureePrevu"    INTEGER NOT NULL DEFAULT 30,
    "dureeMinutes"  INTEGER,
    "montant"       REAL,
    "statut"        TEXT NOT NULL DEFAULT 'EN_COURS',
    "lastHeartbeat" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Reconstruction de la table paiements sans clientId, avec telephone
CREATE TABLE IF NOT EXISTS "paiements_new" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "sessionId"        TEXT NOT NULL,
    "montant"          REAL NOT NULL,
    "methode"          TEXT NOT NULL,
    "statut"           TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "telephone"        TEXT,
    "referenceFeexPay" TEXT,
    "network"          TEXT,
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paiements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "paiements_sessionId_key" UNIQUE ("sessionId")
);

DROP TABLE IF EXISTS "sessions_new";
DROP TABLE IF EXISTS "paiements_new";
DROP TABLE IF EXISTS "clients";
