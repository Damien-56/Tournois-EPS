# Contrat d’interopérabilité — Tournois sport individuel

Tournois sport individuel adopte le contrat commun de la galaxie EPS défini avec
Intervalle EPS. Les applications restent autonomes, hors ligne et sans base centrale.
Un échange est déclenché explicitement par l’utilisateur au moyen d’un fichier JSON ou
d’une URL HTTPS.

## Enveloppe commune canonique

```json
{
  "schema": "eps.interop-envelope",
  "version": 1,
  "eventId": "interop-event-...",
  "type": "event",
  "source": { "app": "tournois-sport-individuel", "version": "0.1.0" },
  "sourceApp": "tournois-sport-individuel",
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

Règles communes :

- aucune application ne lit le stockage local d’une autre origine ;
- les données personnelles ne sont pas envoyées automatiquement ;
- l’utilisateur déclenche l’import ou autorise l’URL distante ;
- les champs inconnus sont ignorés et les versions majeures inconnues sont refusées ;
- les données métier du producteur restent indépendantes du stockage interne ;
- une même enveloppe ne doit être appliquée qu’une fois et une révision ancienne ne
  doit pas remplacer une révision plus récente.

`tournois-eps` est uniquement un identifiant de lecture legacy. Il est converti en
`tournois-sport-individuel` lors de la normalisation et n’est jamais émis par une
nouvelle enveloppe.

Une publication synchronisable utilise `action: "upsert"`. L’action `"export"` est
réservée à une demande explicite de fichier JSON.

## Correspondances de normalisation

| Ancien nom ou forme | Nom canonique | Règle |
|---|---|---|
| `tournois-eps` | `tournois-sport-individuel` | accepté uniquement à la lecture |
| `id` d’enveloppe | `eventId` | l’ancien champ est lu puis normalisé |
| `source.app` | `source.app` et `sourceApp` | l’ancienne enveloppe est lue puis normalisée |
| `targetApp` | `target.app` | l’ancien champ est lu puis normalisé |
| `id` d’élève | `studentId` | conversion au niveau du payload roster |
| `sns-roster` | ressource legacy lisible | aucune nouvelle émission |
| tournoi individuel | `individual-tournament` | ressource d’émission |
| résultat individuel | `individual-result` | ressource d’émission |
| présence | `attendance` | ressource d’émission |
| identifiant métier interne | `entityId` | identifiant stable à la frontière |
| numéro de version implicite | `revision` | révision positive, rejouable sans doublon |

Les identifiants transversaux utilisés dans les payloads sont `studentId`, `classId`,
`groupId`, `sessionId`, `eventId`, `resultId` et `activityId`. Les modèles métier
internes conservent leurs noms historiques lorsque cela évite une régression.

## Ressources

| Ressource | Usage |
|---|---|
| `individual-tournament` | tournoi, matchs, règles et classement individuel |
| `individual-result` | résultat, score, classement et statistiques individuelles |
| `attendance` | présence d’un élève pour une séance |

La ressource `sns-roster` reste acceptée uniquement en lecture pour les anciennes
données. Le roster lu peut contenir `id` comme alias legacy de `studentId`.

Exemple de payload normalisé :

```json
{
  "classId": "class-5e-a",
  "students": [
    { "studentId": "student-1", "name": "Camille", "level": 3, "status": "present" }
  ]
}
```

Dans les réglages, l’enseignant colle une URL HTTPS publiée par une application EPS.
L’application vérifie l’enveloppe versionnée, normalise les alias legacy, puis crée une
nouvelle classe locale après validation. Cette normalisation ne renomme pas les modèles
métier internes ni le stockage local existant.

Les prochaines applications partenaires doivent ajouter un petit adaptateur vers cette
enveloppe, sans copier leur base de données dans GitHub. Une URL GitHub Pages, un fichier
local ou un partage direct peuvent fournir l’échange ; aucun service commercial n’est
requis.

Le prompt prêt à copier pour l’adoption du contrat dans les autres projets est disponible
dans [PROMPT-ADOPTION-GALAXIE-EPS.md](PROMPT-ADOPTION-GALAXIE-EPS.md).

La répartition complète des responsabilités, la circulation des appels et le rôle du
tableau de bord sont détaillés dans [BILAN-INTEROPERABILITE-GALAXIE-EPS.md](BILAN-INTEROPERABILITE-GALAXIE-EPS.md).
