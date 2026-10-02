import { getRole } from '../engine/roles'
import { remainingSlots } from '../engine/selectors'
import type { Player } from '../engine/types'
import { useCurrentGame } from '../store/GameContext'
import { Banner, Button } from './ui'

/** Demande le rôle d'un joueur pas encore identifié (mode progressif, nuit 1). */
export function RevealPanel({ player }: { player: Player }) {
  const { game, dispatch } = useCurrentGame()
  const roles = Object.keys(remainingSlots(game)).map(getRole)
  return (
    <div className="space-y-3">
      <Banner tone="warning">
        👀 Tu ne connais pas encore le rôle de <b>{player.name}</b>. Regarde discrètement sa carte, puis touche son rôle :
      </Banner>
      <div className="grid grid-cols-2 gap-2">
        {roles.map((r) => (
          <Button key={r.id} variant="secondary" className="text-left" onClick={() => dispatch({ type: 'REVEAL_ROLE', playerId: player.id, roleId: r.id })}>
            {r.emoji} {r.nom}
          </Button>
        ))}
      </div>
    </div>
  )
}
