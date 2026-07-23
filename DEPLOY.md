# Déploiement — Salle de jeu

## Principe

Le serveur **doit tourner sur un PC de la salle**, sur le même réseau local que
les TV. L'appli les pilote directement (Wake-on-LAN en broadcast, Roku ECP sur
le port 8060, Samsung TCP sur 55000) et fait tourner en continu la boucle de
contrôle (clôture des sessions, extinction des TV hors session). Un hébergeur
cloud (Vercel…) ne pourrait atteindre ni les TV ni le réseau : **pas de cloud**.

Le propriétaire, chez lui, accède à ce serveur à distance via **Tailscale** — un
réseau privé chiffré, sans exposition publique.

```
   [ PC serveur — salle ]───LAN───[ TV Roku / Samsung, postes ]
            │
        Tailscale (chiffré, privé)
            │
   [ Téléphone / PC du propriétaire — domicile ]
```

> ⚠️ **Sécurité.** Les API de l'appli n'ont pas d'authentification. Ne fais
> **jamais** de redirection de port sur la box : ça exposerait à tout Internet le
> pouvoir de créer/supprimer des postes et valider des paiements. Tailscale règle
> le problème en amont : seuls les appareils du réseau privé peuvent joindre
> l'appli.

---

## 1. Installer l'appli sur le PC de la salle

> Les commandes ci-dessous supposent l'utilisateur `karmel` et le projet dans
> `/home/karmel/Documents/Github/salle_de_jeu`. Adapte si le PC de la salle est
> une autre machine (nom d'utilisateur, chemins).

> **Base de données : PostgreSQL hébergé chez Neon.** La salle et le propriétaire
> lisent/écrivent la **même** base en ligne (une seule source de vérité).
> ⚠️ Conséquence : le PC de la salle a besoin d'internet pour enregistrer les
> sessions et paiements. En cas de coupure, le pilotage TV reste local mais la
> gestion s'arrête tant que la base est injoignable.

```bash
cd /home/karmel/Documents/Github/salle_de_jeu

# Dépendances + client Prisma
bun install
bunx prisma generate

# Renseigner les variables : DATABASE_URL + DIRECT_URL (Neon), clés FeexPay
cp -n .env.example .env && nano .env

# Créer le schéma dans la base Neon
bunx prisma db push

# Build de production
bun run build
```

Voir la section **6. Base de données (Neon)** pour créer le projet et importer
la configuration des postes.

Vérifie que ça démarre à la main avant d'installer le service :

```bash
bun run start          # écoute sur http://0.0.0.0:3000
# Ctrl+C pour arrêter une fois testé
```

---

## 2. Démarrage automatique (service systemd)

L'appli doit se relancer seule au démarrage du PC et après un crash ou une
coupure de courant. On utilise un **service utilisateur** systemd (compatible
avec l'installation Node via nvm, sans rien réinstaller).

```bash
# Copier le service fourni
mkdir -p ~/.config/systemd/user
cp deploy/salle-de-jeu.service ~/.config/systemd/user/

# Vérifier le chemin de Node dans le fichier (à corriger si besoin) :
which node        # doit correspondre au dossier bin indiqué dans le service

# Activer et lancer
systemctl --user daemon-reload
systemctl --user enable --now salle-de-jeu

# Permettre au service de tourner PC allumé même sans session ouverte
sudo loginctl enable-linger karmel
```

Commandes utiles :

```bash
systemctl --user status salle-de-jeu     # état
journalctl --user -u salle-de-jeu -f     # logs en direct (extinctions TV, etc.)
systemctl --user restart salle-de-jeu    # redémarrer
```

> Sur un vrai serveur dédié, tu peux préférer installer Node en global
> (`/usr/bin/node` via apt/nodesource) et un service **système** (`/etc/systemd/system/`,
> `sudo systemctl`). Le principe reste identique.

---

## 3. Accès distant du propriétaire (Tailscale)

### Sur le PC de la salle

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Suivre le lien affiché pour connecter la machine au compte Tailscale.
sudo tailscale ip -4        # note l'adresse (ex. 100.x.y.z)
```

Active un nom lisible (MagicDNS) dans l'admin Tailscale
(https://login.tailscale.com/admin/dns) : le PC devient joignable via
`http://salle-pc:3000` au lieu de l'IP.

### Sur les appareils du propriétaire

1. Installer l'app **Tailscale** (Android / iOS / Windows / Mac) et se connecter
   **au même compte** (ou l'inviter au tailnet).
2. Ouvrir dans le navigateur : `http://100.x.y.z:3000`
   (ou `http://salle-pc:3000` si MagicDNS est activé).

Le propriétaire voit alors le tableau de bord, les sessions, les paiements —
en temps réel, de n'importe où, tant que le PC de la salle est allumé.

> Le gérant sur place continue d'utiliser `http://<IP-locale-du-PC>:3000` via le
> Wi-Fi de la salle, sans Tailscale.

---

## 4. Mises à jour de l'appli

```bash
cd /home/karmel/Documents/Github/salle_de_jeu
git pull
bun install
bunx prisma db push        # si le schéma a changé
bun run build
systemctl --user restart salle-de-jeu
```

---

## 5. Sauvegarde de la base

La base est hébergée chez Neon, qui conserve un historique de points de
restauration (fonction *Restore / Time Travel* du dashboard). Pour une
sauvegarde locale supplémentaire :

```bash
# Nécessite pg_dump (paquet postgresql-client)
pg_dump "$DIRECT_URL" > ~/sauvegardes/salle-$(date +%F).sql
```

---

## 6. Base de données (Neon)

### Créer le projet

1. Compte gratuit sur https://neon.tech, puis **New Project** (choisir une région
   proche, ex. Europe).
2. Bouton **Connect** → sélectionner **Prisma** : Neon affiche `DATABASE_URL`
   (avec `-pooler`) et `DIRECT_URL` (sans `-pooler`). Les copier dans `.env`.
3. Créer le schéma :

   ```bash
   bunx prisma db push
   ```

### Importer la configuration existante des postes

Pour ne pas re-saisir les postes et leurs réglages TV (IP, MAC, marque) :

```bash
# 1. Depuis l'ANCIENNE base SQLite (générée une fois, gitignorée) :
#    déjà fait → le fichier prisma/data-export.json existe.
#    (au besoin : DATABASE_URL="file:./dev.db" bun run db:export)

# 2. Vers la NOUVELLE base Neon (DATABASE_URL/DIRECT_URL pointent sur Neon) :
bun run db:import                 # postes + historique
# ou, pour ne reprendre que la config des postes :
bun run db:import -- --machines-only
```

### Bascule sans perte

La migration SQLite → Neon **remplace** la base de l'appli. Pour éviter de perdre
une session en cours :

1. Faire la bascule **quand aucune session n'est active**.
2. `bun run db:export` sur l'ancienne base (capture l'état à jour).
3. Basculer `.env` sur Neon, `bunx prisma db push`, `bun run db:import`.
4. `bun run build` puis `systemctl --user restart salle-de-jeu`.

> Tant que la bascule n'est pas faite, ne déploie pas la branche Postgres sur le
> PC de la salle : l'appli en production continue de tourner sur SQLite.

---

## Rappel des prérequis TV (Roku)

Pour que l'allumage/extinction fonctionne, sur chaque TV Roku :
- **Accès réseau** = « Permissif » (Paramètres → Système → Paramètres système
  avancés → Contrôle par les applications mobiles).
- **Démarrage TV rapide** activé (la TV reste joignable en veille).
