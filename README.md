# GameZone — Gestion Salle de Jeu

Application Next.js de gestion complète pour salle de jeu, adaptée au marché béninois avec intégration FeexPay.

## Fonctionnalités

| Module | Détails |
|--------|---------|
| **Tableau de bord** | Revenus du jour/mois, sessions en cours, graphique 7 jours, top postes |
| **Postes** | Vue en temps réel, statuts (libre/occupé/maintenance), ajout/modification |
| **Sessions** | Démarrer/arrêter, chronomètre automatique, facturation au temps réel |
| **Clients** | Inscription, historique des visites, total dépensé, temps de jeu |
| **Paiements** | Cash, carte, FeexPay (Mobile Money Bénin), tableau de bord encaissements |

## Stack technique

- **Next.js 14** (App Router + Server Components)
- **Prisma** ORM + **PostgreSQL**
- **Tailwind CSS** (thème dark gaming)
- **FeexPay** pour les paiements Mobile Money (MTN, Moov)
- **Recharts** pour les graphiques

## Installation

```bash
# 1. Variables d'environnement
cp .env.example .env
# Remplir DATABASE_URL, FEEXPAY_API_KEY, FEEXPAY_SHOP_ID

# 2. Installer les dépendances
npm install

# 3. Initialiser la base de données
npx prisma db push

# 4. (Optionnel) Données de démo
npm run db:seed

# 5. Lancer en développement
npm run dev
```

## Configuration FeexPay

1. Créer un compte sur [feexpay.me](https://feexpay.me)
2. Récupérer votre `API_KEY` et `SHOP_ID` dans le tableau de bord FeexPay
3. Configurer l'URL de webhook : `https://votre-domaine.com/api/feexpay/webhook`
4. Renseigner les variables dans `.env`

## Structure

```
src/
├── app/
│   ├── page.tsx              ← Tableau de bord
│   ├── machines/             ← Gestion des postes
│   ├── sessions/             ← Sessions et chronomètres
│   ├── clients/              ← Gestion clients
│   ├── paiements/            ← Historique paiements
│   └── api/                  ← Routes API REST
├── components/
│   ├── Layout/Sidebar.tsx
│   ├── Dashboard/
│   └── Sessions/MachineTimer.tsx
└── lib/
    ├── prisma.ts
    ├── feexpay.ts
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
