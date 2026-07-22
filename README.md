# GameZone — Gestion Salle de Jeu

Application Next.js de gestion pour salle de jeu, adaptée au marché béninois avec intégration FeexPay (Mobile Money).

## Fonctionnalités

| Module | Détails |
|--------|---------|
| **Tableau de bord** | Revenus du jour/mois, sessions en cours, graphique 7 jours, top postes |
| **Postes** | Vue en temps réel, statuts (disponible/occupé/maintenance), ajout/modification |
| **Sessions** | Démarrage avec durée prévue, chronomètre, clôture automatique à échéance |
| **Paiements** | Cash et FeexPay (MTN / Moov Bénin), suivi des encaissements |
| **Affichage TV** | Écran client par poste (compte à rebours), allumage/extinction automatiques |

## Stack technique

- **Next.js 16** (App Router + Server Components)
- **Prisma** ORM + **SQLite**
- **Tailwind CSS** (thème dark gaming)
- **FeexPay** pour les paiements Mobile Money (MTN, Moov)
- **Recharts** pour les graphiques
- **SSE** pour la synchronisation temps réel des écrans TV

## Installation

```bash
# 1. Variables d'environnement
cp .env.example .env
# Renseigner FEEXPAY_API_KEY et FEEXPAY_SHOP_ID

# 2. Installer les dépendances
bun install

# 3. Initialiser la base de données
bunx prisma db push

# 4. (Optionnel) Données de démo
bun run db:seed

# 5. Lancer en développement
bun run dev
```

## Configuration FeexPay

1. Créer un compte sur [feexpay.me](https://feexpay.me)
2. Récupérer `API_KEY` et `SHOP_ID` dans le tableau de bord FeexPay
3. Configurer l'URL de webhook : `https://votre-domaine.com/api/feexpay/webhook`
4. Renseigner les variables dans `.env`

Le webhook ne fait pas confiance au corps de la requête : il n'en extrait que la
référence, puis redemande le statut réel à FeexPay avec la clé API. Le paiement
n'est marqué `PAYE` que si le montant encaissé couvre le montant dû.

## Cycle de vie d'une session

Une session est ouverte pour une **durée prévue** (`dureePrevu`, 1 à 480 min).

- **Arrêt manuel** (`POST /api/sessions/[id]/terminer`) → facturé au temps réellement écoulé.
- **Arrêt automatique** → une boucle de contrôle (`src/lib/session-scheduler.ts`, tick 15 s)
  clôture les sessions dont `debut + dureePrevu` est dépassé, et les facture
  exactement à `dureePrevu`.

L'échéance étant déduite de la base et non d'un timer en mémoire, elle survit à
un redémarrage du serveur : une coupure de plusieurs heures ne surfacture jamais
le client, et aucune session en cours n'est interrompue par un simple redéploiement.

Toute clôture passe par `cloturerSession()` (`src/lib/session-lifecycle.ts`), qui
est idempotente : deux appels concurrents ne peuvent pas facturer deux fois.

## Contrôle des TV

Les postes équipés d'une TV sont allumés au démarrage de la session et éteints à
sa clôture. Allumage et extinction sont routés selon le champ `tvType` :

| Marque | Extinction | Allumage | Appairage |
|--------|-----------|----------|-----------|
| **Samsung** | TCP legacy port 55000 | Wake-on-LAN (`tvMac`) | Oui — `POST /api/tv/[machineId]/pair`, accepter le popup sur la TV |
| **Roku** | ECP HTTP port 8060 | ECP `PowerOn` (`tvIp`) | Aucun |

Deux réglages sont requis sur une TV Roku :
- **Accès réseau** sur « Permissif » (Paramètres → Système → Paramètres système
  avancés → Contrôle par les applications mobiles), sinon toute commande renvoie 403.
- **Démarrage TV rapide** activé, pour que la TV reste joignable en veille et
  puisse être rallumée par `PowerOn` (le Wake-on-LAN étant peu fiable en WiFi).

Si `tvType` n'est pas renseigné (« Auto-détection » dans le formulaire), la
marque est détectée à la première extinction — une TV qui répond sur l'endpoint
ECP `http://<ip>:8060/query/device-info` est un Roku, sinon on retombe sur
Samsung — puis mémorisée pour ne plus re-sonder ensuite.

## Structure

```
src/
├── app/
│   ├── page.tsx              ← Tableau de bord
│   ├── machines/             ← Gestion des postes
│   ├── sessions/             ← Sessions et chronomètres
│   ├── paiements/            ← Historique paiements
│   ├── tv/[machineId]/       ← Écran client affiché sur la TV
│   └── api/                  ← Routes API REST
├── components/
│   ├── Layout/Sidebar.tsx
│   ├── Dashboard/DashboardCharts.tsx
│   └── TV/TVDisplay.tsx
├── instrumentation.ts        ← Démarrage de la boucle de contrôle
└── lib/
    ├── prisma.ts
    ├── feexpay.ts
    ├── session-lifecycle.ts  ← Clôture idempotente d'une session
    ├── session-scheduler.ts  ← Boucle de clôture à échéance
    ├── tv-control.ts         ← Wake-on-LAN + protocole Samsung
    ├── tv-events.ts          ← Bus d'événements SSE
    └── utils.ts
```

## Tarification des postes (FCFA/heure par défaut)

| Poste | Prix suggéré |
|-------|-------------|
| PS5 | 1 500 FCFA/h |
| PC Gaming | 1 000 FCFA/h |
| VR | 2 500 FCFA/h |
| Xbox | 1 200 FCFA/h |

Prix modifiables directement dans l'interface.

## Sécurité — à lire avant tout déploiement

**Les routes API ne sont pas authentifiées.** L'application est prévue pour
tourner sur le réseau local de la salle. Ne pas l'exposer sur Internet sans
ajouter au préalable une couche d'authentification sur `/api/*` et les pages
d'administration (les routes `/tv/[machineId]` et son SSE doivent rester
accessibles aux écrans).
