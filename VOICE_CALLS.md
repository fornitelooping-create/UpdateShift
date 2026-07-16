# Appels vocaux (MP)

Les appels vocaux entre deux comptes différents ont besoin d'un petit
serveur de **signalisation** : il ne transporte aucun son, il sert juste
d'intermédiaire pour que les deux appareils échangent les informations
nécessaires (offre/réponse WebRTC + candidats ICE) et établissent ensuite
une connexion **directe** entre eux. Une fois l'appel démarré, l'audio ne
passe plus par ce serveur.

## 1. Lancer le serveur de signalisation

Sur une machine accessible par les deux appareils qui veulent s'appeler
(par exemple ton PC, ou un petit serveur/VPS) :

```bash
cd signaling-server
npm install
npm start
```

Ça affiche `Shift signaling server listening on ws://0.0.0.0:8080`.

- **Même réseau Wi-Fi/local** : utilise l'adresse IP locale de la machine qui
  héberge le serveur, ex. `ws://192.168.1.10:8080`. Trouve-la avec
  `ipconfig` (Windows) ou `ifconfig`/`ip a` (Mac/Linux).
- **Appareils sur des réseaux différents** (ex. deux maisons différentes) :
  il faut héberger ce serveur quelque part de joignable publiquement (un
  petit VPS, ou rediriger le port 8080 sur ta box) et utiliser son adresse
  publique. Ce n'est pas configuré automatiquement — c'est à toi de choisir
  où l'héberger.

## 2. Configurer l'app

Dans **Paramètres utilisateur → Audio**, section "Serveur d'appel", entre
l'adresse `ws://...` du serveur et clique sur Enregistrer. **Fais ça sur
les DEUX appareils**, avec la même adresse. Un point vert/rouge indique si
l'app est bien connectée au serveur.

## 3. Appeler quelqu'un

Ouvre une conversation privée 1:1 (pas un groupe pour l'instant) et clique
sur l'icône téléphone en haut du chat. L'autre personne voit une bannière
d'appel entrant en haut de son écran, où qu'elle soit dans l'app.

## Limites connues

- **1:1 uniquement** pour l'instant, pas d'appel de groupe.
- **Pas de serveur TURN** configuré (seulement un serveur STUN public
  Google). Ça suffit dans la grande majorité des cas, mais certains réseaux
  très restrictifs (proxy d'entreprise strict, certains réseaux mobiles)
  peuvent empêcher la connexion directe. Un serveur TURN réglerait ça mais
  demande une infra supplémentaire (ex. [coturn](https://github.com/coturn/coturn)).
- Si les deux apps ne sont pas connectées au **même** serveur de
  signalisation au **même moment**, l'appel ne peut pas s'établir.
