import { describe, expect, it } from 'vitest'
import { createGame, currentStep, gameReducer } from './engine'
import { defaultOrder, getRole } from './roles'
import {
  bearGrowls,
  roleTexts,
  candidates,
  isWolf,
  nightVictims,
  playerByName,
  stepActors,
  stepStatus,
} from './selectors'
import type { GameAction, GameState, RoleId, SelectionValue } from './types'

type Selections = Record<string, SelectionValue>

/** Partie en placement en cercle, chaque joueur ayant déjà son rôle. */
function setup(
  seating: [name: string, role: RoleId][],
  opts: { mayor?: boolean; variantes?: Record<RoleId, string> } = {},
): GameState {
  const roleCounts: Record<RoleId, number> = {}
  const names: Record<RoleId, string[]> = {}
  for (const [name, role] of seating) {
    if (role !== 'villageois') roleCounts[role] = (roleCounts[role] ?? 0) + 1
    ;(names[role] ??= []).push(name)
  }
  const s = createGame(
    {
      playerCount: seating.length,
      roleCounts,
      nameMode: 'cercle',
      mayorEnabled: opts.mayor ?? true,
      order: defaultOrder(),
      variantes: opts.variantes,
    },
    seating.map(([name]) => name),
    42,
  )
  return gameReducer(s, { type: 'IDENTIFY', names })
}

const run = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s)
const id = (s: GameState, name: string) => playerByName(s, name)!.id
const player = (s: GameState, name: string) => playerByName(s, name)!

/** Joue la nuit en cours : `inputs` est indexé par clé d'étape (id du rôle). */
function playNight(s: GameState, inputs: Record<string, Selections> = {}): GameState {
  s = gameReducer(s, { type: 'START_NIGHT_INTRO' })
  while (s.phase === 'nuit' && s.alerts.length === 0) {
    const step = currentStep(s)!
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: inputs[step.key] ?? {} })
  }
  return s
}

/** Joue une nuit puis annonce le matin. */
function nightAndMorning(s: GameState, inputs: Record<string, Selections> = {}): GameState {
  return gameReducer(playNight(s, inputs), { type: 'ACK_MORNING' })
}

/** Passe le jour sans éliminer personne et commence la nuit suivante. */
function quietDay(s: GameState): GameState {
  s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'none' } })
  while (s.alerts.length) s = gameReducer(s, { type: 'RESOLVE_ALERT' })
  return gameReducer(s, { type: 'START_NIGHT' })
}

const BASE: [string, RoleId][] = [
  ['Alice', 'loup_garou'],
  ['Bob', 'salvateur'],
  ['Chloé', 'villageois'],
  ['David', 'loup_garou'],
  ['Emma', 'sorciere'],
  ['Farid', 'villageois'],
  ['Gaël', 'voyante'],
  ['Hugo', 'villageois'],
]

describe('Salvateur', () => {
  it('les loups qui attaquent le joueur protégé ne tuent personne', () => {
    let s = setup(BASE)
    s = playNight(s, {
      salvateur: { protege: [id(s, 'Chloé')] },
      loup_garou: { victime: [id(s, 'Chloé')] },
    })
    expect(s.phase).toBe('matin')
    expect(s.morning!.deaths).toEqual([])
    expect(player(s, 'Chloé').alive).toBe(true)
  })

  it('la Sorcière ne voit pas la victime protégée, donc ne gaspille pas sa potion', () => {
    let s = setup(BASE)
    s = gameReducer(s, { type: 'START_NIGHT_INTRO' })
    while (currentStep(s)!.roleId !== 'sorciere') {
      const key = currentStep(s)!.key
      const selections: Selections =
        key === 'salvateur' ? { protege: [id(s, 'Chloé')] } : key === 'loup_garou' ? { victime: [id(s, 'Chloé')] } : {}
      s = gameReducer(s, { type: 'COMPLETE_STEP', selections })
    }
    expect(nightVictims(s)).toEqual([])
    expect(stepStatus(s, currentStep(s)!)).toBe('active')
    expect(s.powers.witchLife).toBe(true)
  })

  it('ne peut pas protéger le même joueur deux nuits de suite, mais peut se protéger lui-même', () => {
    let s = setup(BASE)
    s = nightAndMorning(s, { salvateur: { protege: [id(s, 'Chloé')] } })
    s = quietDay(s)
    const action = getRole('salvateur').actions[0]
    const names = candidates(s, action, [id(s, 'Bob')]).map((p) => p.name)
    expect(names).not.toContain('Chloé')
    expect(names).toContain('Bob')
  })
})

