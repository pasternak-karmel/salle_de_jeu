import { PrismaClient } from "@prisma/client";
import { startHeartbeat, recoverCrashedSessions } from "@/lib/session-recovery";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error"] : [] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Au démarrage : récupérer les sessions crashées puis lancer le heartbeat
// On utilise un flag global pour éviter de relancer à chaque hot-reload Next.js
declare global {
  // eslint-disable-next-line no-var
  var _gameZoneBooted: boolean | undefined;
}

if (!global._gameZoneBooted) {
  global._gameZoneBooted = true;
  recoverCrashedSessions()
    .then((n) => {
      if (n > 0) console.log(`[GameZone] ${n} session(s) récupérée(s) après redémarrage`);
      startHeartbeat();
    })
    .catch((err) => {
      console.error("[GameZone] Erreur au démarrage:", err);
      startHeartbeat(); // lancer quand même le heartbeat
    });
}
