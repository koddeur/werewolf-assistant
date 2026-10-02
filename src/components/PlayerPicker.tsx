import { useEffect, useState } from 'react'
import { isWolf, normalizeName } from '../engine/selectors'
import type { Player } from '../engine/types'
import { useCurrentGame } from '../store/GameContext'
import { canAddPlayers, roleLabel } from './playerLabels'
import { Button } from './ui'

export interface PickerOption {
  player: Player
  disabledReason?: string
}

/**
 * Liste de gros boutons pour désigner un ou plusieurs joueurs.
 * En mode progressif, permet d'ajouter un prénom pas encore saisi.
 */
export function PlayerPicker({
  options,
  count,
  value,
  onChange,
  allowNew = false,
}: {
  options: PickerOption[]
  count: number
  value: string[]
  onChange: (ids: string[]) => void
  allowNew?: boolean
}) {
  const { game, dispatch } = useCurrentGame()
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const toggle = (id: string) => {
    if (count === 1) onChange(value[0] === id ? [] : [id])
    else if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else if (value.length < count) onChange([...value, id])
  }

  // Sélectionne automatiquement le joueur qu'on vient d'ajouter.
  useEffect(() => {
    if (!pending) return
    const added = options.find((o) => !o.disabledReason && normalizeName(o.player.name) === pending)
    if (added) {
      setPending(null)
      if (!value.includes(added.player.id)) {
        onChange(count === 1 ? [added.player.id] : [...value, added.player.id].slice(0, count))
      }
    }
  }, [options, pending, value, count, onChange])

  const addPlayer = () => {
    const name = draft.trim()
    if (!name) return
    dispatch({ type: 'ADD_PLAYER', name })
    setPending(normalizeName(name))
    setDraft('')
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {options.map(({ player, disabledReason }) => {
          const selected = value.includes(player.id)
          return (
            <button
              key={player.id}
              type="button"
              disabled={!!disabledReason}
              onClick={() => toggle(player.id)}
              aria-pressed={selected}
              className={`flex min-h-16 flex-col items-start justify-center rounded-2xl border-2 px-3 py-2 text-left transition-colors ${
                selected
                  ? 'border-moon bg-moon/20'
                  : disabledReason
                    ? 'border-transparent bg-night-900 opacity-40'
                    : 'border-transparent bg-night-800 active:bg-night-700'
              }`}
            >
              <span className="text-lg leading-tight font-semibold break-words">
                {selected && '✓ '}
                {player.name}
              </span>
              <span className={`text-xs leading-tight ${isWolf(player) ? 'text-red-300' : 'text-night-400'}`}>
                {disabledReason ?? roleLabel(player)}
              </span>
            </button>
          )
        })}
      </div>
      {allowNew && canAddPlayers(game) && (
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="➕ Autre joueur (prénom)"
            className="min-h-14 min-w-0 flex-1 rounded-2xl bg-night-800 px-4 text-lg outline-none focus:ring-2 focus:ring-moon"
            autoCapitalize="words"
          />
          <Button variant="secondary" onClick={addPlayer} disabled={!draft.trim()}>
            Ajouter
          </Button>
        </div>
      )}
    </div>
  )
}
