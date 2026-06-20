/**
 * session-recovery.ts
 *
 * Deux responsabilités :
 * 1. HEARTBEAT — toutes les 30s, mettre à jour lastHeartbeat des sessions EN_COURS
 *    pour savoir jusqu'où le serveur était vivant en cas de coupure.
 *
 * 2. REPRISE AU BOOT — au démarrage du serveur, scanner les sessions EN_COURS
 *    dont le lastHeartbeat date de plus de 2 minutes (= le serveur était mort).
 *    Pour chacune : calculer le montant basé sur la durée RÉELLE (jusqu'au
 *    dernier heartbeat, pas jusqu'à maintenant), marquer TERMINEE, libérer la machine.
 *    Le gérant verra les sessions pendantes de paiement dans le dashboard.
 */

import { prisma } from "@/lib/prisma";
import { calculerMontant } from "@/lib/utils";
import { emitMachineUpdate } from "@/lib/tv-events";

const HEARTBEAT_INTERVAL_MS = 30_000;   // 30 secondes
const CRASH_THRESHOLD_MS    = 2 * 60_000; // 2 minutes sans heartbeat = crash

// ─── HEARTBEAT ────────────────────────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat() {
  if (heartbeatTimer) return; // déjà lancé

  heartbeatTimer = setInterval(async () => {
    try {
      await prisma.session.updateMany({
        where: { statut: "EN_COURS" },
        data: { lastHeartbeat: new Date() },
      });
    } catch {
      // silencieux — le serveur peut être en train de se fermer
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Ne pas bloquer le process Node.js
  heartbeatTimer.unref();
  console.log("[GameZone] Heartbeat démarré (intervalle: 30s)");
}

// ─── REPRISE AU BOOT ──────────────────────────────────────────────────────────

export async function recoverCrashedSessions(): Promise<number> {
  const threshold = new Date(Date.now() - CRASH_THRESHOLD_MS);

  // Sessions qui étaient EN_COURS et dont le heartbeat est trop vieux
  const sessions = await prisma.session.findMany({
    where: {
      statut: "EN_COURS",
      lastHeartbeat: { lt: threshold },
    },
    include: { machine: true },
  });

  if (sessions.length === 0) return 0;

  console.log(`[GameZone] ${sessions.length} session(s) à récupérer après coupure`);

  let recovered = 0;
  for (const s of sessions) {
    try {
      // La durée réelle = de debut jusqu'au dernier heartbeat connu
      // (pas jusqu'à maintenant, car le client n'a pas joué pendant la coupure)
      const fin = new Date(s.lastHeartbeat);
      const dureeMinutes = Math.max(
        1,
        Math.ceil((fin.getTime() - new Date(s.debut).getTime()) / 60000)
      );
      const montant = calculerMontant(s.machine.prixHeure, dureeMinutes);

      await prisma.$transaction([
        prisma.session.update({
          where: { id: s.id },
          data: { fin, dureeMinutes, montant, statut: "TERMINEE" },
        }),
        prisma.machine.update({
          where: { id: s.machineId },
          data: { statut: "DISPONIBLE" },
        }),
      ]);

      // Notifier (la TV est probablement éteinte, mais le dashboard se mettra à jour)
      emitMachineUpdate({
        machineId: s.machineId,
        statut: "DISPONIBLE",
        machineName: s.machine.nom,
        machineType: s.machine.type,
        session: null,
        pendingPayment: { sessionId: s.id, montant },
      });

      console.log(
        `[GameZone] Session récupérée: ${s.id} — ${s.machine.nom} — ${dureeMinutes}min — ${montant} FCFA`
      );
      recovered++;
    } catch (err) {
      console.error(`[GameZone] Échec récupération session ${s.id}:`, err);
    }
  }

  return recovered;
}
