# Contexte de reprise — Tournois EPS

Date de référence : 24 octobre 2026

## Identité du projet

- Dépôt local : `D:\Documents local\ChatGPT\récupération APK - REA\tournois-eps`
- Dépôt GitHub : https://github.com/Damien-56/Tournois-EPS
- Branche de développement : `codex/tournois-eps-parite`
- Dernier commit : `4d7df39 feat: ajouter l icone Tournois EPS`
- Application Android : `fr.eps.tournois`
- Nom affiché : `Tournois EPS`
- Version actuelle : `1.0.1`, versionCode `2`
- Appareil de test habituel : ADB `nrrki79xy9bihipb`

## Objectif

Maintenir une application indépendante de tournoi EPS, utilisable seule sur tablette ou ordinateur et intégrable dans la galaxie d’applications EPS. L’application doit rester sans publicité, sans abonnement, sans compte obligatoire et sans dépendance Firebase ou cloud commercial.

L’architecture multi-tablettes retenue est locale : une tablette maître conserve l’état de la séance et les tablettes clientes communiquent avec elle sur le même Wi-Fi. Le mode autonome reste disponible.

## Fonctionnalités déjà présentes

- classes et listes d’élèves par import ligne par ligne ;
- profils élèves avec niveau, genre, présence et compteurs de performance ;
- appel : présent, absent, non-pratiquant ;
- tournois ATP, classique toutes rondes et poules ;
- activités Badminton, Tennis de table ou activité libre ;
- saisie des matchs, scores, arbitre, points et classement ;
- score cible normal/flash configurable ;
- historique et annulation du dernier match avec recalcul fiable des statistiques ;
- bilan pédagogique, taux de victoire et badges calculés localement ;
- import/export JSON versionné ;
- impression/PDF via l’impression système du navigateur ;
- mode élève protégé par PIN ;
- réseau local maître/client Android ;
- QR code de connexion ;
- découverte mDNS/NSD sur Android ;
- jeton de session réseau ;
- déduplication des actions réseau ;
- file d’attente des actions clientes pendant une coupure Wi-Fi ;
- bridge d’intégration `window.epsTournois` ;
- icône personnalisée intégrée Android et Web ;
- aucune publicité, facturation, abonnement, Firebase ou analytics commercial.

## Fichiers importants

- Interface principale : `src/App.tsx`
- Modèle métier : `src/domain/types.ts`
- Règles tournoi : `src/domain/rules.ts`
- Statistiques et badges : `src/domain/stats.ts`
- Tests : `src/domain/*.test.ts`
- Synchronisation LAN : `src/lan.ts`
- Stockage local : `src/storage.ts`
- Bridge d’intégration : `src/integration.ts`
- Icône Web : `public/icon.png`
- Icône Android : `android/app/src/main/res/drawable-nodpi/tournois_eps_icon.png`
- Audit : `AUDIT-FONCTIONNALITES.md`
- Architecture LAN : `RESEAU-LOCAL.md`

## Commandes de travail

```powershell
cd "D:\Documents local\ChatGPT\récupération APK - REA\tournois-eps"
npm install
npm run test -- --run
npm run build
npm run mobile:sync
cd android
.\gradlew.bat assembleDebug
```

APK debug : `android\app\build\outputs\apk\debug\app-debug.apk`

Pour installer sur l’appareil de test :

```powershell
$adb = "C:\Users\guill\AppData\Local\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb -s nrrki79xy9bihipb install -r "D:\Documents local\ChatGPT\récupération APK - REA\tournois-eps\android\app\build\outputs\apk\debug\app-debug.apk"
& $adb -s nrrki79xy9bihipb shell monkey -p fr.eps.tournois 1
```

## État de validation

- Tests unitaires : 6 tests réussis.
- Build web : réussi.
- Synchronisation Capacitor : réussie.
- Compilation Gradle Android : réussie.
- Installation et lancement sur appareil Android : validés.
- Les tests physiques avec deux tablettes sur un même Wi-Fi restent à effectuer.

## Priorités de reprise

1. Valider une séance complète avec deux tablettes Android : maître, cliente, perte Wi-Fi, reprise et déduplication.
2. Ajouter une vraie correction/édition d’un match ancien, pas seulement l’annulation du dernier.
3. Enrichir les règles Badminton/Tennis de table et les statistiques par séance.
4. Produire un export PDF plus maîtrisé et éventuellement CSV.
5. Ajouter les actions natives de notification Android : pause, suivant, précédent et arrêt.
6. Générer un APK signé de production avec une clé dédiée.

## Contraintes de travail

- Ne pas réintroduire publicité, abonnement, paiement, Firebase, authentification obligatoire ou analytics commercial.
- Préserver le fonctionnement autonome hors Internet.
- Ne pas casser le format JSON existant sans migration explicite.
- Tester `npm run test -- --run` et `npm run build` après chaque modification significative.
- Ne pousser sur GitHub qu’après vérification locale.
