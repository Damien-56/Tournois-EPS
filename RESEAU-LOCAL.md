# Architecture réseau local

## Principe

Le réseau local est optionnel. En mode autonome, aucune connexion n’est ouverte. En mode maître, l’application Android démarre un petit serveur HTTP local sur le port `8765` et publie l’état JSON de la séance. Les clientes lisent `/state` et transmettent les résultats à `/action`.

```text
                 Wi‑Fi local uniquement
   tablette cliente  ───────┐
   tablette cliente  ───────┼──> tablette maître
   tablette cliente  ───────┘      ├── état canonique
                                   └── file d’actions
```

La tablette maître reste la seule autorité : elle déduplique les matchs par identifiant et réémet l’état après chaque action. Le QR contient un jeton aléatoire de séance ; les requêtes sans ce jeton sont refusées. La perte du Wi‑Fi ne détruit pas les données du maître, qui restent dans son stockage local.

## Utilisation prévue

1. Connecter toutes les tablettes au même point d’accès Wi‑Fi, sans exiger Internet.
2. Ouvrir Tournois EPS sur la tablette enseignant.
3. Choisir « Démarrer comme maître ».
4. Scanner le QR code affiché par la tablette maître, ou saisir son adresse locale.
5. Les clientes rejoignent la séance et saisissent les résultats ; le maître valide l’état partagé.

## Limites actuelles

- le QR code est affiché par la tablette maître ; la découverte automatique du maître (mDNS/NSD) reste à ajouter ;
- le jeton protège la séance pendant son fonctionnement, mais il faut régénérer la séance pour révoquer les anciennes tablettes ;
- le serveur local est intégré à l’enveloppe Android Capacitor ; en navigateur/PWA, le mode autonome reste disponible ;
- le serveur ne doit pas être exposé au-delà du réseau de séance.

## Contrat d’intégration

Les autres applications peuvent obtenir l’état courant avec `window.epsTournois.getSnapshot()`, importer un état avec `importSnapshot(snapshot)` et s’abonner à `onChange(listener)`. Le contrat reste indépendant du transport : stockage local, réseau local ou intégration directe produisent le même `TournamentStore`.
