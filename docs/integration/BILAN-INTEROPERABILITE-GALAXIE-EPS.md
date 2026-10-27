# Bilan directeur — interopérabilité de la galaxie EPS

## 1. Correction structurante

La première analyse plaçait Gestion SNS comme source centrale de toute la galaxie.
Cette lecture est corrigée.

Le **Tableau de bord EPS** est l’application de synthèse de la galaxie. C’est elle qui
doit connaître les résultats et les événements produits par les applications spécialisées
afin de compléter :

- la fiche élève ;
- la fiche classe ;
- les activités pratiquées ;
- les résultats ;
- les compétences et observations ;
- les présences et participations ;
- l’historique EPS global.

Gestion SNS reste une application spécialisée. Elle fournit les données propres aux
élèves, classes, groupes et séances SNS, mais elle n’a pas besoin de connaître les
résultats de tournois, de CrossScan ou de course d’orientation.

## 2. Applications concernées

| Application | Identifiant commun | Rôle principal |
|---|---|---|
| Tableau de bord EPS | `tableau-de-bord-eps` | synthèse élève/classe et agrégation EPS |
| Gestion SNS | `gestion-sns` | élèves, classes, groupes et données natation |
| Course d’orientation | `course-orientation` | cartes, balises, parcours et résultats d’orientation |
| Cross Scan | `crossscan` | événements, participants, arrivées et classements de cross |
| Tournois sport collectif | `tournois-sport-collectif` | équipes, matchs et résultats collectifs |
| Tournois sport individuel | `tournois-sport-individuel` | tournois, matchs et résultats individuels |
| Intervalle EPS | `intervalle-eps` | séances chronométrées et participation aux ateliers |
| Acrosport EPS | `acrosport-eps` | figures, séquences, groupes et évaluations d’acrosport |

Le tableau de bord EPS est donc bien dans le périmètre fonctionnel, même si son dépôt
GitHub n’a pas encore été identifié dans l’inventaire réalisé.

## 3. Direction des échanges

Le schéma cible est le suivant :

```text
Gestion SNS ───────────────┐
Course d’orientation ──────┤
Cross Scan ────────────────┤
Tournois collectif ────────┤──> Tableau de bord EPS
Tournois individuel ───────┤    fiche élève / fiche classe
Intervalle EPS ────────────┤    historique / synthèse
Acrosport EPS ─────────────┘
```

Les applications spécialisées publient leurs propres données. Le tableau de bord les
consomme et les normalise dans ses fiches. Une application spécialisée ne doit pas
avoir à connaître les résultats détaillés des autres disciplines, sauf besoin métier
explicitement identifié.

## 4. Appels et présence

L’appel est une donnée transversale.

Deux usages doivent être compatibles :

1. l’appel est fait dans le tableau de bord EPS, puis transmis aux applications de la
   séance ;
2. l’appel est fait dans une application spécialisée, puis obligatoirement transmis au
   tableau de bord EPS.

Le tableau de bord conserve la synthèse officielle de présence et de participation.
L’application spécialisée conserve éventuellement son état de séance détaillé.

Chaque changement d’appel doit comporter :

```json
{
  "studentId": "student-123",
  "classId": "class-5e-a",
  "sessionId": "session-2026-10-27",
  "status": "present",
  "sourceApp": "crossscan",
  "revision": 4,
  "changedAt": "2026-10-27T15:00:00.000Z"
}
```

Il ne faut pas faire circuler uniquement un nom d’élève. L’identifiant stable est
obligatoire pour éviter les doublons et homonymies.

## 5. Responsabilités par application

### Tableau de bord EPS

Publie :

- `eps-context` : établissement, classe, groupe, activité, séance ;
- `student-sheet` : fiche élève consolidée ;
- `class-sheet` : fiche classe consolidée ;
- `attendance` : état officiel de présence pour la séance.

Consomme :

- roster et données élèves de Gestion SNS ;
- événements et résultats de CrossScan ;
- parcours et résultats de Course d’orientation ;
- résultats des tournois collectifs et individuels ;
- séances et participations d’Intervalle EPS ;
- évaluations et observations d’Acrosport EPS.

Le tableau de bord ne remplace pas les données détaillées des applications spécialisées.
Il conserve une copie normalisée, historisée et exploitable dans les fiches.

### Gestion SNS

Publie :

- `sns-roster` : élèves, classes, groupes et identifiants stables ;
- `sns-session` : séances et données propres à la natation ;
- `attendance` si l’appel est réalisé dans Gestion SNS ;
- validations et attestations SNS.

Consomme :

- le contexte de séance utile à SNS ;
- éventuellement l’état de présence retourné par le tableau de bord.

Gestion SNS ne consomme pas les résultats de tournois, de CrossScan ou d’orientation.

### Course d’orientation

Publie :

- `orientation-course` : carte, balises, parcours et niveaux ;
- `orientation-result` : temps, parcours réalisés, pénalités et résultats ;
- `attendance` si l’appel est réalisé dans l’application.

Consomme :

