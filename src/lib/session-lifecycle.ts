/**
 * session-lifecycle.ts
 *
 * Point unique de clôture d'une session. Utilisé par :
 *  - POST /api/sessions/[id]/terminer  (arrêt manuel, facturé au temps réel)
 *  - la boucle de contrôle (arrêt automatique, facturé à la durée prévue)
 *
 * La clôture est idempotente : la transition EN_COURS → TERMINEE est faite via
 * un updateMany conditionnel, donc deux appels concurrents ne peuvent pas
 * facturer la session deux fois ni libérer la machine deux fois.
 */

import { prisma } from "@/lib/prisma";
import { calculerMontant } from "@/lib/utils";
import { turnOffTV } from "@/lib/tv-control";
import { emitMachineUpdate } from "@/lib/tv-events";

type SessionAvecMachine = {
  id: string;
  machineId: string;
  debut: Date;
  machine: { nom: string; type: string; prixHeure: number; tvIp: string | null };
};

export type ResultatCloture = {
  dureeMinutes: number;
  montant: number;
} | null;

/**
 * Clôture une session et libère sa machine.
 *
 * @param fin  Instant de fin à facturer. Pour un arrêt manuel c'est maintenant ;
 *             pour un arrêt automatique c'est `debut + dureePrevu`, ce qui garantit
 *             qu'un serveur redémarré après une coupure ne surfacture pas le client.
 * @returns    Les montants facturés, ou `null` si la session était déjà clôturée.
 */
export async function cloturerSession(
  session: SessionAvecMachine,
  fin: Date,
): Promise<ResultatCloture> {
  const dureeMinutes = Math.max(
    1,
    Math.ceil((fin.getTime() - new Date(session.debut).getTime()) / 60_000),
  );
  const montant = calculerMontant(session.machine.prixHeure, dureeMinutes);

  // Transition conditionnelle : ne passe que si la session est encore EN_COURS.
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, statut: "EN_COURS" },
    data: { fin, dureeMinutes, montant, statut: "TERMINEE" },
  });

  if (count === 0) return null; // déjà clôturée par un autre appel

  await prisma.machine.update({
    where: { id: session.machineId },
    data: { statut: "DISPONIBLE" },
  });

  if (session.machine.tvIp) turnOffTV(session.machine.tvIp).catch(() => {});

  emitMachineUpdate({
    machineId: session.machineId,
    statut: "DISPONIBLE",
    machineName: session.machine.nom,
    machineType: session.machine.type,
    session: null,
    pendingPayment: { sessionId: session.id, montant },
  });

  return { dureeMinutes, montant };
}