describe('Enfant sauvage', () => {
  it('devient loup au début de la nuit suivant la mort de son modèle', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'enfant_sauvage']])
    s = nightAndMorning(s, {
      enfant_sauvage: { modele: [id(s, 'Chloé')] },
      loup_garou: { victime: [id(s, 'Chloé')] },
    })
    expect(player(s, 'Chloé').alive).toBe(false)
    expect(s.wildChild.modelDied).toBe(true)
    expect(isWolf(player(s, 'Hugo'))).toBe(false)

    s = quietDay(s)
    expect(s.alerts[0]).toMatchObject({ kind: 'info', title: expect.stringContaining('Hugo') })
    expect(isWolf(player(s, 'Hugo'))).toBe(true)
    s = gameReducer(s, { type: 'RESOLVE_ALERT' })
    const pack = s.night!.steps.find((st) => st.roleId === 'loup_garou')!
    expect(stepActors(s, pack).map((p) => p.name)).toContain('Hugo')
  })
})

describe('Chasseur et Amoureux', () => {
  it('le Chasseur qui tue un Amoureux entraîne la mort de l’autre par chagrin', () => {
    let s = setup([...BASE.slice(0, 5), ['Farid', 'cupidon'], ['Gaël', 'chasseur'], ['Hugo', 'villageois']])
    s = nightAndMorning(s, {
      cupidon: { amoureux: [id(s, 'Chloé'), id(s, 'Hugo')] },
      loup_garou: { victime: [id(s, 'Gaël')] },
    })
    expect(s.alerts[0]).toMatchObject({ kind: 'hunter_shot', hunterId: id(s, 'Gaël') })
    s = gameReducer(s, { type: 'RESOLVE_ALERT', targetId: id(s, 'Chloé') })
    expect(player(s, 'Chloé').alive).toBe(false)
    expect(player(s, 'Hugo').alive).toBe(false)
    expect(player(s, 'Hugo').death!.cause).toBe('chagrin')
    expect(s.alerts.map((a) => a.kind)).toEqual(['death', 'death'])
  })
})

describe('Cupidon', () => {
  const SEATS: [string, RoleId][] = [...BASE.slice(0, 5), ['Farid', 'cupidon'], ['Gaël', 'voyante'], ['Hugo', 'villageois']]

  /** Nuit 1 : Cupidon unit Chloé et Hugo, que les loups dévorent (Hugo meurt de chagrin). */
  function coupleDies(variante: string) {
    let s = setup(SEATS, { variantes: { cupidon: variante } })
    s = nightAndMorning(s, {
      cupidon: { amoureux: [id(s, 'Chloé'), id(s, 'Hugo')] },
      loup_garou: { victime: [id(s, 'Chloé')] },
    })
    expect(player(s, 'Hugo').alive).toBe(false)
    return s
  }

  it('mode classique : Cupidon n’est plus appelé après la première nuit', () => {
    let s = coupleDies('classique')
    expect(s.alerts.map((a) => a.kind)).toEqual(['death'])
    s = quietDay(s)
    expect(s.night!.steps.map((st) => st.roleId)).not.toContain('cupidon')
  })

  it('mode Nouveaux Amoureux : Cupidon vivant désigne un nouveau couple', () => {
    let s = coupleDies('renouvelable')
    expect(s.alerts.map((a) => a.kind)).toEqual(['death', 'info'])
    s = quietDay(s)
    expect(s.night!.steps.map((st) => st.key).slice(0, 2)).toEqual(['cupidon', 'cupidon:amoureux'])
    s = nightAndMorning(s, {
      cupidon: { amoureux: [id(s, 'Bob'), id(s, 'Farid')] },
      loup_garou: { victime: [id(s, 'Bob')] },
    })
    expect(s.lovers).toEqual([id(s, 'Bob'), id(s, 'Farid')])
    // Le chagrin s'applique au nouveau couple (ici Cupidon lui-même).
    expect(player(s, 'Farid').death?.cause).toBe('chagrin')
  })

  it('mode Nouveaux Amoureux : pas de nouveau couple si Cupidon est mort ou si un Amoureux vit encore', () => {
    let s = setup(SEATS, { variantes: { cupidon: 'renouvelable' } })
    s = nightAndMorning(s, {
      cupidon: { amoureux: [id(s, 'Chloé'), id(s, 'Hugo')] },
      loup_garou: { victime: [id(s, 'Farid')] },
    })
    s = quietDay(s)
    expect(s.night!.steps.map((st) => st.roleId)).not.toContain('cupidon')
  })
})

