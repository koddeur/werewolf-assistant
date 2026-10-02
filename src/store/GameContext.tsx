import { createContext, useCallback, useContext, useEffect, useReducer, type ReactNode } from 'react'
import { gameReducer } from '../engine/engine'
import type { GameAction, GameState } from '../engine/types'

const STORAGE_KEY = 'werewolf-assistant:game'
const MAX_HISTORY = 80

interface Store {
  present: GameState | null
  past: GameState[]
}

type StoreAction =
  | { type: 'GAME'; action: GameAction }
  | { type: 'NEW'; game: GameState }
  | { type: 'UNDO' }
  | { type: 'QUIT' }

function storeReducer(store: Store, a: StoreAction): Store {
  switch (a.type) {
    case 'NEW':
      return { present: a.game, past: [] }
    case 'QUIT':
      return { present: null, past: [] }
    case 'UNDO':
      if (!store.past.length) return store
      return { present: store.past[store.past.length - 1], past: store.past.slice(0, -1) }
    case 'GAME': {
      if (!store.present) return store
      const next = gameReducer(store.present, a.action)
      return { present: next, past: [...store.past, store.present].slice(-MAX_HISTORY) }
    }
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { present: null, past: [] }
    const parsed = JSON.parse(raw) as Store
    if (parsed.present?.version !== 1) return { present: null, past: [] }
    return { present: parsed.present, past: Array.isArray(parsed.past) ? parsed.past : [] }
  } catch {
    return { present: null, past: [] }
  }
}

function save(store: Store) {
  // Si le quota est dépassé, on réduit l'historique plutôt que de perdre la partie.
  let past = store.past
  for (;;) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ present: store.present, past }))
      return
    } catch {
      if (!past.length) return
      past = past.slice(Math.ceil(past.length / 2))
    }
  }
}

interface GameContextValue {
  game: GameState | null
  canUndo: boolean
  dispatch: (action: GameAction) => void
  startGame: (game: GameState) => void
  undo: () => void
  quit: () => void
}

const Ctx = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [store, send] = useReducer(storeReducer, undefined, load)

  useEffect(() => {
    if (store.present) save(store)
    else localStorage.removeItem(STORAGE_KEY)
  }, [store])

  const dispatch = useCallback((action: GameAction) => send({ type: 'GAME', action }), [])
  const startGame = useCallback((game: GameState) => send({ type: 'NEW', game }), [])
  const undo = useCallback(() => send({ type: 'UNDO' }), [])
  const quit = useCallback(() => send({ type: 'QUIT' }), [])

  return (
    <Ctx.Provider value={{ game: store.present, canUndo: store.past.length > 0, dispatch, startGame, undo, quit }}>
      {children}
    </Ctx.Provider>
  )
}

export function useGame(): GameContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGame doit être utilisé dans <GameProvider>')
  return ctx
}

/** Pour les écrans de partie : l'état est garanti non nul. */
export function useCurrentGame() {
  const ctx = useGame()
  if (!ctx.game) throw new Error('Aucune partie en cours')
  return { ...ctx, game: ctx.game }
}
