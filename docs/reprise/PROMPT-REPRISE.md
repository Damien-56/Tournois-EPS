# Prompt de reprise — Tournois EPS

Tu reprends le développement de l’application **Tournois EPS**.

Commence par lire intégralement :

- `docs/reprise/CONTEXTE.md`
- `README.md`
- `AUDIT-FONCTIONNALITES.md`
- `RESEAU-LOCAL.md`

Le projet se trouve dans :

`D:\Documents local\ChatGPT\récupération APK - REA\tournois-eps`

Travaille sur la branche Git : `codex/tournois-eps-parite`.

Objectif : poursuivre une application indépendante de tournoi EPS, locale et intégrable, avec une tablette maître et des tablettes clientes sur Wi-Fi local. Le mode autonome doit rester fonctionnel.

Avant toute modification :

1. vérifie `git status` et la branche courante ;
2. inspecte l’architecture actuelle et les tests existants ;
3. identifie précisément la fonctionnalité à améliorer ;
4. propose une courte liste d’actions puis implémente-la sans attendre une validation supplémentaire si elle reste dans le périmètre ci-dessus.

Après modification :

1. lance `npm run test -- --run` ;
2. lance `npm run build` ;
3. si le code Android ou les assets changent, lance `npm run mobile:sync` puis `android\\gradlew.bat assembleDebug` ;
4. installe l’APK sur le périphérique ADB `nrrki79xy9bihipb` si celui-ci est connecté ;
5. vérifie les logs Android et résume clairement les résultats ;
6. mets à jour la documentation de reprise si l’architecture ou les commandes changent.

Contraintes impératives : pas de publicité, abonnement, paiement, compte obligatoire, Firebase ou analytics commercial. Préserve les données locales et le format JSON. Toute amélioration réseau doit rester compatible avec le fonctionnement hors Internet et gérer les pertes de Wi-Fi de manière sûre.
