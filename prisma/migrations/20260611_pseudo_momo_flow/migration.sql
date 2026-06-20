-- Migration: replace nom/prenom with pseudo, add network to Paiement, remove tokenFeexPay

-- 1. Rename clients table temporarily
ALTER TABLE clients RENAME TO clients_old;

-- 2. Create new clients table with pseudo
CREATE TABLE clients (
  id              TEXT NOT NULL PRIMARY KEY,
  pseudo          TEXT NOT NULL,
  telephone       TEXT,
  email           TEXT UNIQUE,
  dateInscription DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Migrate data: combine prenom + nom as pseudo
INSERT INTO clients (id, pseudo, telephone, email, dateInscription)
SELECT id, prenom || ' ' || nom, telephone, email, dateInscription
FROM clients_old;

-- 4. Drop old table
DROP TABLE clients_old;

-- 5. Add network column to paiements (nullable)
ALTER TABLE paiements ADD COLUMN network TEXT;

-- 6. Remove tokenFeexPay column (SQLite doesn't support DROP COLUMN in older versions)
-- We'll keep it as nullable instead — it will just be ignored by Prisma
