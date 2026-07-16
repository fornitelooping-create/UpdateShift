// Lancé automatiquement avant chaque build (voir "prebuild" dans package.json).
// Écrit un identifiant de version basé sur la date/heure actuelle dans les
// deux fichiers que useAppUpdateCheck.js compare :
//   - src/lib/appVersion.js   (figé dans le JS au moment du build)
//   - public/version.json     (fichier statique, relu à chaque vérification)
//
// Comme les deux sont régénérés ensemble à CHAQUE build, ils sont toujours
// identiques juste après un déploiement. Le jour où un nouveau build est
// déployé pendant qu'un client a encore l'ancienne page ouverte, son
// appVersion.js (ancien) ne matchera plus le nouveau version.json -> le
// toast de mise à jour apparaît.

const fs = require("fs");
const path = require("path");

function pad(n) {
  return String(n).padStart(2, "0");
}

function buildVersionString() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  // Si le déploiement tourne dans un contexte git avec la variable
  // d'environnement du commit dispo (Vercel/Netlify la fournissent), on
  // l'ajoute pour avoir un identifiant encore plus précis.
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF || process.env.GITHUB_SHA;
  return commit ? `${stamp}-${commit.slice(0, 7)}` : stamp;
}

const version = buildVersionString();

const appVersionPath = path.join(__dirname, "..", "src", "lib", "appVersion.js");
const versionJsonPath = path.join(__dirname, "..", "public", "version.json");

const appVersionContent = `// Fichier généré automatiquement par scripts/bump-version.js à chaque build.
// Ne pas éditer à la main : ta prochaine build écrasera ce fichier.
export const CURRENT_VERSION = "${version}";
`;

fs.writeFileSync(appVersionPath, appVersionContent, "utf8");
fs.writeFileSync(versionJsonPath, JSON.stringify({ version }, null, 2) + "\n", "utf8");

console.log(`[bump-version] Nouvelle version de build : ${version}`);
