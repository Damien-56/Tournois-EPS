# Audit fonctionnel — Tournois EPS

## Périmètre fonctionnel couvert

- application Capacitor/Vite avec bundle web embarqué ;
- modes ATP, Classique et Poules ;
- gestion des classes, élèves, appel, niveaux et profils ;
- saisie des matchs, arbitres, points, badges et statistiques ;
- accès élève par QR code et synchronisation temps réel ;
- règles Badminton/Tennis de table et export PDF ;
- interface française adaptée aux usages EPS ;
- fonctionnement autonome et réseau local maître/client.

## Choix de la reconstruction

La version personnelle reprend le cœur pédagogique et le rend indépendant : stockage local, import/export JSON, pont d’intégration EPS et synchronisation directe sur Wi‑Fi local. Le mode réseau local conserve une tablette maître comme autorité afin d’éviter les conflits de saisie.

## Fonctions livrées

| Fonction | État |
|---|---|
| Mode autonome sur tablette/ordinateur | OK |
| PWA installable PC/iOS/Android | Socle ajouté — manifeste, service worker et cache hors ligne à tester sur appareils réels |
| Classes et élèves | OK — profils enrichis avec niveau, genre et statistiques |
| Appel présent/absent/non-pratiquant | OK |
| ATP, Classique, Poules | OK MVP |
| Matchs, scores, arbitre, points | OK — annulation et correction d’un match ancien avec recalcul des compteurs |
| Classement et historique | OK |
| Score cible normal/flash configurable | OK |
| Statistiques, taux de victoire et badges | OK — calcul local à partir de l’historique |
| Export/import JSON | OK |
| Impression/PDF navigateur | OK via impression système |
| Maître/client Wi‑Fi local | OK socle Android + polling, avec correction de match propagée |
| Reprise des actions clientes après coupure Wi‑Fi | OK — file locale et déduplication côté maître |
| QR code de connexion | OK MVP — affiché par la tablette maître |
| Jeton de séance réseau local | OK — accès `/state` et `/action` protégé |
| Mode élève sécurisé par PIN | OK MVP — réglages masqués et sortie protégée |
| Découverte automatique mDNS/NSD | OK MVP Android |
| Journal d’actions réseau dédoublonné | OK MVP — identifiant d’action obligatoire côté maître |
| Bridge d’intégration EPS | OK — contrat version 1, capacités déclarées et notifications `onChange` fonctionnelles |
| Signature cryptographique du journal | À envisager pour un déploiement multi-établissements |
| Multi-langue | Hors périmètre — interface française conservée |
| Publicité | Supprimée |
| Abonnement/achat intégré | Supprimé |
| Firebase/authentification obligatoire | Supprimé |

## Garanties de distribution

Aucun SDK publicitaire, achat intégré, abonnement, authentification obligatoire, Firebase ou analytics commercial n’est utilisé.

## Vérifications

- `npm run build` : réussi ;
- `npm run mobile:sync` : réussi ;
- compilation Gradle Android : réussie avec `assembleDebug` ;
- APK debug généré dans `android/app/build/outputs/apk/debug/app-debug.apk` ;
- test sur plusieurs appareils physiques : à réaliser sur le même point d’accès Wi‑Fi.