describe('Deux Chasseurs', () => {
  const SEATS: [string, RoleId][] = [...BASE.slice(0, 5), ['Farid', 'chasseur'], ['Gaël', 'chasseur'], ['Hugo', 'cupidon']]

  it('sont appelés en tout premier, yeux fermés, avec les phrases au pluriel', () => {
    const s = setup(SEATS)
    expect(s.night!.steps[0].roleId).toBe('chasseur')
    const hunter = getRole('chasseur')
    expect(hunter.yeuxFermes).toBe(true)
    expect(roleTexts(s.config, hunter).reveil).toBe(hunter.phrase_reveil_pluriel)
    expect(stepActors(s, s.night!.steps[0]).map((p) => p.name)).toEqual(['Farid', 'Gaël'])
  })

  it('chaque Chasseur tire à sa mort, y compris sur l’autre Chasseur', () => {
    let s = setup(SEATS)
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Farid')] } })
    expect(s.alerts[0]).toMatchObject({ kind: 'hunter_shot', hunterId: id(s, 'Farid') })
    s = gameReducer(s, { type: 'RESOLVE_ALERT', targetId: id(s, 'Gaël') })
    expect(s.alerts.map((a) => a.kind)).toEqual(['death', 'hunter_shot'])
    s = gameReducer(s, { type: 'RESOLVE_ALERT' })
    expect(s.alerts[0]).toMatchObject({ kind: 'hunter_shot', hunterId: id(s, 'Gaël') })
    s = gameReducer(s, { type: 'RESOLVE_ALERT', targetId: id(s, 'Alice') })
    expect(player(s, 'Alice').alive).toBe(false)
  })
})

describe('Maire', () => {
  it('le Maire tué la nuit doit désigner son successeur avant toute autre chose', () => {
    let s = setup([...BASE.slice(0, 6), ['Gaël', 'chasseur'], ['Hugo', 'villageois']])
    s = nightAndMorning(s)
    s = gameReducer(s, { type: 'ELECT_MAYOR', playerId: id(s, 'Gaël') })
    s = gameReducer(s, { type: 'VOTE', result: { kind: 'none' } })
    while (s.alerts.length) s = gameReducer(s, { type: 'RESOLVE_ALERT' })
    s = gameReducer(s, { type: 'START_NIGHT' })
    s = playNight(s, { loup_garou: { victime: [id(s, 'Gaël')] } })
    expect(s.morning!.deaths).toEqual([id(s, 'Gaël')])
    s = gameReducer(s, { type: 'ACK_MORNING' })
    expect(s.alerts.map((a) => a.kind)).toEqual(['mayor_successor', 'hunter_shot'])
    expect(s.mayorId).toBeNull()
    s = gameReducer(s, { type: 'RESOLVE_ALERT', targetId: id(s, 'Hugo') })
    expect(s.mayorId).toBe(id(s, 'Hugo'))
  })
})

describe('Infect Père des Loups', () => {
  it('infecte la victime : pas de mort, elle devient loup et garde son rôle', () => {
    let s = setup([['Ines', 'infect_pere'], ...BASE.slice(1)])
    s = playNight(s, {
      loup_garou: { victime: [id(s, 'Gaël')], infection: true },
    })
    expect(s.morning!.deaths).toEqual([])
    const gael = player(s, 'Gaël')
    expect(gael.alive).toBe(true)
    expect(gael.infected).toBe(true)
    expect(gael.roleId).toBe('voyante')
    expect(isWolf(gael)).toBe(true)
    expect(s.powers.infection).toBe(false)
  })

  it('ne propose plus l’infection une fois utilisée', () => {
    let s = setup([['Ines', 'infect_pere'], ...BASE.slice(1)])
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Gaël')], infection: true } })
    s = quietDay(s)
    s = gameReducer(s, { type: 'START_NIGHT_INTRO' })
    while (currentStep(s)!.roleId !== 'loup_garou') s = gameReducer(s, { type: 'COMPLETE_STEP', selections: {} })
    const pack = currentStep(s)!
    expect(stepActors(s, pack).map((p) => p.name)).toEqual(expect.arrayContaining(['Ines', 'Gaël']))
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: { victime: [id(s, 'Hugo')], infection: true } })
    while (s.phase === 'nuit') s = gameReducer(s, { type: 'COMPLETE_STEP', selections: {} })
    expect(player(s, 'Hugo').alive).toBe(false)
    expect(player(s, 'Hugo').infected).toBe(false)
  })
})

