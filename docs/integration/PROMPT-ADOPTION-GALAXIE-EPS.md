# Prompt commun — interopérabilité de la galaxie EPS

À copier dans la conversation de développement de chaque application EPS.

```text
Tu développes une application de la galaxie EPS : [NOM DE L’APPLICATION].

Mets en place l’interopérabilité avec les autres applications en adoptant le contrat
commun `eps.interop-envelope` version 1, défini dans le projet Tournois sport individuel et dans
Intervalle EPS.

Contraintes impératives :
- l’application reste autonome, utilisable hors ligne et sans compte, publicité,
  abonnement, Firebase ou cloud commercial ;
- elle ne lit jamais le localStorage, IndexedDB ou les fichiers internes d’une autre
  application ;
- aucune donnée personnelle n’est envoyée automatiquement ; tout import, export ou
  chargement d’URL est déclenché et visible par l’utilisateur ;
- les données échangées utilisent une enveloppe JSON versionnée :
  `schema: "eps.interop-envelope"`, `version: 1`, avec `eventId`, `sourceApp`,
  `entityId`, `revision`, `schemaVersion`, `createdAt` et `payload` ;
- les échanges doivent rester indépendants du modèle interne de l’application.

Travail demandé :
1. Inspecte l’architecture actuelle avant de modifier le code.
2. Ajoute un adaptateur d’interopérabilité local, sans dépendance directe aux autres
   dépôts. Il doit créer, valider, importer et exporter des enveloppes EPS.
3. Implémente au moins la ressource naturelle de cette application parmi :
   la ressource naturelle de l’application, en utilisant les identifiants canoniques
   `studentId`, `classId`, `groupId`, `sessionId`, `eventId`, `resultId` et `activityId`.
4. Ajoute dans l’interface un import/export explicite par fichier JSON et, si pertinent,
   par URL HTTPS avec contrôle CORS et message d’erreur lisible.
5. Ne remplace pas les formats locaux existants : ajoute un convertisseur ou un adaptateur.
6. Ajoute des fixtures et tests de compatibilité : enveloppe valide, champs inconnus,
   version inconnue, données incomplètes et aller-retour import/export.
7. Ajoute une documentation indiquant les ressources produites/consommées et les champs
   garantis.

Règle de non-régression obligatoire :
- une mise à jour mineure ou corrective ne doit pas casser la lecture des enveloppes
  version 1 déjà publiées ;
- les nouveaux champs sont optionnels et ignorés par les anciennes versions ;
- ne supprime ni ne renomme un champ obligatoire en version 1 ;
- si une rupture est indispensable, publie une version 2 distincte, conserve la lecture
  de la version 1 pendant la transition et fournis un outil ou une commande de migration
  explicite ;
- ajoute un test automatisé qui empêche toute régression future du contrat.

Avant de terminer : lance les tests et le build web, vérifie l’import/export sur un exemple
réel, mets à jour le document d’interopérabilité et indique clairement les compatibilités
maintenues ainsi que les éventuelles migrations nécessaires.
```

## Règle commune de versionnement

La version 1 est évolutive uniquement par ajout de champs optionnels ou de nouvelles
ressources. Un consommateur doit ignorer les champs inconnus et refuser proprement une
version majeure inconnue.

Une rupture de structure impose :

1. une nouvelle version majeure (`version: 2`) ;
2. une lecture conservée de la version précédente pendant la transition, lorsque c’est
   techniquement possible ;
3. un convertisseur ou bouton « Migrer les échanges » ;
4. des fixtures v1 et v2 dans les tests ;
5. une note de migration dans la documentation et le journal des changements.

## Enveloppe minimale de référence

```json
{
  "schema": "eps.interop-envelope",
  "version": 1,
  "eventId": "interop-event-unique",
  "type": "event",
  "source": { "app": "nom-application", "version": "1.0.0" },
  "sourceApp": "nom-application",
  "target": { "app": "tableau-de-bord-eps" },
  "resource": "individual-result",
  "action": "upsert",
  "entityId": "result-123",
  "revision": 1,
  "schemaVersion": "2.0",
  "createdAt": "2026-10-27T12:00:00.000Z",
  "payload": {}
}
```

Les identifiants d’applications réservés sont : `tournois-sport-individuel`, `intervalle-eps`,
`crossscan`, `course-orientation`, `gestion-sns` et `tableau-de-bord-eps`.
L’ancien identifiant `tournois-eps` est uniquement accepté par les lecteurs legacy.
