# Réalignement GitHub du 29 octobre 2026

## Référence de départ

- branche officielle : `main`
- commit GitHub de référence : `57e4dfde8e86542403eea54b8e6cbc55a265fc1e`
- branche de travail créée : `codex/reconcile-interop`
- sauvegarde complète : `C:\Users\guill\.codex\visualizations\2026\10\29\01a18819-6372-7943-bb85-2341d6fe7408\pre-realign-20261029-154430`

## Différences examinées

Le dépôt local contenait sept fichiers modifiés après le commit de référence. La PR GitHub #1 (`codex/eps-interop-v2-tournois`, commit `1d91bc0`) modifiait également `src/integration/epsInterop.ts` et son fichier de tests, avec quatre commits et 173 lignes ajoutées.

Les deux évolutions poursuivent le même objectif : versionner les enveloppes EPS, normaliser les identifiants et lire les anciens documents. Elles divergent toutefois sur le format émis :

- la PR conserve des créateurs génériques et plusieurs anciennes ressources ;
- le travail local impose les ressources canoniques `individual-tournament`, `individual-result` et `attendance`.

## Décision de fusion

La normalisation locale est conservée comme implémentation de référence sur cette branche de travail. Les éléments compatibles de la PR sont conservés ou renforcés :

- lecture rétrocompatible de `id`, `targetApp`, `source.app` et `student.id` ;
- émission de `eventId`, `sourceApp`, `entityId`, `revision` et `schemaVersion` ;
- conversion vers `studentId` et identifiant applicatif canonique ;
- suivi explicite des doublons, conflits, anciennes révisions et trous de séquence.

Les anciens créateurs de ressources de la PR ne sont pas réintroduits : ils produiraient des enveloppes non canoniques alors que l’application doit désormais émettre uniquement le contrat officiel. La lecture des anciennes enveloppes reste assurée.

## Vérifications initiales

- 16 tests automatisés réussis ;
- vérification TypeScript réussie ;
- build web de production réussi ;
- synchronisation Capacitor réussie ;
- compilation APK debug réussie (`fr.eps.tournois`, version `1.0.1`) ;
- serveur de prévisualisation lancé avec succès sur `http://127.0.0.1:4173/` ;
- données `localStorage` sauvegardées depuis le profil Chrome `Default` ;
- aucun appareil Android détecté pour une sauvegarde de données installées.

Le contrôle HTTP automatique de la prévisualisation n’a pas pu être exécuté depuis l’environnement d’exécution, qui interdit les connexions locales entre processus. Le démarrage du serveur lui-même est confirmé.

Les artefacts `dist/` et Android restent générés localement et ne sont pas ajoutés à Git.
