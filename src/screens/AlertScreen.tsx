import { useState, type ReactNode } from 'react'
import { PlayerPicker } from '../components/PlayerPicker'
import { Banner, Button, Hint, MainAction, Phrase } from '../components/ui'
import { DEATH_LABELS } from '../engine/engine'
import { narrate } from '../engine/narration'
import { getRole } from '../engine/roles'
import { alivePlayers, bearGrowls, displayName, isWolf, playerById, roleName } from '../engine/selectors'
import type { Alert, AlertLevel } from '../engine/types'
import { useCurrentGame } from '../store/GameContext'

const FRAME: Record<AlertLevel, string> = {
  danger: 'border-blood bg-blood/10',
  warning: 'border-ember bg-ember/10',
  info: 'border-night-600 bg-night-800',
  success: 'border-forest bg-forest/10',
}

function AlertFrame({
  level,
  emoji,
  title,
  children,
}: {
  level: AlertLevel
  emoji: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="space-y-4 animate-rise">
      <div className={`rounded-3xl border-2 p-5 text-center ${FRAME[level]} ${level === 'danger' ? 'animate-alert' : ''}`}>
        <div className="mb-1 text-xs font-bold tracking-widest text-night-400 uppercase">Alerte</div>
        <div className="text-6xl" aria-hidden>
          {emoji}
        </div>
        <h1 className="mt-3 text-3xl leading-tight font-bold">{title}</h1>
      </div>
      {children}
    </div>
  )
}

function PickAndConfirm({ ids, label, onConfirm }: { ids: string[]; label: string; onConfirm: (id: string) => void }) {
  const { game } = useCurrentGame()
  const [value, setValue] = useState<string[]>([])
  return (
    <>
      <PlayerPicker
        options={ids.map((id) => ({ player: playerById(game, id)! }))}
        count={1}
        value={value}
        onChange={setValue}
      />
      <MainAction disabled={!value.length} onClick={() => onConfirm(value[0])}>
        {label}
      </MainAction>
    </>
  )
}

export function AlertScreen({ alert }: { alert: Alert }) {
  const { game, dispatch } = useCurrentGame()
  const ack = () => dispatch({ type: 'RESOLVE_ALERT' })
  const resolveWith = (targetId: string) => dispatch({ type: 'RESOLVE_ALERT', targetId })

  switch (alert.kind) {
    case 'info':
      return (
        <AlertFrame level={alert.level} emoji={alert.emoji} title={alert.title}>
          {alert.text && <p className="text-xl leading-snug">{alert.text}</p>}
          <MainAction onClick={ack}>Compris ✓</MainAction>
        </AlertFrame>
      )

    case 'death': {
      const p = playerById(game, alert.playerId)!
      return (
        <AlertFrame level="danger" emoji="💀" title={`${p.name} est ${DEATH_LABELS[alert.cause]}`}>
          <Phrase>{narrate('annonce_mort', game.seed, alert.id, { nom: p.name })}</Phrase>
          <Banner tone="info">
            🃏 Sa carte est retournée : <b>{roleName(p.roleId)}</b>
          </Banner>
          <MainAction onClick={ack}>Annonce faite ✓</MainAction>
        </AlertFrame>
      )
    }

    case 'mayor_successor':
      return (
        <AlertFrame level="danger" emoji="👑" title="Le Maire doit désigner son successeur avant toute autre chose.">
          <Hint>Maire décédé : {displayName(game, alert.deadMayorId)}. La voix du nouveau Maire comptera double.</Hint>
          <PickAndConfirm ids={alivePlayers(game).map((p) => p.id)} label="Nouveau Maire ✓" onConfirm={resolveWith} />
        </AlertFrame>
      )

    case 'hunter_shot':
      return (
        <AlertFrame level="danger" emoji="🏹" title={`Le Chasseur (${displayName(game, alert.hunterId)}) tire immédiatement sur un joueur.`}>
          <Phrase>Chasseur, avant de rendre ton dernier souffle, désigne celui qui t’accompagnera dans la tombe !</Phrase>
          <PickAndConfirm
            ids={alivePlayers(game)
              .filter((p) => p.id !== alert.hunterId)
              .map((p) => p.id)}
            label="Tirer ✓"
            onConfirm={resolveWith}
          />
        </AlertFrame>
      )

    case 'servant_choice': {
      const servant = displayName(game, alert.servantId)
      const target = playerById(game, alert.targetId)!
      return (
        <AlertFrame level="warning" emoji="🧹" title="Servante dévouée : se révèle-t-elle ?">
          <p className="text-xl leading-snug">
            Avant que <b>{target.name}</b> ne retourne sa carte, demande si la Servante ({servant}) veut prendre son rôle (
            {roleName(target.roleId)}).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => dispatch({ type: 'RESOLVE_ALERT', accept: true })}>
              Oui, elle prend le rôle
            </Button>
            <Button variant="secondary" onClick={() => dispatch({ type: 'RESOLVE_ALERT', accept: false })}>
              Non
            </Button>
          </div>
        </AlertFrame>
      )
    }

    case 'knight_target':
      return (
        <AlertFrame level="warning" emoji="🗡️" title="Qui est le premier loup à gauche du Chevalier ?">
          <Hint>
            Le Chevalier ({displayName(game, alert.knightId)}) a été dévoré. Ce loup mourra du tétanos la nuit prochaine. Ne dis rien
            pour l’instant.
          </Hint>
          <PickAndConfirm ids={alivePlayers(game).filter(isWolf).map((p) => p.id)} label="Valider ✓" onConfirm={resolveWith} />
        </AlertFrame>
      )

    case 'bear': {
      const { tamer, growls } = bearGrowls(game)
      if (!tamer) {
        return (
          <AlertFrame level="info" emoji="🐻" title="Le Montreur d’ours est mort : l’ours ne grogne plus.">
            <MainAction onClick={ack}>Continuer</MainAction>
          </AlertFrame>
        )
      }
      return (
        <AlertFrame level={growls ? 'warning' : 'info'} emoji="🐻" title={growls ? '🐻 L’ours grogne !' : 'L’ours reste silencieux.'}>
          <Phrase>
            {growls
              ? `Grrrrr… L’ours de ${tamer.name} grogne ! Un loup se cache tout près de lui…`
              : `L’ours de ${tamer.name} dort paisiblement. Il ne sent aucun loup à côté de son maître.`}
          </Phrase>
          <Hint>{getRole('montreur_ours').description_courte}</Hint>
          <MainAction onClick={ack}>Annonce faite ✓</MainAction>
        </AlertFrame>
      )
    }
  }
}
