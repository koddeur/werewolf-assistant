/**
 * Phrases d'ambiance : plusieurs variantes par moment, tirées au hasard
 * (de façon stable pour une partie donnée, pour survivre à un rechargement).
 */
export const NARRATION = {
  tombee_nuit: [
    'Le soleil disparaît derrière les collines de Thiercelieux. Les volets se ferment, les bougies s’éteignent… Le village s’endort.',
    'La lune se lève, ronde et pâle. Au loin, un hurlement déchire le silence. Fermez les yeux, villageois, la nuit tombe.',
    'Le vent souffle dans les ruelles et fait grincer l’enseigne de l’auberge. Chacun rentre chez soi… Le village s’endort.',
    'Les dernières lanternes s’éteignent une à une. Dans la forêt, des yeux jaunes s’allument. Tout le monde ferme les yeux.',
    'Le clocher sonne minuit. Les chats se cachent, les chiens se taisent. C’est l’heure où les loups sortent… Fermez les yeux.',
  ],
  lever_jour: [
    'Le coq chante, le soleil réchauffe les toits de Thiercelieux. Villageois, réveillez-vous !',
    'Une brume légère flotte sur la place du village. Les portes s’ouvrent une à une… Réveillez-vous, et comptez-vous !',
    'Les oiseaux chantent comme si de rien n’était. Pourtant, quelque chose s’est passé cette nuit… Réveillez-vous !',
    'L’aube se lève, rose et froide. Le boulanger allume son four, et le village ouvre les yeux.',
    'Un rayon de soleil traverse les nuages. Le village se réveille, le cœur battant.',
  ],
  annonce_mort: [
    'Hélas ! Ce matin, on a retrouvé {nom} sans vie au bord du chemin.',
    'Un cri résonne sur la place : {nom} ne se réveillera plus.',
    'La porte de {nom} est restée grande ouverte toute la nuit… Le village pleure {nom}.',
    'Les traces de griffes ne mentent pas : {nom} a quitté ce monde.',
  ],
  personne_mort: [
    'Miracle ! Personne n’est mort cette nuit. Le village respire… pour l’instant.',
    'Tout le monde est là, sain et sauf. Mais les loups, eux, ont faim…',
    'Pas une seule victime cette nuit ! Quelqu’un veillerait-il sur le village ?',
  ],
  transformation: [
    'Dans l’ombre, un cœur se met à battre au rythme de la meute…',
    'Quelque part dans le village, des crocs poussent sous un sourire innocent.',
    'La lune a fait son œuvre : un nouveau loup rôde parmi vous.',
  ],
  vote: [
    'Le soleil est haut. Il est temps de débattre : qui, parmi vous, cache des crocs ?',
    'Le village se rassemble sous le vieux chêne. Accusez, défendez-vous… puis votez !',
    'Les esprits s’échauffent sur la place du marché. Qui sera banni aujourd’hui ?',
  ],
  victoire: [
    'Et c’est ainsi que s’achève cette histoire, à Thiercelieux…',
    'Le village de Thiercelieux se souviendra longtemps de cette partie.',
    'Rideau ! Les cartes peuvent enfin être retournées.',
  ],
} as const

export type NarrationKey = keyof typeof NARRATION

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function narrate(key: NarrationKey, seed: number, salt: string | number = '', vars: Record<string, string> = {}): string {
  const variants = NARRATION[key]
  const text = variants[hash(`${seed}:${key}:${salt}`) % variants.length]
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
}
