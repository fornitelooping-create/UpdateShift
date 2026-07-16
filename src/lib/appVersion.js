// Version de build embarquée dans le bundle JS. Doit être bumpée à CHAQUE
// déploiement, en même temps que la même valeur dans public/version.json.
//
// Comment ça marche :
// - Ce fichier est importé et figé dans le JS au moment du build (donc les
//   clients qui ont déjà l'app ouverte gardent l'ancienne valeur en mémoire).
// - public/version.json est un simple fichier statique, re-téléchargé à
//   chaque vérification (sans cache) : il reflète toujours la dernière
//   version réellement déployée sur le serveur.
// - useAppUpdateCheck() compare les deux : si elles diffèrent, ça veut dire
//   qu'un nouveau déploiement a eu lieu pendant que l'utilisateur avait
//   l'app ouverte -> on propose de recharger.
//
// À chaque déploiement : change cette valeur ET celle de public/version.json
// (le plus simple est d'utiliser la date + un compteur, ou un hash de commit).
export const CURRENT_VERSION = "2026.07.14-1";
