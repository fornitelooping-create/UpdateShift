# Lancer EchoTalk avec Electron + Vite

## 1. Installer les dépendances

`package.json` contient déjà le champ `"main"`, les scripts `electron:*` et les `devDependencies` Electron (déjà fusionnés). Il suffit d'installer :

```bash
npm install
```

## 2. Note sur le format des fichiers Electron

`electron/main.cjs` et `electron/preload.cjs` sont en `.cjs` (CommonJS, avec `require`) alors que le reste du projet est en ESM (`"type": "module"` dans `package.json`, utilisé par `eslint.config.js`, `postcss.config.js`, etc.). L'extension `.cjs` permet à Node/Electron de charger ces deux fichiers en CommonJS sans changer le mode du reste du projet.

## 3. Lancer en mode développement (hot-reload)

```bash
npm run electron:dev
# Vite démarre sur :5173, Electron charge cette URL automatiquement
```

## 4. Build production

```bash
npm run electron:build
# Build Vite → dist/, puis electron-builder → dist-electron/
```

## 5. Tester le build sans packager

```bash
npm run electron:preview
```

## Notes

- `vite.electron.config.js` utilise `base: "./"` requis pour les chemins relatifs en `file://`.
- `electron/main.cjs` autorise le micro sans popup navigateur.
- Le build Mac génère un `.dmg` universel (x64 + arm64).
