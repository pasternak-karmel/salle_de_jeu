 Projet : Salle de jeu
## Stack
- Next.js 16.2.6 (App Router)
- TypeScript strict
- Tailwind CSS + shadcn/ui
- Database
## Conventions
- Composants en PascalCase dans /components
- Pages en kebab-case dans /app
- Hooks dans /lib/hooks
- Types dans /lib/types
## Design system
- Police : Inter (UI), Fraunces (titres)
- Palette : noir #0a0a0a / blanc / accent #ff6b35
- Border radius : 4px partout
- Animations : framer-motion uniquement
## Contraintes
- Mobile-first obligatoire
- Lighthouse score > 90
- Pas de librairie UI lourde (MUI, Antd)