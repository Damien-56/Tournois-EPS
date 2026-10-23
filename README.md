# Tournois EPS

Reconstruction indépendante de l’application « Tournoi EPS et ATP », pensée pour fonctionner sans publicité, sans abonnement et sans compte obligatoire.

## Modes de fonctionnement

- **Autonome** : une tablette ou un ordinateur conserve les classes, élèves, matchs et classements dans son stockage local.
- **Réseau local** : une tablette maître devient l’autorité de la séance. Les tablettes clientes rejoignent son adresse Wi‑Fi locale ; aucun serveur Internet n’est requis.
- **Intégration EPS** : le pont `window.epsTournois` expose l’instantané JSON et les changements pour les autres applications de la galaxie EPS.

## Fonctionnalités du MVP

- classes et listes d’élèves, import par copier-coller ;
- profils élèves paramétrables : niveau, genre et statistiques individuelles ;
- appel du jour : présent, absent, non-pratiquant ;
- modes ATP, classique toutes rondes et poules par terrain ;
- activités Badminton, Tennis de table ou activité libre ;
- saisie des résultats, arbitre facultatif, points et classement en direct ;
- score cible normal/flash configurable ;
- bilan pédagogique, taux de victoire et badges calculés ;
- annulation du dernier match avec recalcul complet des statistiques ;
- historique de séance, planning des matchs, impression/PDF via le navigateur ;
- export/import JSON versionné ;
- synchronisation maître/client sur Wi‑Fi local ;
- file d’attente des actions clientes pendant une coupure Wi‑Fi ;
- aucune publicité, facturation, abonnement, Firebase ou analytics commerciaux.

## Développement

```powershell
npm install
npm run dev
npm run build
npm run mobile:sync
```

La compilation Android nécessite un environnement Gradle/Android SDK installé. L’APK est ensuite produit dans `android/app/build/outputs/apk/debug/`.

Le wrapper Gradle est inclus dans le dépôt afin de permettre une compilation reproductible avec `android\gradlew.bat assembleDebug`.

## Licence de reconstruction

Le projet est une réimplémentation indépendante destinée à l’usage EPS de l’équipe. Les éléments d’interface, données et services propriétaires de l’application originale ne sont pas embarqués.
