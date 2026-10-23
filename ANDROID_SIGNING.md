# Signature Android stable

Les APK Android ne peuvent se mettre à jour que si elles utilisent la même clé de signature. Le workflow `.github/workflows/android-release.yml` attend ces secrets GitHub :

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Pour conserver la clé de l’APK actuellement installée sur ce poste, le fichier de clé Android local est généralement `C:\Users\<utilisateur>\.android\debug.keystore`, avec l’alias `androiddebugkey` et le mot de passe `android`. Exportez cette clé dans `ANDROID_KEYSTORE_BASE64` depuis une machine de confiance, puis renseignez les trois autres valeurs dans les secrets du dépôt GitHub. La clé ne doit jamais être commitée.

Pour publier une version, créez un tag supérieur, par exemple `v1.0.2`. GitHub Actions construira l’APK release et le déposera dans les artefacts du workflow.
