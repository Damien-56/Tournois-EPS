# Rapport de réalignement — Tournois EPS sports individuels

Date : 31 octobre 2026
Périmètre : uniquement `D:\Documents local\ChatGPT\récupération APK - REA\tournois-eps`

## Verdict

**PARTIELLEMENT VALIDÉE**.

La fusion locale est réalisée et vérifiée par les tests, le build de production, la synchronisation Capacitor Android et un test HTTP du paquet de production. La publication GitHub et la mise à jour de l’application réellement installée restent volontairement en attente d’autorisation et de vérification de l’installeur/appareil.

## État initial local

- Branche locale : `main`.
- Commit local : `57e4dfd` (`docs: imposer l autonomie des applications EPS`).
- État distant avant récupération : `origin/main` sur `57e4dfd`.
- Modifications locales non validées : `index.html`, `public/icon.png`, `public/manifest.webmanifest`, `src/styles.css`, ainsi que `public/generated-icons/`, `public/icon.ico` et un `public/icon.svg` local.
- Données utilisateur identifiées : stockage navigateur `tournois-eps.local.v1` dans le profil Chrome utilisé par l’application.

## Sauvegardes réalisées

Emplacement exact :

`C:\Users\guill\.codex\visualizations\2026\10\29\01a18819-6372-7943-bb85-2341d6fe7408\pre-galaxie-theme-20261031-165038`

Cette sauvegarde contient l’état Git, un bundle de récupération, les patchs de travail, les fichiers locaux modifiés et non suivis, ainsi qu’une copie du stockage local Chrome incluant `tournois-eps.local.v1`. Un stash Git de précaution reste également conservé : `pre-galaxie-local-changes-2026-10-31`.

## État GitHub avant fusion

Après comparaison puis récupération, `origin/main` était huit commits devant le `main` local :

- `e26c3f1` : icône EPS harmonisée PC/mobile ;
- `11749ee` : thème sombre Tournois EPS individuel ;
- `bcbf07c` : manifeste EPS harmonisé ;
- `0c29983` : icône et couleur sombre ;
- `5a533d9` : contour jaune pâle des icônes ;
- `98a3fc0` : identité PWA propre à GitHub Pages ;
- `247e07d` : URL du manifeste pour Chrome ;
- `639f680` : icônes PNG bordées publiées pour Android.

La branche de travail a été créée à partir de ce `origin/main` à jour. `main` n’a pas été modifiée.

## Différences classées et décisions

### Conservé depuis GitHub

- Le manifeste PWA et les icônes canoniques `icon.svg`, `icon-192.png` et `icon-512.png`.
- L’identité PWA publiée par GitHub Pages.
- Les évolutions métier et d’interopérabilité déjà présentes sur `origin/main`.

### Conservé depuis le travail local

- Le thème local `eps.theme 1.0.0` pour l’application `tournois-sports-individuels`.
- Le bootstrap synchrone avant les feuilles de style, avec mode clair par défaut et repli mémoire si `localStorage` est indisponible.
- La préférence indépendante `eps.theme.v1.tournois-sports-individuels` ; elle ne touche pas `tournois-eps.local.v1`.
- Le sélecteur clair/sombre, la navigation latérale desktop, la navigation compacte mobile, les contrastes, le focus clavier et les règles d’impression claire.
- Les ressources du thème copiées localement dans `public/theme/`, sans dépendance d’exécution à CrossScan ni à un chemin externe.
- La couverture de test du contrat de thème.

### Écarté ou non publié

- Aucun code métier de tournoi n’a été supprimé.
- Les fichiers locaux `public/generated-icons/` et `public/icon.ico` restent présents et sauvegardés, mais ne sont pas ajoutés à Git car ils sont générés ou non nécessaires au manifeste publié.
- `public/icon.png` local est conservé dans la branche comme compatibilité avec l’état local antérieur ; le manifeste et le service worker utilisent les icônes canoniques publiées.

### Conflits résolus

- `index.html` : conservation de l’identité PWA distante et insertion du bootstrap de thème avant les styles.
- `public/manifest.webmanifest` : conservation des icônes et couleurs publiées par GitHub.
- `src/styles.css` : fusion contrôlée du style local avec les variables et règles du contrat EPS.

## Technologie et vérifications

- Application React + TypeScript + Vite.
- Persistance : stockage navigateur local, export/import JSON existant conservé.
- Mobile : Capacitor Android.
- Tests automatisés : **14 tests passés** dans 5 fichiers.
- Vérification TypeScript et build de production : **réussis**.
- Synchronisation Capacitor Android : **réussie**.
- Test HTTP du paquet de production : `/`, manifeste, bootstrap et feuille de thème répondent **200**.
- Service worker : cache versionné `tournois-eps-pwa-v2-20261031` et ressources du thème incluses.
- Aucun script desktop/Tauri n’existe dans ce projet ; aucun test desktop spécifique n’était applicable.

## Branche et commits

Branche de travail créée :

`codex/tournois-sports-individuels-galaxie-eps`

Elle part de `origin/main` sur `639f680`. Commit local créé : `76855a8` (`feat: adopter le thème Galaxie EPS pour les sports individuels`). Aucune modification directe de `main` et aucun push forcé n’ont été effectués.

## Décision humaine restante

1. Autoriser ou non le push de cette branche et la préparation d’une Pull Request vers `main`.
2. Après validation GitHub, vérifier l’installation réelle Android/PWA et seulement alors mettre à jour l’application installée.
3. Décider si les copies locales non suivies `public/generated-icons/` et `public/icon.ico` doivent être conservées sur le poste ou simplement archivées dans la sauvegarde. Elles ne contiennent pas les données de tournois.
