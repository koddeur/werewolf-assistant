# werewolf-assistant

Assistant du narrateur pour **Les Loups-Garous de Thiercelieux**. C'est une PWA mobile, utilisable 100 % hors ligne.

## Commandes

```bash
npm install
npm run dev      # serveur de développement
npm test         # tests du moteur de règles (Vitest)
npm run build    # build de production + service worker PWA
```

## Architecture

```
src/
  engine/              Moteur de règles pur (sans React), entièrement testable
    roles.ts           Configuration des rôles : ajouter un rôle = ajouter une entrée
    types.ts           Types de l'état de partie, des actions et des alertes
    engine.ts          Réducteur : nuits, résolution des morts, chaînes, vote
    selectors.ts       Calculs dérivés : choix valides, voisins, ours, renard…
    victory.ts         Conditions de victoire
    narration.ts       Phrases d'ambiance (plusieurs variantes par moment)
    engine.test.ts     Scénarios de règles
  store/GameContext    État + historique (annuler) + sauvegarde localStorage
  hooks/useWakeLock    Empêche la mise en veille pendant la partie
  screens/, components/  Interface (un écran = une étape)
```

L'état complet de la partie est sauvegardé dans `localStorage` après chaque action, avec un historique de 80 états pour le bouton « Annuler ».
