export type RoleId = string

export type Camp = 'village' | 'loups' | 'solo' | 'ambigu'

export type Frequence = 'premiere_nuit' | 'chaque_nuit' | 'une_nuit_sur_deux' | 'jamais_la_nuit'

/** Contraintes appliquées aux joueurs proposés dans une sélection. */
export type Contrainte =
  | 'vivant'
  | 'pas_soi_meme'
  | 'pas_meme_que_nuit_precedente'
  | 'pas_loup'
  | 'loup'
  | 'non_charme'
  | 'pas_victime_loups'

/** Conditions pour qu'une action soit proposée. */
export type Condition = 'potion_vie' | 'potion_mort' | 'infection_disponible' | 'grand_mechant_loup_actif'

/** Effet appliqué par le moteur quand l'action est validée. */
export type EffetAction =
  | 'amour'
  | 'modele'
  | 'camp_chien_loup'
  | 'flair'
  | 'protection'
  | 'voyance'
  | 'corbeau'
  | 'attaque_loups'
  | 'infection'
  | 'attaque_grand_mechant_loup'
  | 'attaque_loup_blanc'
  | 'potion_vie'
  | 'potion_mort'
  | 'charme'

export interface ActionDef {
  id: string
  type: 'joueurs' | 'oui_non' | 'choix'
  libelle: string
  effet: EffetAction
  /** Nombre de joueurs à désigner (type joueurs). */
  nombre?: number
  contraintes?: Contrainte[]
  /** `victimes_nuit` : uniquement les victimes de la nuit (après protection). */
  source?: 'joueurs' | 'victimes_nuit'
  /** Le narrateur peut choisir « personne ». */
  optionnel?: boolean
  disponibleSi?: Condition
  /** L'action n'apparaît qu'une fois cette autre action renseignée. */
  dependDe?: string
  options?: { valeur: string; libelle: string }[]
}

/** Déclencheurs gérés par le moteur de règles. */
export type EffetRole =
  | 'tir_a_la_mort'
  | 'survit_premiere_attaque'
  | 'gracie_au_vote'
  | 'tetanos'
  | 'elimine_si_egalite'
  | 'gagne_si_elimine_premier_vote'
  | 'grognement_ours'
  | 'devient_loup_si_modele_meurt'
  | 'prend_role_elimine'
  | 'perd_pouvoir_si_non'
  | 'actif_tant_qu_aucun_loup_mort'
  | 'gagne_seul'
  | 'gagne_si_tous_charmes'

export interface CompagnonDef {
  id: 'amoureux' | 'charmes'
  nom: string
  emoji: string
  phrase_reveil: string
  phrase_coucher: string
  description_courte: string
}

export interface RoleDef {
  id: RoleId
  nom: string
  emoji: string
  camp: Camp
  /** Compte comme loup pour la meute, le Renard, l'ours et la victoire. */
  estLoup?: boolean
  /** Se réveille avec la meute (identifié à l'étape des Loups-Garous). */
  reveilAvecLoups?: boolean
  /** Étape « meute » : la victime des loups est désignée ici. */
  meute?: boolean
  frequence: Frequence
  /** Rôle sans action de nuit mais réveillé la nuit 1 pour l'identifier. */
  identificationNuit1?: boolean
  ordre: number
  phrase_reveil: string
  phrase_coucher: string
  actions: ActionDef[]
  effets: EffetRole[]
  description_courte: string
  /** Quantités autorisées dans la préparation. */
  quantites: { max: number; permises?: number[] }
  /** Nécessite le placement en cercle (voisins). */
  requiertCercle?: boolean
  compagnon?: CompagnonDef
}

export type DeathCause =
  | 'loups'
  | 'grand_mechant_loup'
  | 'loup_blanc'
  | 'poison'
  | 'vote'
  | 'chagrin'
  | 'chasseur'
  | 'tetanos'
  | 'manuel'

export interface Player {
  id: string
  name: string
  /** Carte du joueur. `null` tant qu'elle n'est pas identifiée (mode progressif). */
  roleId: RoleId | null
  seat: number | null
  alive: boolean
  infected: boolean
  /** Enfant sauvage transformé ou Chien-loup ayant choisi la meute. */
  turnedWolf: boolean
  charmed: boolean
  death?: { turn: number; phase: Phase; cause: DeathCause }
}

