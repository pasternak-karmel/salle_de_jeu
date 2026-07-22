/**
 * Point de démarrage du serveur (hook natif Next.js).
 *
 * La boucle de contrôle était auparavant lancée depuis `lib/prisma.ts`, ce qui
 * créait un cycle d'imports : prisma → scheduler → prisma. Selon le module
 * chargé en premier, `startScheduler()` pouvait s'exécuter avant que le module
 * scheduler soit initialisé (ReferenceError en TDZ). `instrumentation.ts` est
 * chargé une seule fois au boot, hors de tout cycle.
 */

export async function register() {
  // Ce hook est aussi appelé sur le runtime edge, où ni Prisma ni les sockets
  // TCP des TV ne sont disponibles.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startScheduler } = await import("@/lib/session-scheduler");
  startScheduler();
}
