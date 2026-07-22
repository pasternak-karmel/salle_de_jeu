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

```bash
cd /home/karmel/Documents/Github/salle_de_jeu

# Dépendances + client Prisma + base à jour
bun install
bunx prisma generate
bunx prisma db push        # crée/aligne prisma/dev.db (colonne nullable = sans perte)

# Renseigner les variables (clés FeexPay notamment)
cp -n .env.example .env && nano .env

# Build de production
bun run build
```

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

Toutes les données (postes, sessions, paiements) sont dans un seul fichier :
`prisma/dev.db`. Il n'est pas versionné. Sauvegarde-le régulièrement :

```bash
cp prisma/dev.db ~/sauvegardes/salle-$(date +%F).db
```

---

## Rappel des prérequis TV (Roku)

Pour que l'allumage/extinction fonctionne, sur chaque TV Roku :
- **Accès réseau** = « Permissif » (Paramètres → Système → Paramètres système
  avancés → Contrôle par les applications mobiles).
- **Démarrage TV rapide** activé (la TV reste joignable en veille).
