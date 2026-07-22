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
import {
  samsungPowerOff,
  rokuPowerOff,
  detectTVType,
  type TVType,
} from "@/lib/tv-control";
import { emitMachineUpdate } from "@/lib/tv-events";

type SessionAvecMachine = {
  id: string;
  machineId: string;
  debut: Date;
  machine: {
    nom: string;
    type: string;
    prixHeure: number;
    tvIp: string | null;
    tvType: string | null;
  };
};

/**
 * Éteint la TV du poste selon sa marque.
 *
 * Samsung et Roku parlent des protocoles incompatibles : les Roku ignoraient
 * l'ordre Samsung, d'où les écrans qui restaient allumés. Si la marque n'est pas
 * encore connue (`tvType === null`), on la détecte une fois puis on la mémorise
 * pour éviter de re-sonder à chaque fin de session.
 *
 * Volontairement « fire and forget » : une TV injoignable ne doit jamais bloquer
 * la clôture d'une session ni la libération du poste.
 */
async function eteindreTV(machineId: string, tvIp: string, tvTypeConnu: string | null): Promise<void> {
  let tvType = tvTypeConnu as TVType | null;

  if (!tvType) {
    tvType = await detectTVType(tvIp);
    await prisma.machine
      .update({ where: { id: machineId }, data: { tvType } })
      .catch(() => {}); // la mémorisation est un bonus, pas un prérequis
  }

  const eteindre = tvType === "ROKU" ? rokuPowerOff : samsungPowerOff;
  await eteindre(tvIp).catch((err) => {
    console.error(`[TV] Échec extinction ${tvIp} (${tvType}):`, err);
  });
}

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

  if (session.machine.tvIp) {
    void eteindreTV(session.machineId, session.machine.tvIp, session.machine.tvType);
  }

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
