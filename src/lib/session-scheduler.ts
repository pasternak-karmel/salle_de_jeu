/**
 * session-scheduler.ts
 *
 * Boucle de contrôle unique qui clôture les sessions arrivées à échéance.
 *
 * Remplace l'ancien mécanisme (un setTimeout par session + heartbeat + reprise
 * au boot), qui avait deux défauts : les timers en mémoire disparaissaient au
 * redémarrage du serveur, et la reprise au boot terminait de force TOUTES les
 * sessions en cours — y compris celles de clients en train de jouer lors d'un
 * simple redéploiement.
 *
 * Ici l'échéance est dérivée de la base (`debut + dureePrevu`), donc l'état
 * survit à n'importe quel redémarrage et il n'y a rien à reconstruire au boot.
 */

import { prisma } from "@/lib/prisma";
import { cloturerSession } from "@/lib/session-lifecycle";
import { initAuthorizedIps, rokuEstAllumee, rokuPowerOff } from "@/lib/tv-control";

const TICK_MS = 15_000; // résolution de la clôture automatique

// Flag global : le hot-reload de Next recrée le module, une variable locale
// laisserait plusieurs boucles tourner en parallèle.
declare global {
  var _gameZoneScheduler: ReturnType<typeof setInterval> | undefined;
}

let enCours = false; // évite le chevauchement si un tick dépasse TICK_MS

/**
 * Clôture toutes les sessions dont la durée prévue est écoulée.
 * Chaque session est facturée à `debut + dureePrevu`, jamais à l'heure courante :
 * si le serveur est resté éteint 3h, le client ne paie que ce qu'il avait réservé.
 */
export async function terminerSessionsEchues(): Promise<number> {
  const maintenant = Date.now();

  const sessions = await prisma.session.findMany({
    where: { statut: "EN_COURS" },
    include: {
      machine: { select: { nom: true, type: true, prixHeure: true, tvIp: true, tvType: true } },
    },
  });

  let clôturees = 0;

  for (const s of sessions) {
    const finPrevue = new Date(new Date(s.debut).getTime() + s.dureePrevu * 60_000);
    if (finPrevue.getTime() > maintenant) continue;

    try {
      const res = await cloturerSession(s, finPrevue);
      if (res) {
        clôturees++;
        console.log(
          `[GameZone] Session échue clôturée: ${s.id} — ${s.machine.nom} — ` +
            `${res.dureeMinutes}min — ${res.montant} FCFA`,
        );
      }
    } catch (err) {
      console.error(`[GameZone] Échec clôture session ${s.id}:`, err);
    }
  }

  return clôturees;
}

/**
 * Éteint toute Roku allumée alors qu'aucune session n'est en cours sur son poste.
 *
 * Objectif : empêcher qu'un client rallume l'écran à la télécommande pour jouer
 * sans payer — tout doit passer par l'appli. On n'agit que sur les Roku, dont
 * l'état d'alimentation est interrogeable (`power-mode`) ; on n'envoie l'ordre
 * d'extinction que si la dalle est réellement allumée, pour ne pas spammer les
 * TV déjà en veille.
 *
 * Samsung n'est pas surveillé : son protocole ne permet pas de lire l'état
 * d'alimentation de façon fiable.
 */
export async function eteindreTVHorsSession(): Promise<number> {
  const machines = await prisma.machine.findMany({
    where: { tvType: "ROKU", tvIp: { not: null } },
    select: {
      nom: true,
      tvIp: true,
      sessions: { where: { statut: "EN_COURS" }, select: { id: true }, take: 1 },
    },
  });

  let eteintes = 0;

  for (const m of machines) {
    if (!m.tvIp) continue;
    if (m.sessions.length > 0) continue; // session active → écran légitimement allumé

    if (!(await rokuEstAllumee(m.tvIp))) continue; // déjà en veille → rien à faire

    try {
      await rokuPowerOff(m.tvIp);
      eteintes++;
      console.log(`[TV] Extinction hors-session forcée: ${m.nom} (${m.tvIp})`);
    } catch (err) {
      console.error(`[TV] Échec extinction hors-session ${m.tvIp}:`, err);
    }
  }

  return eteintes;
}

/** Pré-charge les IP des TV déjà appairées pour éviter le timeout long au premier envoi. */
async function chargerIpsTV(): Promise<void> {
  const machines = await prisma.machine.findMany({
    where: { tvIp: { not: null } },
    select: { tvIp: true },
  });
  const ips = machines.map((m) => m.tvIp).filter((ip): ip is string => Boolean(ip));
  if (ips.length) initAuthorizedIps(ips);
}

export function startScheduler(): void {
  if (globalThis._gameZoneScheduler) return; // déjà lancée

  const tick = async () => {
    if (enCours) return;
    enCours = true;
    try {
      await terminerSessionsEchues();
      await eteindreTVHorsSession();
    } catch (err) {
      console.error("[GameZone] Erreur boucle de contrôle:", err);
    } finally {
      enCours = false;
    }
  };

  const timer = setInterval(tick, TICK_MS);
  timer.unref(); // ne pas maintenir le process Node.js en vie
  globalThis._gameZoneScheduler = timer;

  // Premier passage immédiat : rattrape les sessions échues pendant l'arrêt.
  chargerIpsTV().catch((err) => console.error("[GameZone] Chargement IP TV:", err));
  tick();

  console.log(`[GameZone] Boucle de contrôle démarrée (tick: ${TICK_MS / 1000}s)`);
}