export type NameMode = 'progressif' | 'cercle'

export interface GameConfig {
  playerCount: number
  /** Rôles choisis (hors Simples Villageois, complétés automatiquement). */
  roleCounts: Record<RoleId, number>
  nameMode: NameMode
  mayorEnabled: boolean
  /** Ordre d'appel personnalisé (ids de rôles). */
  order: RoleId[]
}

export type StepKind = 'role' | 'amoureux' | 'charmes' | 'villageois'

export interface NightStep {
  key: string
  kind: StepKind
  roleId: RoleId
}

export type SelectionValue = string[] | boolean | string | null

export interface NightState {
  number: number
  introDone: boolean
  steps: NightStep[]
  index: number
  protectedId: string | null
  wolfVictimId: string | null
  infection: boolean
  gmlVictimId: string | null
  lbVictimId: string | null
  savedId: string | null
  poisonedId: string | null
}

export type Phase = 'nuit' | 'matin' | 'jour' | 'fin'

export type AlertLevel = 'danger' | 'warning' | 'info' | 'success'

export type Alert =
  | { id: string; kind: 'info'; level: AlertLevel; emoji: string; title: string; text?: string }
  | { id: string; kind: 'death'; playerId: string; cause: DeathCause }
  | { id: string; kind: 'mayor_successor'; deadMayorId: string }
  | { id: string; kind: 'hunter_shot'; hunterId: string }
  | { id: string; kind: 'servant_choice'; servantId: string; targetId: string }
  | { id: string; kind: 'knight_target'; knightId: string }
  | { id: string; kind: 'bear' }

export type Winner =
  | 'village'
  | 'loups'
  | 'amoureux'
  | 'ange'
  | 'joueur_flute'
  | 'loup_blanc'
  | 'personne'

export interface LogEntry {
  turn: number
  phase: Phase
  text: string
}

export interface Powers {
  witchLife: boolean
  witchDeath: boolean
  infection: boolean
  foxLost: boolean
  guardLastId: string | null
  ravenTargetId: string | null
  wolfHasDied: boolean
  elderHitIds: string[]
  idiotRevealedIds: string[]
  villagePowersLost: boolean
  rustyTargetId: string | null
  votesHeld: number
}

export interface GameState {
  version: 1
  seed: number
  seq: number
  config: GameConfig
  players: Player[]
  phase: Phase
  turn: number
  night: NightState | null
  morning: { deaths: string[]; pendingAlerts: Alert[] } | null
  day: { mayorDone: boolean; voteDone: boolean } | null
  alerts: Alert[]
  lovers: [string, string] | null
  mayorId: string | null
  wildChild: { modelId: string | null; modelDied: boolean }
  powers: Powers
  winner: Winner | null
  log: LogEntry[]
}

export type VoteResult = { kind: 'player'; id: string } | { kind: 'none' } | { kind: 'tie' }

export type GameAction =
  | { type: 'START_NIGHT_INTRO' }
  | { type: 'IDENTIFY'; names: Record<RoleId, string[]> }
  | { type: 'ADD_PLAYER'; name: string }
  | { type: 'REVEAL_ROLE'; playerId: string; roleId: RoleId }
  | { type: 'COMPLETE_STEP'; selections: Record<string, SelectionValue> }
  | { type: 'ACK_MORNING' }
  | { type: 'RESOLVE_ALERT'; targetId?: string | null; accept?: boolean }
  | { type: 'ELECT_MAYOR'; playerId: string | null }
  | { type: 'VOTE'; result: VoteResult }
  | { type: 'START_NIGHT' }
  | { type: 'SET_ORDER'; order: RoleId[] }
  | { type: 'EDIT_PLAYER'; id: string; patch: PlayerPatch }

export interface PlayerPatch {
  name?: string
  roleId?: RoleId | null
  alive?: boolean
  infected?: boolean
  charmed?: boolean
  turnedWolf?: boolean
  mayor?: boolean
}
