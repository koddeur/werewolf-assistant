# 🐺 werewolf-assistant

**Assistant du narrateur pour _Les Loups-Garous de Thiercelieux_.**

Le narrateur choisit les rôles de la partie. L'application lui fait ensuite appeler chaque rôle **dans le bon ordre, à chaque nuit**. Elle enregistre les actions et calcule elle-même toutes les conséquences : protections, potions, morts en chaîne, transformations, grognements de l'ours, conditions de victoire. Aucun pouvoir n'est oublié, et aucune règle n'est laissée au calcul du narrateur.

L'app vise d'abord **les jeunes narrateurs** qui ne connaissent pas l'ordre d'appel ni les règles fines par cœur. Avec elle, ils peuvent animer sans erreur une partie de 25 à 30 joueurs comptant beaucoup de rôles techniques. Ils n'ont qu'à lire et toucher l'écran.

C'est une **application web mobile (PWA)** :
- installable sur l'écran d'accueil ;
- **100 % hors ligne**, sans serveur ;
- pensée pour être utilisée d'une main, debout et dans le noir : thème sombre, gros boutons, texte très lisible.

---

## Sommaire

- [Fonctionnalités](#-fonctionnalités)
- [Utiliser l'application (guide du narrateur)](#-utiliser-lapplication-guide-du-narrateur)
- [Rôles disponibles](#-rôles-disponibles)
- [Installation et développement](#-installation-et-développement)
- [Déploiement](#-déploiement)
- [Architecture du code](#-architecture-du-code)
- [Ajouter ou modifier un rôle](#-ajouter-ou-modifier-un-rôle)
- [Choix de règles](#-choix-de-règles)

---

## ✨ Fonctionnalités

- **Une étape = un écran.** Chaque écran affiche :
  - le rôle à appeler, en très grand ;
  - la phrase à dire à voix haute ;
  - uniquement les choix valides ;
  - le résultat déjà calculé (« Kevin est Infect Père des Loups », « Renard : OUI »).
- **Alertes prioritaires.** Quand un effet se déclenche (Chasseur, Maire, Amoureux, Enfant sauvage, ours…), un écran rouge ou orange s'intercale. Il doit être validé avant de continuer.
- **Morts en chaîne** résolues une par une, avec un écran par conséquence.
- **Rôles morts appelés quand même** pour la forme, afin de ne rien révéler aux joueurs.
- **Sauvegarde automatique** après chaque action. Si le téléphone se verrouille ou si l'onglet se ferme, la partie reprend exactement où elle en était.
- **« ↶ Annuler »** revient sur la dernière action : une erreur de saisie ne casse jamais la partie.
- **Écran toujours allumé** pendant la partie (API Wake Lock).
- **Tableau des joueurs** toujours accessible :
  - rôle, vivant ou mort ;
  - badges : ❤️ Amoureux, 🛡️ protégé, 🐺 infecté, 👑 Maire, 🎶 charmé, modèle de l'Enfant sauvage… ;
  - correction manuelle en cas d'erreur.
- **Journal de la partie** nuit par nuit, et **récapitulatif de fin** (rôles de chacun, camp gagnant).
- **Narration** : plusieurs variantes de phrases d'ambiance par moment (tombée de la nuit, lever du jour, annonce d'une mort…), sur un ton de conte villageois.

---

## 📖 Utiliser l'application (guide du narrateur)

### 1. Préparer la partie

1. **Nombre de joueurs** (de 4 à 40).
2. **Rôles** : touche les cartes pour régler les quantités. Le compteur affiche « rôles attribués / joueurs ». Les places restantes sont complétées automatiquement en Simples Villageois.
3. **Options** :
   - **Maire** : avec ou sans. Sa voix compte double.
   - **Mode de certains rôles**, par exemple Cupidon :
     - *Classique* : Cupidon ne choisit les Amoureux qu'une fois ;
     - *Nouveaux Amoureux* : quand le couple est mort, Cupidon (s'il est vivant) en désigne un nouveau.
   - **Saisie des prénoms**, au choix :

     | Mode | Principe | Quand l'utiliser |
     |---|---|---|
     | ✍️ **Progressif** | Tu tapes les prénoms pendant la première nuit, rôle par rôle. | Pour démarrer vite. |
     | 📋 **Liste des joueurs** | Tu saisis tous les prénoms avant la partie. La nuit 1, tu n'as plus qu'à les **toucher** pour attribuer les rôles. | Pour ne rien taper dans le noir. |
     | 🪑 **Placement en cercle** | Comme la liste, mais dans l'ordre où les joueurs sont assis (sens des aiguilles d'une montre). | **Obligatoire** avec le Renard ou le Montreur d'ours, qui dépendent des voisins. Recommandé avec le Chevalier. |

   - **Ordre d'appel** : l'ordre officiel est déjà réglé, mais tu peux le modifier avec les flèches ↑ ↓.

Pendant la saisie, l'app propose les prénoms déjà entrés, y compris ceux des parties précédentes.

### 2. La première nuit : reconnaissance *et* vrai tour de jeu

La première nuit, chaque rôle se réveille, se montre au narrateur et joue :
- 🏹 **Les Chasseurs sont appelés en tout premier, les yeux fermés.** Ils lèvent seulement la main, pour qu'à 2 Chasseurs ils ne puissent pas se reconnaître et s'innocenter.
- Les rôles sans action de nuit (Ancien, Idiot, Bouc émissaire…) se montrent juste au narrateur.
- À la fin de la reconnaissance, l'app demande les prénoms des **joueurs restants**, qui sont les Simples Villageois.
- **Les rôles qui ont besoin de connaître les cartes des autres jouent en dernier** (Voyante, Renard). Ils se montrent pendant la reconnaissance, puis agissent une fois que tout le monde est identifié.

À partir de la nuit 2, l'ordre habituel reprend.

### 3. La boucle de jeu

```
🌙 Nuit  →  🌅 Matin (annonce des morts + alertes)  →  ☀️ Jour (Maire au jour 1, vote)  →  🌙 Nuit suivante…
```

- **Nuit** : la barre du haut indique « Nuit 3 · étape 4/9 ». Lis la phrase en italique, touche les joueurs désignés, puis **« Terminé »**.
- **Matin** : l'app annonce « Ce matin, X est mort(e) » ou « Personne n'est mort cette nuit ». Viennent ensuite les alertes : successeur du Maire, tir du Chasseur, ours…
- **Jour** : élection du Maire le premier jour, puis saisie du résultat du vote (un joueur, « Personne » ou « Égalité »). L'écran rappelle les effets actifs : Corbeau +2, Idiot du village, Bouc émissaire, Ange au premier vote.
- **Fin** : l'app vérifie automatiquement les conditions de victoire et affiche le récapitulatif.

### 4. Les boutons du haut

| Bouton | Rôle |
|---|---|
| ↶ **Annuler** | Revient à l'état précédent (jusqu'à 80 actions). |
| 👥 **Joueurs** | Tableau des joueurs, badges, correction manuelle. |
| 📜 **Journal** | Chronologie de toutes les actions, nuit par nuit. |
| ⚙️ **Réglages** | Ordre d'appel des nuits suivantes, abandon de la partie. |

> 💡 Pour une erreur récente, préfère **Annuler** à la correction manuelle : la correction ne déclenche aucune conséquence (pas de chagrin, pas de tir…).

---

## 🃏 Rôles disponibles

| Camp | Rôles |
|---|---|
| 🏡 Village | Simple Villageois, Voyante, Sorcière, Salvateur, Chasseur (×2 possible), Cupidon, Petite fille, Ancien, Idiot du village, Chevalier à l'épée rouillée, Bouc émissaire, Servante dévouée, Renard, Corbeau, Montreur d'ours, Enfant sauvage, Sœurs (2 ou 3), Frères (3) |
| 🐺 Loups | Loup-Garou, Infect Père des Loups, Grand Méchant Loup |
| 🎭 Solitaires | Ange, Joueur de flûte, Loup Blanc |
| ⚖️ Au choix | Chien-loup |

---

## 🛠️ Installation et développement

Prérequis : **Node.js 20+** et npm.

```bash
git clone https://github.com/koddeur/werewolf-assistant.git
cd werewolf-assistant
npm install
npm run dev
```

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement. Ajoute `-- --host` pour l'ouvrir depuis un téléphone du même réseau Wi-Fi. |
| `npm test` | Tests unitaires du moteur de règles (Vitest). |
| `npm run test:watch` | Tests en mode surveillance. |
| `npm run lint` | Analyse du code (oxlint). |
| `npm run build` | Vérification TypeScript + build de production + service worker PWA dans `dist/`. |
| `npm run preview` | Sert le build de production en local. |

**Stack :** React 19, TypeScript (strict), Vite, Tailwind CSS 4, vite-plugin-pwa (Workbox), Vitest. Aucun backend.

---

## 🚀 Déploiement

L'application est un site **100 % statique** : on publie uniquement le contenu du dossier `dist/`.

1. `npm run build`
2. Envoie le **contenu** de `dist/` à la racine de l'hébergement (par exemple `public_html`).

Points d'attention :
- **HTTPS obligatoire** : le service worker (mode hors ligne), l'installation et le Wake Lock ne fonctionnent qu'en HTTPS.
- **Servir à la racine du domaine** (ou d'un sous-domaine). Pour un sous-dossier, il faut régler `base` dans `vite.config.ts` et le `start_url` du manifeste.
- **Ne pas mettre en cache** `sw.js`, `index.html` et `manifest.webmanifest`, sinon les mises à jour n'arrivent jamais. Les fichiers de `assets/` peuvent être mis en cache longtemps : leur nom contient un hash.
- **Un seul domaine** (avec ou sans `www`) : la sauvegarde est liée au domaine.
- Un déploiement Git qui copie le dépôt sans lancer le build **ne fonctionnera pas** : il faut publier le résultat du build.

---

## 🧱 Architecture du code

```
src/
├── engine/                 Moteur de règles PUR (aucune dépendance à React)
│   ├── roles.ts            ⭐ Configuration de tous les rôles
│   ├── types.ts            Types : état de partie, actions, alertes, rôles
│   ├── engine.ts           Réducteur : nuits, résolution des morts, chaînes, vote
│   ├── selectors.ts        Calculs dérivés : choix valides, voisins, ours, renard…
│   ├── victory.ts          Conditions de victoire
│   ├── narration.ts        Phrases d'ambiance (variantes tirées au hasard)
│   └── engine.test.ts      Scénarios de règles
├── store/
│   ├── GameContext.tsx     État + historique (Annuler) + sauvegarde localStorage
│   └── knownNames.ts       Prénoms mémorisés pour l'autocomplétion
├── hooks/useWakeLock.ts    Empêche la mise en veille de l'écran
├── components/             Briques d'interface (boutons, sélecteur de joueurs…)
├── screens/                Écrans : préparation, étape de nuit, alertes, jour, fin…
└── App.tsx                 Barre du haut + aiguillage vers l'écran courant
```

### Principes

- **Le moteur est une fonction pure** : `gameReducer(état, action) → nouvel état`. Tout le jeu est donc testable sans interface, et l'annulation revient simplement à garder les états précédents.
- **Les rôles sont pilotés par la donnée.** Les écrans ne connaissent aucun rôle en dur : ils affichent ce que décrit `roles.ts` (phrases, sélections à faire, contraintes).
- **Les alertes forment une file.** Chaque mort ajoute ses conséquences en tête de file (successeur du Maire, chagrin de l'Amoureux, tir du Chasseur). L'interface affiche toujours la première alerte avant tout le reste.
- **L'état complet est sauvegardé** dans `localStorage` après chaque action, avec l'historique pour « Annuler ».

### Tests

```bash
npm test
```

Les tests couvrent notamment :
- les loups qui attaquent le joueur protégé ;
- la Sorcière qui ne voit pas une victime protégée ;
- la règle du Salvateur (jamais deux fois de suite le même joueur) ;
- la mort du modèle de l'Enfant sauvage ;
- le Chasseur qui tue un Amoureux ;
- les deux Chasseurs ;
- le Maire tué la nuit ;
- l'infection par l'Infect Père ;
- le Renard qui perd son pouvoir, avec recalcul des voisins ;
- les potions de la Sorcière, l'Ancien, l'Ange, l'Idiot, le Bouc émissaire, le tétanos du Chevalier, l'ours, le Grand Méchant Loup ;
- les deux modes de Cupidon ;
- le tour de reconnaissance et les modes de saisie des prénoms ;
- la victoire du village.

---

## ➕ Ajouter ou modifier un rôle

**Ajouter un rôle = ajouter une entrée dans `src/engine/roles.ts`.** Exemple simplifié :

```ts
{
  id: 'voyante',
  nom: 'Voyante',
  emoji: '🔮',
  camp: 'village',                 // village | loups | solo | ambigu
  frequence: 'chaque_nuit',        // premiere_nuit | chaque_nuit | une_nuit_sur_deux | jamais_la_nuit
  ordre: 120,                      // position par défaut dans l'ordre d'appel
  phrase_reveil: 'Voyante, réveille-toi. Désigne le joueur dont tu veux connaître l’identité.',
  phrase_coucher: 'Voyante, rendors-toi.',
  actions: [
    { id: 'cible', type: 'joueurs', libelle: 'Joueur sondé', effet: 'voyance',
      nombre: 1, contraintes: ['vivant', 'pas_soi_meme'] },
  ],
  effets: [],                      // déclencheurs : tir_a_la_mort, survit_premiere_attaque…
  description_courte: 'Découvre chaque nuit la carte d’un joueur.',
  quantites: { max: 1 },
  apresReconnaissance: true,       // nuit 1 : se montre, puis joue en dernier
}
```

Champs optionnels utiles :

| Champ | Effet |
|---|---|
| `estLoup` / `reveilAvecLoups` | Compte comme loup / se réveille avec la meute. |
| `identificationNuit1` | Rôle sans action de nuit, qui se montre la nuit 1. |
| `apresReconnaissance` + `phrase_reconnaissance` | Nuit 1 : se montre, puis agit une fois tout le monde identifié. |
| `yeuxFermes` | Appelé sans ouvrir les yeux : il lève la main (Chasseur). |
| `nom_pluriel`, `phrase_reveil_pluriel`, `phrase_coucher_pluriel` | Textes utilisés quand plusieurs cartes sont en jeu. |
| `requiertCercle` | Impose le placement en cercle (voisins). |
| `compagnon` | Étape qui suit le rôle (Amoureux après Cupidon, charmés après le Joueur de flûte). |
| `variantes` | Modes de règle choisis à la préparation, chacun pouvant ajouter des effets (ex. Cupidon). |
| `quantites.permises` | Quantités autorisées (ex. Sœurs : 2 ou 3). |

Un rôle qui réutilise des **actions** (`effet`) et des **déclencheurs** (`effets`) existants ne demande aucun autre code. Une mécanique vraiment nouvelle demande d'ajouter son effet dans `engine.ts`, puis un test dans `engine.test.ts`.

---

## ⚖️ Choix de règles

Certaines règles varient selon les tables. Voici celles appliquées par l'app :

- **Infect Père** :
  - l'infection est proposée une fois par partie ;
  - la victime devient loup en secret et garde son pouvoir ;
  - si la cible était protégée par le Salvateur, l'infection échoue, mais le pouvoir est consommé, pour ne rien trahir.
- **Voyante** : elle voit la carte d'origine, donc un joueur infecté apparaît avec son rôle de village.
- **Sorcière** : on lui montre la victime **déjà corrigée** par la protection du Salvateur. Si la victime était protégée, il n'y a rien à sauver et aucune potion n'est gaspillée.
- **Ancien** : il survit à la première attaque des loups. S'il est tué par le village (vote, Sorcière, Chasseur), les villageois perdent leurs pouvoirs.
- **Chevalier** : s'il est dévoré, le premier loup à sa gauche meurt la nuit suivante. « À gauche » correspond au joueur suivant dans le sens des aiguilles d'une montre.
- **Loup Blanc** : il joue les nuits paires et gagne s'il est le dernier survivant.
- **Montreur d'ours** : l'ours grogne si un voisin vivant est un loup (infectés compris), ou si le Montreur lui-même est infecté.
- **Ange** : il gagne seul s'il est éliminé au tout premier vote du village.
