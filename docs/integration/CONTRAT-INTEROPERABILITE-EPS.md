# Contrat d’interopérabilité EPS

Tournois EPS adopte le contrat commun de la galaxie EPS défini avec Intervalle EPS.
Les applications restent autonomes, hors ligne et sans base centrale. Un échange est
déclenché explicitement par l’utilisateur au moyen d’un fichier JSON ou d’une URL HTTPS.

## Enveloppe commune

```json
{
  "schema": "eps.interop-envelope",
  "version": 1,
  "id": "eps-interop-...",
  "type": "data",
  "source": { "app": "gestion-sns", "version": "1.0.0" },
  "target": { "app": "tournois-eps" },
  "resource": "sns-roster",
  "action": "export",
  "createdAt": "2026-10-27T12:00:00.000Z",
  "payload": {}
}
```

Règles communes :

- aucune application ne lit le stockage local d’une autre origine ;
- les données personnelles ne sont pas envoyées automatiquement ;
- l’utilisateur déclenche l’import ou autorise l’URL distante ;
- les champs inconnus sont ignorés et les versions majeures inconnues sont refusées ;
- les données métier du producteur restent indépendantes du stockage interne.

## Ressources utiles à Tournois EPS

| Ressource | Producteur naturel | Usage |
|---|---|---|
| `sns-roster` | Gestion SNS | créer une classe à partir d’un groupe sélectionné |
| `eps-context` | Tableau de bord EPS | transmettre une classe ou un contexte de séance |
| `cross-event` | CrossScan | future liaison entre un événement et un tournoi |
| `orientation-course` | Course d’orientation | future liaison entre une course et un tournoi |
| `interval-session` | Intervalle EPS | conserver le contexte temporel d’une séance |

Le premier adaptateur Tournois EPS accepte `sns-roster` et `eps-context` contenant :

```json
{
  "className": "5e A",
  "students": [
    { "id": "eleve-1", "name": "Camille", "level": 3, "status": "present" }
  ]
}
```

Dans les réglages, l’enseignant colle une URL HTTPS publiée par une application EPS.
Tournois EPS vérifie l’enveloppe, n’accepte que le contrat versionné, puis crée une
nouvelle classe locale après validation. Le fichier JSON de sauvegarde Tournois EPS et
le bridge `window.epsTournois` restent disponibles pour les échanges complets explicitement
demandés.

Les prochaines applications partenaires doivent ajouter un petit adaptateur vers cette
enveloppe, sans copier leur base de données dans GitHub. Une URL GitHub Pages, un fichier
local ou un partage direct peuvent fournir l’échange ; aucun service commercial n’est requis.

Le prompt prêt à copier pour l’adoption du contrat dans les autres projets est disponible
dans [PROMPT-ADOPTION-GALAXIE-EPS.md](PROMPT-ADOPTION-GALAXIE-EPS.md).