describe('Renard', () => {
  const FOX: [string, RoleId][] = [
    ['Alice', 'loup_garou'],
    ['Bob', 'villageois'],
    ['Chloé', 'villageois'],
    ['David', 'renard'],
    ['Emma', 'villageois'],
    ['Farid', 'loup_garou'],
  ]

  it('dit OUI et garde son pouvoir si un loup est dans le groupe', () => {
    let s = setup(FOX)
    s = playNight(s, { renard: { cible: [id(s, 'Bob')] } })
    expect(s.powers.foxLost).toBe(false)
  })

  it('perd définitivement son pouvoir s’il n’y a aucun loup', () => {
    let s = setup(FOX)
    s = nightAndMorning(s, { renard: { cible: [id(s, 'Chloé')] } })
    expect(s.powers.foxLost).toBe(true)
    s = quietDay(s)
    const fox = s.night!.steps.find((st) => st.roleId === 'renard')!
    expect(stepStatus(s, fox)).toBe('power_lost')
  })

  it('recalcule les voisins en ignorant les morts', () => {
    let s = setup(FOX)
    // Bob meurt : les voisins vivants de Chloé deviennent Alice (loup) et David.
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Bob')] } })
    s = quietDay(s)
    s = playNight(s, { renard: { cible: [id(s, 'Chloé')] } })
    expect(s.powers.foxLost).toBe(false)
  })
})