- classes, élèves et groupes ;
- contexte de séance ;
- appel de la séance.

### Cross Scan

Publie :

- `cross-event` : événement et courses ;
- `cross-result` : participants, temps, arrivées et classements ;
- `attendance` si l’appel est réalisé dans CrossScan.

Consomme :

- roster élèves/classes ;
- groupes et contexte de l’événement ;
- état d’appel du tableau de bord.

### Tournois sport collectif

Publie :

- `team-tournament` : équipes, matchs, terrains et règles ;
- `team-result` : scores, classement, arbitrage et statistiques ;
- `attendance` si l’appel est réalisé dans l’application.

Consomme :

- élèves, classes, groupes ;
- constitution des équipes ;
- appel ;
- contexte de séance.

### Tournois sport individuel

Publie :

- `individual-tournament` ;
- `individual-result` ;
- matchs, scores, classements, badges et statistiques ;
- `attendance` si l’appel est réalisé dans l’application.

Consomme :

- élèves, classes, groupes ;
- appel ;
- contexte de séance.

### Intervalle EPS

Publie :

- `interval-session` : ateliers, intervalles, durées et réglages ;
- `interval-participation` : participation et observations de séance ;
- `attendance` si l’appel est réalisé dans l’application.

Consomme :

- classes, élèves et groupes ;
- contexte de séance ;
- appel.

### Acrosport EPS

Publie :

- `acro-catalog` : figures, niveaux, formations et consignes ;
- `acro-session` : composition de groupes et séquences ;
- `acro-evaluation` : critères, observations et évaluations ;
- `attendance` si l’appel est réalisé dans l’application.

Consomme :

- élèves, classes et groupes ;
- appel ;
- contexte de séance.

## 6. Synchronisation sur une seule tablette ou un seul PC

La synchronisation ne nécessite pas de tâche en arrière-plan.

Toutes les PWA étant publiées sous le domaine commun GitHub Pages de l’utilisateur,
elles pourront partager une couche locale `eps-galaxy` dans le navigateur :

```text
IndexedDB : eps-galaxy
BroadcastChannel : eps-galaxy-events
```

À l’ouverture :

1. l’application s’enregistre avec son identifiant et ses capacités ;
2. elle lit les événements depuis son dernier curseur ;
3. elle demande les données nécessaires au tableau de bord ou aux fournisseurs concernés ;
4. elle applique les nouvelles versions dans son cache local ;
5. elle publie ses propres nouveautés dans la file d’événements.

Le `BroadcastChannel` accélère la mise à jour lorsque deux applications sont ouvertes.
La file d’événements garantit la récupération au prochain démarrage lorsqu’une
application était fermée.

Les applications ne lisent jamais directement le `localStorage` ou l’IndexedDB interne
d’une autre application. Elles utilisent uniquement l’adaptateur commun et des ressources
normalisées.

## 7. Identifiants et versionnement

Les entités transversales doivent posséder des identifiants stables :

- `studentId` ;
- `classId` ;
- `groupId` ;
- `sessionId` ;
- `eventId` ;
- `activityId` ;
- `resultId`.

Une modification doit comporter une révision monotone ou un identifiant d’événement
unique. Les applications doivent pouvoir rejouer un événement sans créer de doublon.

La version 1 du contrat est additive :

- les nouveaux champs sont optionnels ;
- les champs inconnus sont ignorés ;
- un champ obligatoire ne peut pas être supprimé ou renommé ;
- une rupture impose une version majeure et un outil de migration ;
- le tableau de bord doit conserver un historique des versions reçues.

## 8. Ce qui est déjà disponible et ce qui manque

Déjà identifié :

- Tournois EPS possède un premier contrat `eps.interop-envelope` ;
- Intervalle EPS possède un contrat `eps.interop-envelope` et `interval-session` ;
- CrossScan possède un versionnement interne et des migrations de sauvegardes ;
- Gestion SNS possède un modèle riche d’élèves, classes, groupes et fusion ;
- Course d’orientation possède un modèle riche de cartes et parcours ;
- Acrosport possède un catalogue versionné et migrable.

Manques prioritaires :

1. identifier ou créer le dépôt du Tableau de bord EPS ;
2. créer le dépôt de Tournois sport collectif ;
3. créer le dépôt GitHub d’Acrosport EPS ;
4. définir les identifiants stables communs ;
5. définir le schéma des fiches élève et classe du tableau de bord ;
6. créer le projet séparé de communication EPS ;
7. fournir une bibliothèque d’interopérabilité partagée ;
8. ajouter les fixtures et tests de compatibilité dans chaque application.

## 9. Décision d’architecture

Le projet de communication EPS doit être le lieu de définition du protocole et des
adaptateurs communs. Il ne doit pas devenir une application métier ni un cloud central.

Son rôle sera de fournir :

- le registre des applications ;
- les capacités ;
- les ressources et enveloppes versionnées ;
- la base locale partagée ;
- la file d’événements ;
- les curseurs de synchronisation ;
- les contrôles de doublons ;
- les migrations ;
- les tests de compatibilité.
