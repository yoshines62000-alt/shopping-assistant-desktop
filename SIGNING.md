# Signer l'installeur (enlever l'avertissement SmartScreen) — #10

Par défaut, `Shopping Assistant Setup X.Y.Z.exe` n'est **pas signé** : au premier
lancement, Windows SmartScreen affiche *« Windows a protégé votre ordinateur »*
(il faut cliquer « Informations complémentaires » → « Exécuter quand même »).
Signer le binaire avec un certificat de **signature de code** fait disparaître cet
avertissement (immédiatement avec un certificat EV ; après un peu de réputation
avec un OV / Azure Trusted Signing).

> La build actuelle reste volontairement non signée tant qu'aucun certificat
> n'est fourni — **rien à changer** pour continuer à publier sans signature.
> Ce guide décrit quoi faire **le jour où tu obtiens un certificat**.

## Quel certificat choisir ?

| Option | Coût indicatif | Matériel | SmartScreen | Pour qui |
|--------|----------------|----------|-------------|----------|
| **Azure Trusted Signing** | ~2 $/mois + Azure | Aucun (cloud) | Réputation à bâtir | **Recommandé** aujourd'hui (le plus simple, pas de token USB) |
| Certificat **OV** (.pfx) | ~150–300 €/an | Token USB (récent) | Réputation à bâtir | Distribution modérée |
| Certificat **EV** | ~300–500 €/an | Token USB obligatoire | **Confiance immédiate** | Distribution large |

Pré-requis Azure Trusted Signing : avoir une **identité vérifiée** (entreprise, ou
particulier via « individual validation ») — la vérification prend quelques jours.

---

## Voie A — Certificat .pfx (OV) : **aucune config à changer**

`electron-builder` signe automatiquement si ces variables d'environnement sont
présentes au moment du `--publish` (il détecte `CSC_LINK` seul, pas besoin de
toucher `package.json`) :

```powershell
$env:CSC_LINK = 'C:\chemin\vers\certificat.pfx'   # ou le .pfx encodé en base64
$env:CSC_KEY_PASSWORD = '<mot de passe du .pfx>'
$env:GH_TOKEN = '<token GitHub>'                  # pour publier (cf. README)
npm run build:resources
npx electron-builder --win nsis --publish always
```

Si le certificat est sur un **token USB** (la plupart des OV/EV récents), le .pfx
n'est pas exportable : il faut signer via le **magasin de certificats Windows**.
Dans ce cas, ajoute dans `package.json` → `build.win` :

```json
"win": {
  "target": "nsis",
  "icon": "build/icon.ico",
  "signtoolOptions": {
    "certificateSubjectName": "Nom exact du sujet du certificat",
    "signingHashAlgorithms": ["sha256"]
  }
}
```

(branche le token, déverrouille-le, puis lance la build : `signtool` le trouvera
dans le magasin.)

---

## Voie B — Azure Trusted Signing (recommandé)

1. Crée une ressource **Trusted Signing** dans le portail Azure, un
   **Certificate Profile**, et donne le rôle *Trusted Signing Certificate Profile
   Signer* à un **App Registration** (service principal).
2. Renseigne l'authentification par variables d'environnement :

   ```powershell
   $env:AZURE_TENANT_ID     = '<tenant>'
   $env:AZURE_CLIENT_ID     = '<app id>'
   $env:AZURE_CLIENT_SECRET = '<secret>'
   $env:GH_TOKEN            = '<token GitHub>'
   ```

3. Ajoute dans `package.json` → `build.win` (à activer **seulement** quand le
   compte Azure est prêt) :

   ```json
   "win": {
     "target": "nsis",
     "icon": "build/icon.ico",
     "azureSignOptions": {
       "publisherName": "Ton nom vérifié",
       "endpoint": "https://weu.codesigning.azure.net",
       "codeSigningAccountName": "<nom du compte Trusted Signing>",
       "certificateProfileName": "<nom du profil de certificat>"
     }
   }
   ```

   (`endpoint` dépend de la région du compte — ex. `weu` = West Europe.)
4. Build + publication identiques :

   ```powershell
   npm run build:resources
   npx electron-builder --win nsis --publish always
   ```

---

## Vérifier que c'est signé

```powershell
Get-AuthenticodeSignature ".\dist_installer\Shopping Assistant Setup 0.2.0.exe" |
  Format-List Status, SignerCertificate
```

`Status` doit valoir **Valid**. (Clic droit sur le `.exe` → Propriétés →
*Signatures numériques* fonctionne aussi.)

## Notes

- **Ne commite jamais** le `.pfx` ni les secrets : utilise les variables
  d'environnement (ou les *secrets* GitHub Actions si #11 est débloqué).
- Une fois signé, pense à signer **chaque** release : l'auto-update
  (`electron-updater`) vérifie le `sha512` du `latest.yml`, pas la signature,
  mais un installeur non signé reverra l'avertissement SmartScreen à chaque
  mise à jour majeure.
