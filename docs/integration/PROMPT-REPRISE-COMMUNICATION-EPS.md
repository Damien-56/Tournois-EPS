# Prompt de reprise — projet Communication EPS

À utiliser pour créer le nouveau projet de la section EPS consacré à la communication
entre les applications.

```text
Tu reprends le développement du projet « Communication EPS ».

Objectif : créer la couche commune d’interopérabilité de la galaxie EPS. Cette couche ne
doit pas devenir une application métier ni un cloud central. Elle doit permettre aux
applications EPS de publier, lire et synchroniser des données locales normalisées lors
de leur ouverture, sans synchronisation en arrière-plan obligatoire.

Applications concernées :
- tableau-de-bord-eps ;
- gestion-sns ;
- course-orientation ;
- crossscan ;
- tournois-sport-collectif ;
- tournois-sport-individuel ;
- intervalle-eps ;
- acroeps-eps.

Principe directeur : le Tableau de bord EPS est l’application de synthèse. Il consomme
les résultats de toutes les applications spécialisées pour alimenter la fiche élève et
la fiche classe. Gestion SNS fournit ses données élèves/classes/groupes, mais n’a pas à
consommer les résultats de tournois, CrossScan ou course d’orientation.

L’appel est transversal : il peut être fait dans le tableau de bord ou dans une autre
application. Dans tous les cas, toute modification d’appel doit être transmise au tableau
de bord EPS, qui conserve la synthèse officielle.

Contraintes :
- fonctionnement hors ligne ;
- aucune publicité, abonnement, compte obligatoire, Firebase ou cloud commercial ;
- synchronisation à l’ouverture suffisante ;
- PC non indispensable ;
- compatibilité PWA PC/iOS/Android ;
- APK Android et enveloppes natives éventuelles en complément ;
- aucun accès direct au localStorage ou à l’IndexedDB interne d’une autre application ;
- les dépôts GitHub restent séparés mais les applications sont publiées sous le même
  domaine GitHub Pages lorsque cela est possible.

Travail à réaliser dans cet ordre :
1. lire intégralement le bilan d’interopérabilité fourni par l’utilisateur ;
2. inventorier les dépôts et les états réels des huit applications ;
3. localiser ou créer le dépôt du Tableau de bord EPS ;
4. localiser ou créer les dépôts Tournois sport collectif et Acrosport EPS ;
5. définir les identifiants stables communs : studentId, classId, groupId, sessionId,
   eventId, activityId et resultId ;
6. définir les fiches normalisées élève et classe du tableau de bord ;
7. définir les ressources et leurs propriétaires ;
8. définir l’enveloppe JSON versionnée `eps.interop-envelope` ;
9. créer une bibliothèque TypeScript commune ou un paquet partagé contenant le registre,
   le validateur, les événements, les curseurs, la déduplication et les migrations ;
10. créer des fixtures artificielles et des tests de compatibilité ;
11. seulement ensuite préparer les adaptateurs de chaque application.

Ressources minimales à spécifier :
- sns-roster ;
- sns-session ;
- eps-context ;
- attendance ;
- cross-event ;
- cross-result ;
- orientation-course ;
- orientation-result ;
- individual-tournament ;
- individual-result ;
- team-tournament ;
- team-result ;
- interval-session ;
- interval-participation ;
- acro-catalog ;
- acro-session ;
- acro-evaluation ;
- student-sheet ;
- class-sheet.

Synchronisation locale cible :
- IndexedDB commune `eps-galaxy` pour les PWA de même origine ;
- `BroadcastChannel("eps-galaxy-events")` lorsque plusieurs applications sont ouvertes ;
- journal d’événements persistant pour les applications fermées ;
- synchronisation par curseur à l’ouverture ;
- sourceApp, eventId, entityId, revision, createdAt et schemaVersion dans chaque événement ;
- rejeu idempotent et déduplication obligatoire ;
- fallback JSON/HTTPS ou réseau local lorsque les applications ne partagent pas la même
  origine Web.

Règles de propriété :
- chaque application reste propriétaire de ses données métier détaillées ;
- le tableau de bord conserve une copie normalisée et historisée pour les fiches ;
- aucune application spécialisée ne consomme des résultats qui ne lui sont pas utiles ;
- Gestion SNS ne consomme pas les résultats des autres activités ;
- l’appel est toujours remonté au tableau de bord ;
- aucune donnée ne doit être écrasée sans contrôle de révision.

Règles de non-régression :
- la version 1 est additive ;
- les champs inconnus sont ignorés ;
- les versions anciennes restent lisibles ;
- toute rupture crée une nouvelle version majeure ;
- une migration et des fixtures v1/v2 sont obligatoires ;
- les tests de compatibilité sont exécutés dans chaque dépôt et dans le projet commun.

Livrables attendus :
- spécification complète du protocole ;
- registre des applications et capacités ;
- schémas JSON ;
- bibliothèque TypeScript réutilisable ;
- adaptateur PWA même origine ;
- stratégie Android/iOS/desktop complémentaire ;
- fixtures artificielles ;
- tests de lecture, publication, synchronisation, déduplication et migration ;
- guide d’intégration par application ;
- matrice des compatibilités et procédure de mise à jour.

Ne modifie pas immédiatement les applications métier. Commence par l’audit, le schéma,
les règles de propriété et les tests de contrat. Toute décision qui pourrait modifier
les données élèves ou les fiches du tableau de bord doit être documentée avant codage.
```
