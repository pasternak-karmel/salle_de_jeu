Projet : Salle de jeu (GameZone)

Application de gestion d'une salle de jeu à Cotonou, Bénin. Le gérant ouvre une
session sur un poste pour une durée prévue, la TV s'allume (Wake-on-LAN) puis
s'éteint automatiquement à échéance, et le client règle en cash ou Mobile Money.

## Stack
- Next.js 16.2.6 (App Router, Server Components)
- TypeScript strict
- Tailwind CSS (config unique : `tailwind.config.ts`)
- Prisma + SQLite (`prisma/dev.db`, non versionnée)
- FeexPay pour le Mobile Money (MTN / Moov Bénin)
- Recharts pour les graphiques
- Pas de librairie de composants : tout est écrit à la main dans `/components`

## Conventions
- Composants en PascalCase dans `/src/components`
- Pages dans `/src/app` (App Router)
- Logique partagée dans `/src/lib`
- Nommage du domaine en français (session, paiement, machine, montant)

## Architecture — points structurants
- **Clôture des sessions** : toute fin de session passe par `cloturerSession()`
  dans `src/lib/session-lifecycle.ts`. Cette fonction est idempotente. Ne pas
  dupliquer sa logique ailleurs.
- **Échéance** : la boucle de `src/lib/session-scheduler.ts` (tick 15s) clôture
  les sessions dont `debut + dureePrevu` est dépassé. Pas de `setTimeout` par
  session : ça ne survivrait pas à un redémarrage.
- **Facturation** : arrêt manuel = temps réel écoulé ; arrêt automatique =
  `dureePrevu` exactement, pour qu'une coupure serveur ne surfacture jamais.
- **Temps réel TV** : SSE via `src/lib/tv-events.ts` (EventEmitter global).
- **Contrôle TV** : protocole Samsung legacy TCP port 55000, `src/lib/tv-control.ts`.

## Design system
- Polices : Chakra Petch (UI), Russo One (titres, via `.font-display`)
- Fond sombre : `--bg-void` #0F0F23, `--bg-card` #131326
- Accents : violet #7C3AED, cyan #06B6D4, ambre #F59E0B
- Border radius : `rounded-lg` (8px)
- Classes utilitaires maison dans `globals.css` (`.btn-primary`, `.nav-item`, `.card`)

## Contraintes
- Pas d'animation par librairie externe (CSS uniquement)
- Pas de librairie UI lourde (MUI, Antd, shadcn)
- L'app tourne sur le LAN de la salle : les API ne sont pas authentifiées.
  Ne pas l'exposer publiquement sans ajouter une couche d'auth au préalable.
