# Audit fonctionnel — Tournois EPS

## Observé dans l’APK d’origine

- package Android : `fr.appliseps.tournoiatp`, version `7.1.2` ;
- application Capacitor/Vite avec bundle web embarqué ;
- modes ATP, Classique et Poules ;
- gestion des classes, élèves, appel, niveaux et profils ;
- saisie des matchs, arbitres, points, badges et statistiques ;
- accès élève par QR code et synchronisation temps réel ;
- règles Badminton/Tennis de table et export PDF ;
- traductions françaises, anglaises, espagnoles, italiennes et portugaises ;
- dépendances Firebase, authentification sociale, notifications push, Play Billing, RevenueCat et mécanismes de licence.

## Choix de la reconstruction

La version personnelle reprend le cœur pédagogique et le rend indépendant : stockage local, import/export JSON, pont d’intégration EPS et synchronisation directe sur Wi‑Fi local. Le mode réseau local conserve une tablette maître comme autorité afin d’éviter les conflits de saisie.

## Fonctions livrées

| Fonction | État |
|---|---|
| Mode autonome sur tablette/ordinateur | OK |
| Classes et élèves | OK |
| Appel présent/absent/non-pratiquant | OK |
| ATP, Classique, Poules | OK MVP |
| Matchs, scores, arbitre, points | OK MVP |
| Classement et historique | OK |
| Export/import JSON | OK |
| Impression/PDF navigateur | OK via impression système |
| Maître/client Wi‑Fi local | OK socle Android + polling |
| QR code de connexion | À finaliser |
| Découverte automatique mDNS/NSD | À finaliser |
| Synchronisation sans conflit de toutes les opérations | À renforcer par journal d’actions signé |
| Multi-langue | À ajouter dans l’interface personnelle |
| Publicité | Supprimée |
| Abonnement/achat intégré | Supprimé |
| Firebase/authentification obligatoire | Supprimé |

## Hors périmètre volontaire

Les SDK publicitaires, identifiants publicitaires, achats, abonnements, RevenueCat, Play Billing, Pairip, Facebook Login et analytics commerciaux de l’APK d’origine ne sont pas réutilisés.

## Vérifications

- `npm run build` : réussi ;
- `npm run mobile:sync` : réussi ;
- compilation Gradle Android : non vérifiable dans cet environnement car le projet ne contient pas `gradle-wrapper.jar` et aucun exécutable Gradle n’est installé ;
- test sur plusieurs appareils physiques : à réaliser sur le même point d’accès Wi‑Fi.
