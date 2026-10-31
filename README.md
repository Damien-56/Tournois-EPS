# Tournois EPS

Reconstruction indépendante de l’application « Tournoi EPS et ATP », pensée pour fonctionner sans publicité, sans abonnement et sans compte obligatoire.

La PWA est la version de référence pour le PC, iOS et Android : elle peut être installée depuis un navigateur compatible, fonctionner hors connexion après son premier chargement et recevoir les évolutions depuis l’hébergement web. L’APK Android reste une enveloppe optionnelle pour les fonctions natives, notamment le réseau local maître/client.

## Modes de fonctionnement

- **Autonome** : une tablette, un téléphone ou un ordinateur conserve les classes, élèves, matchs et classements dans son stockage local.
- **PWA installable** : le même bundle web peut être ajouté à l’écran d’accueil iOS/Android ou installé comme application sur PC.
- **Réseau local** : une tablette maître devient l’autorité de la séance. Les tablettes clientes rejoignent son adresse Wi‑Fi locale ; aucun serveur Internet n’est requis.
- **Interopérabilité EPS** : le contrat JSON versionné `eps.interop-envelope` utilise l’identifiant `tournois-sport-individuel`, les ressources `individual-tournament`, `individual-result` et `attendance`, ainsi que des identifiants stables pour les élèves, classes, séances et résultats. Le bridge `window.tournoisSportIndividuel` reste disponible pour les intégrations contrôlées.
- **Confort d’utilisation** : interface sombre et contrastée adaptée aux séances en salle et aux écrans de tablette.

## Fonctionnalités du MVP

- classes et listes d’élèves, import par copier-coller ;
- profils élèves paramétrables : niveau, genre et statistiques individuelles ;
- appel du jour : présent, absent, non-pratiquant ;
- modes ATP, classique toutes rondes et poules par terrain ;
- activités Badminton, Tennis de table ou activité libre ;
- saisie des résultats, arbitre facultatif, points et classement en direct ;
- score cible normal/flash configurable ;
- bilan pédagogique, taux de victoire et badges calculés ;
- correction et annulation de matchs avec recalcul complet des statistiques ;
- historique de séance, planning des matchs, impression/PDF via le navigateur ;
- export/import JSON versionné ;
- synchronisation maître/client sur Wi‑Fi local ;
- file d’attente des actions clientes pendant une coupure Wi‑Fi ;
- aucune publicité, facturation, abonnement, Firebase ou analytics commerciaux.
- import explicite d’une classe ou d’un groupe depuis une URL HTTPS d’échange EPS versionnée ;

## Développement

```powershell
npm install
npm run dev
npm run build
npm run mobile:sync
```

Le build web produit `dist/`, qui contient aussi le manifeste installable et le service worker hors ligne. Pour tester l’installation PWA, servez `dist/` en HTTPS ou via `localhost`, ouvrez l’application dans le navigateur puis utilisez « Ajouter à l’écran d’accueil » ou « Installer l’application ». Le dépôt GitHub reste la source de propagation ; après publication d’un nouveau build, le service worker met à jour le shell web au prochain chargement.

Le workflow `.github/workflows/ci.yml` exécute les tests et le build sur GitHub pour chaque push et chaque pull request. Le workflow `.github/workflows/deploy-pwa.yml` publie automatiquement `dist/` sur GitHub Pages après fusion sur `main`. Il faut activer GitHub Pages avec la source « GitHub Actions » dans les réglages du dépôt. Ces workflows ne publient pas les APK.

La compilation Android nécessite un environnement Gradle/Android SDK installé. L’APK est ensuite produit dans `android/app/build/outputs/apk/debug/`.

L’ordre de livraison recommandé est PWA d’abord, validation sur PC/iOS/Android ensuite, puis régénération de l’APK Android après chaque évolution web importante. L’APK de production signé sera produit en dernier, une fois le socle multiplateforme stabilisé.

Le wrapper Gradle est inclus dans le dépôt afin de permettre une compilation reproductible avec `android\gradlew.bat assembleDebug`.

Le contrat d’interopérabilité partagé avec les autres applications est décrit dans [docs/integration/CONTRAT-INTEROPERABILITE-EPS.md](docs/integration/CONTRAT-INTEROPERABILITE-EPS.md). L’ancien identifiant `tournois-eps` est accepté uniquement lors de la lecture de données legacy. Tournois EPS ne lit jamais le stockage local d’une autre application et ne transmet pas automatiquement les données personnelles.

## Licence de reconstruction

Le projet est une réimplémentation indépendante destinée à l’usage EPS de l’équipe. Les éléments d’interface, données et services propriétaires de l’application originale ne sont pas embarqués.