describe('Autres règles', () => {
  it('Sorcière : potion de vie puis potion de mort, une seule fois chacune', () => {
    let s = setup(BASE)
    s = playNight(s, {
      loup_garou: { victime: [id(s, 'Chloé')] },
      sorciere: { vie: [id(s, 'Chloé')], mort: [id(s, 'Alice')] },
    })
    expect(s.morning!.deaths).toEqual([id(s, 'Alice')])
    expect(s.powers).toMatchObject({ witchLife: false, witchDeath: false })
  })

  it('l’Ancien survit à la première attaque des loups, pas à la seconde', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'ancien']])
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Hugo')] } })
    expect(player(s, 'Hugo').alive).toBe(true)
    s = quietDay(s)
    s = playNight(s, { loup_garou: { victime: [id(s, 'Hugo')] } })
    expect(player(s, 'Hugo').alive).toBe(false)
  })

  it('l’Ange gagne s’il est éliminé au premier vote', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'ange']])
    s = nightAndMorning(s)
    s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'player', id: id(s, 'Hugo') } })
    expect(s.phase).toBe('fin')
    expect(s.winner).toBe('ange')
  })

  it('l’Idiot du village est gracié au vote', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'idiot']])
    s = nightAndMorning(s)
    s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'player', id: id(s, 'Hugo') } })
    expect(player(s, 'Hugo').alive).toBe(true)
    expect(s.powers.idiotRevealedIds).toContain(id(s, 'Hugo'))
  })

  it('le Bouc émissaire est éliminé en cas d’égalité', () => {
    let s = setup([...BASE.slice(0, 7), ['Hugo', 'bouc_emissaire']])
    s = nightAndMorning(s)
    s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'tie' } })
    expect(player(s, 'Hugo').alive).toBe(false)
  })

  it('le Chevalier dévoré donne le tétanos au premier loup à sa gauche', () => {
    let s = setup([
      ['Alice', 'chevalier'],
      ['Bob', 'villageois'],
      ['Chloé', 'loup_garou'],
      ['David', 'loup_garou'],
      ['Emma', 'villageois'],
      ['Farid', 'villageois'],
    ])
    s = nightAndMorning(s, { loup_garou: { victime: [id(s, 'Alice')] } })
    expect(s.powers.rustyTargetId).toBe(id(s, 'Chloé'))
    s = quietDay(s)
    s = playNight(s)
    expect(s.morning!.deaths).toEqual([id(s, 'Chloé')])
  })

  it('l’ours grogne si un voisin vivant est un loup', () => {
    let s = setup([
      ['Alice', 'villageois'],
      ['Bob', 'montreur_ours'],
      ['Chloé', 'loup_garou'],
      ['David', 'villageois'],
      ['Emma', 'villageois'],
    ])
    expect(bearGrowls(s).growls).toBe(true)
    s = nightAndMorning(s)
    expect(s.alerts.map((a) => a.kind)).toContain('bear')
    s = gameReducer(s, { type: 'EDIT_PLAYER', id: id(s, 'Chloé'), patch: { alive: false } })
    expect(bearGrowls(s).growls).toBe(false)
  })

  it('le Grand Méchant Loup perd sa seconde victime dès qu’un loup est mort', () => {
    let s = setup([...BASE.slice(0, 3), ['David', 'grand_mechant_loup'], ...BASE.slice(4)])
    s = nightAndMorning(s, {
      loup_garou: { victime: [id(s, 'Chloé')] },
      grand_mechant_loup: { victime: [id(s, 'Farid')] },
      sorciere: { mort: [id(s, 'Alice')] },
    })
    expect(['Chloé', 'Farid', 'Alice'].map((n) => player(s, n).alive)).toEqual([false, false, false])
    s = quietDay(s)
    const gml = s.night!.steps.find((st) => st.roleId === 'grand_mechant_loup')!
    expect(stepStatus(s, gml)).toBe('power_lost')
  })

  it('le village gagne quand le dernier loup est éliminé', () => {
    let s = setup(BASE)
    s = nightAndMorning(s, { sorciere: { mort: [id(s, 'Alice')] } })
    s = run(s, { type: 'ELECT_MAYOR', playerId: null }, { type: 'VOTE', result: { kind: 'player', id: id(s, 'David') } })
    while (s.alerts.length) s = gameReducer(s, { type: 'RESOLVE_ALERT' })
    expect(s.winner).toBe('village')
  })

  it('mode progressif : tour de reconnaissance, la Voyante joue une fois tout le monde identifié', () => {
    let s = createGame(
      { playerCount: 4, roleCounts: { loup_garou: 1, voyante: 1 }, nameMode: 'progressif', mayorEnabled: false, order: defaultOrder() },
      [],
      1,
    )
    s = gameReducer(s, { type: 'START_NIGHT_INTRO' })
    // 1. La Voyante se montre, sans agir.
    expect(currentStep(s)!.kind).toBe('reconnaissance')
    expect(stepStatus(s, currentStep(s)!)).toBe('identify')
    s = gameReducer(s, { type: 'IDENTIFY', names: { voyante: ['Léa'] } })
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: {} })
    // 2. Les loups se montrent et jouent.
    s = gameReducer(s, { type: 'IDENTIFY', names: { loup_garou: ['Kevin'] } })
    s = gameReducer(s, { type: 'ADD_PLAYER', name: 'Max' })
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: { victime: [id(s, 'Max')] } })
    // 3. Prénoms des joueurs restants (Max est déjà nommé).
    expect(currentStep(s)!.kind).toBe('villageois')
    s = gameReducer(s, { type: 'IDENTIFY', names: { villageois: ['Max', 'Nina'] } })
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: {} })
    // 4. La Voyante agit : tous les rôles sont connus.
    expect(currentStep(s)).toMatchObject({ kind: 'role', roleId: 'voyante' })
    expect(stepStatus(s, currentStep(s)!)).toBe('active')
    expect(s.players.every((p) => p.roleId)).toBe(true)
    s = gameReducer(s, { type: 'COMPLETE_STEP', selections: { cible: [id(s, 'Nina')] } })
    expect(s.phase).toBe('matin')
    expect(s.morning!.deaths).toEqual([id(s, 'Max')])
    expect(s.players.map((p) => `${p.name}:${p.roleId}`)).toEqual([
      'Léa:voyante',
      'Kevin:loup_garou',
      'Max:villageois',
      'Nina:villageois',
    ])
  })

  it('mode liste : tous les prénoms sont saisis avant la partie, sans places', () => {
    let s = createGame(
      { playerCount: 3, roleCounts: { loup_garou: 1 }, nameMode: 'liste', mayorEnabled: false, order: defaultOrder() },
      ['Léa', 'Kevin', 'Max'],
      1,
    )
    expect(s.players.map((p) => [p.name, p.roleId, p.seat])).toEqual([
      ['Léa', null, null],
      ['Kevin', null, null],
      ['Max', null, null],
    ])
    // Attribuer un rôle = choisir un prénom existant : aucun joueur n'est créé.
    s = gameReducer(s, { type: 'IDENTIFY', names: { loup_garou: ['kevin'] } })
    expect(s.players).toHaveLength(3)
    expect(player(s, 'Kevin').roleId).toBe('loup_garou')
  })

  it('les rôles qui doivent connaître les autres jouent en dernier la nuit 1, puis à leur place habituelle', () => {
    let s = setup([...BASE.slice(0, 6), ['Gaël', 'voyante'], ['Hugo', 'renard']])
    const keys = (st: GameState) => st.night!.steps.map((x) => x.key)
    expect(keys(s)).toEqual([
      'renard:reconnaissance',
      'salvateur',
      'voyante:reconnaissance',
      'loup_garou',
      'sorciere',
      'villageois',
      'renard',
      'voyante',
    ])
    s = quietDay(nightAndMorning(s))
    expect(keys(s)).toEqual(['renard', 'salvateur', 'voyante', 'loup_garou', 'sorciere'])
  })
})
