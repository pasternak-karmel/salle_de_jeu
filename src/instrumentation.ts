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

  // La boucle de contrôle (clôture des sessions + pilotage TV) ne doit tourner
  // QUE sur le serveur de la salle, sur le réseau local des TV. Sur Vercel
  // (serverless, sans accès au LAN), elle ne pourrait pas éteindre les TV et
  // entrerait en conflit avec le scheduler de la salle sur la même base Neon.
  // Vercel définit `VERCEL=1` automatiquement → on s'y appuie pour la désactiver.
  if (process.env.VERCEL) {
    console.log("[GameZone] Environnement Vercel : boucle de contrôle désactivée (consultation seule).");
    return;
  }

  const { startScheduler } = await import("@/lib/session-scheduler");
  startScheduler();
}
