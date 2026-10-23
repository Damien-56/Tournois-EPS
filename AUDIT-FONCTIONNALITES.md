# Audit fonctionnel — Intervalle EPS

Comparaison entre l’APK originale analysée avec REA et la reconstruction indépendante.

## Reproduit dans le MVP

| Fonction | État | Observations |
|---|---|---|
| Séance indépendante | OK | Stockage local, aucune dépendance à une autre application. |
| Groupes d’intervalles | OK | Ateliers/blocs répétables. |
| Nom des intervalles | OK | Modifiable et affiché pendant l’exécution. |
| Travail/repos/préparation/transition/retour au calme | OK | Types disponibles dans le modèle et l’éditeur. |
| Répétitions | OK | Répétition par atelier. |
| Pause/reprise/suivant/réinitialisation | OK | Moteur à horloge monotone, sans dérive pendant la pause. |
| Compte à rebours final | OK | `countdownSeconds` par intervalle, borné par sa durée. |
| Annonce vocale du nom | OK | `SpeechSynthesis` sur navigateur et WebView compatible. |
| Annonce vocale des dernières secondes | OK | Chaque valeur est annoncée une seule fois par intervalle. |
| Langue vocale | Partiel | Français, anglais et espagnol dans l’interface ; sélection réelle de la voix dépend de la plateforme. |
| Préréglages | OK | Sauvegarde locale et réouverture. |
| Import/export | OK | Contrat JSON `eps.interval-session`, versionné. |
| Absence de publicité et d’abonnement | OK | Aucun SDK publicitaire, achat intégré, compte ou collecte commerciale. |

## Partiellement reproduit

| Fonction | État | Travail restant |
|---|---|---|
| Compte à la hausse | OK | Sélection dans l’éditeur et affichage du temps écoulé. |
| Affichage statique | OK | Affichage fixe de la durée de l’intervalle actif. |
| Édition des intervalles | OK | Ajouter, supprimer et réordonner les intervalles et ateliers. |
| Signaux de fin | OK | Signal local, vibration et profils silencieux/EPS/sport. |
| Préréglages | OK | Renommer, dupliquer, supprimer, modèles EPS et bibliothèque JSON. |
| Réglages écran | OK web/Android | Wake Lock côté web et service/notification Capacitor Android. |
| TTS en arrière-plan | Partiel | Fonctionne via Web Speech lorsque disponible ; nécessite un adaptateur TTS natif pour Android/iOS. |

## À développer en priorité

| Fonction | Pourquoi |
|---|---|
| Service Android au premier plan | Vérifier le comportement sur un appareil Android physique verrouillé. |
| Notification persistante | Ajouter les boutons d’action natifs pause/suivant dans une itération dédiée. |
| Adaptateur iOS | Respecter les contraintes d’audio et de tâches en arrière-plan propres à iOS. |
| Audio local et vibration | Version Web Audio/vibration incluse ; enrichir les profils sonores si nécessaire. |
| Confirmation manuelle | OK — l’intervalle attend « Valider l’intervalle ». |
| Saut du dernier repos | OK — option par atelier sur le dernier repos final. |
| Reprise après arrêt du processus | Persister l’état actif et recalculer la position au redémarrage. |
| Contrat Android d’intégration | Intents `OPEN_SESSION`, `START_SESSION`, export de résultat et lien profond. |
| Enveloppe desktop Tauri | Notifications et audio sur Windows/macOS/Linux. |
| Validation robuste des JSON | Refuser clairement les durées invalides, séances vides et schémas inconnus. |

## Fonctions volontairement exclues

- publicité et identifiants publicitaires ;
- abonnement, achat intégré et facturation ;
- compte obligatoire et synchronisation cloud ;
- Facebook, analytics commerciaux et suivi utilisateur.

## Tests actuels

- moteur : 6 tests passés ;
- build TypeScript/Vite : réussi ;
- test de la voix réelle : à compléter sur Android/iOS avec les moteurs TTS installés ;
- build APK Android debug : réussi ; test écran verrouillé sur appareil physique à effectuer.
