-- Ajout de la marque de TV pour router l'extinction (Samsung TCP 55000 vs Roku ECP 8060).
-- Nullable : null = auto-détection à la première extinction, puis mémorisé.
ALTER TABLE "machines" ADD COLUMN "tvType" TEXT;
