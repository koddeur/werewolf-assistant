import { useState } from 'react'
import { currentStep } from './engine/engine'
import type { GameState } from './engine/types'
import { useWakeLock } from './hooks/useWakeLock'
import { AlertScreen } from './screens/AlertScreen'
import { DayScreen, EndScreen, MorningScreen, NightIntro } from './screens/PhaseScreens'
import { SetupScreen } from './screens/SetupScreen'
import { JournalSheet, PlayersSheet, SettingsSheet } from './screens/Sheets'
import { StepScreen } from './screens/StepScreen'
import { useCurrentGame, useGame } from './store/GameContext'

type Panel = 'players' | 'journal' | 'settings' | null

function progressLabel(game: GameState): { text: string; ratio: number | null } {
  const night = game.night
  switch (game.phase) {
    case 'nuit':
      if (!night || !night.introDone) return { text: `🌙 Nuit ${game.turn}`, ratio: 0 }
      return {
        text: `🌙 Nuit ${game.turn} · étape ${Math.min(night.index + 1, night.steps.length)}/${night.steps.length}`,
        ratio: night.index / night.steps.length,
      }
    case 'matin':
      return { text: `🌅 Matin du jour ${game.turn}`, ratio: null }
    case 'jour':
      return { text: `☀️ Jour ${game.turn}`, ratio: null }
    case 'fin':
      return { text: '🏁 Fin de la partie', ratio: null }
  }
}

function TopButton({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-night-800 text-xs leading-tight active:bg-night-700 disabled:opacity-30"
    >
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  )
}

function GameShell() {
  const { game, canUndo, undo } = useCurrentGame()
  const [panel, setPanel] = useState<Panel>(null)
  useWakeLock(game.phase !== 'fin')
  const progress = progressLabel(game)
  const alert = game.alerts[0]
  const step = currentStep(game)

  let content
  if (game.phase === 'fin') content = <EndScreen onJournal={() => setPanel('journal')} />
  else if (alert) content = <AlertScreen key={alert.id} alert={alert} />
  else if (game.phase === 'nuit' && !game.night?.introDone) content = <NightIntro />
  else if (game.phase === 'nuit' && step) content = <StepScreen key={`${game.turn}:${step.key}`} step={step} />
  else if (game.phase === 'matin') content = <MorningScreen />
  else content = <DayScreen key={`jour-${game.turn}`} />

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-night-800 bg-night-950/95 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-lg font-semibold">{progress.text}</span>
          <span className="text-sm text-night-400">{game.players.filter((p) => p.alive).length} en vie</span>
        </div>
        {progress.ratio !== null && (
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-night-800">
            <div className="h-full bg-moon transition-all" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
        )}
        <nav className="grid grid-cols-4 gap-2">
          <TopButton icon="↶" label="Annuler" onClick={undo} disabled={!canUndo} />
          <TopButton icon="👥" label="Joueurs" onClick={() => setPanel('players')} />
          <TopButton icon="📜" label="Journal" onClick={() => setPanel('journal')} />
          <TopButton icon="⚙️" label="Réglages" onClick={() => setPanel('settings')} />
        </nav>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-4">{content}</main>
      {panel === 'players' && <PlayersSheet onClose={() => setPanel(null)} />}
      {panel === 'journal' && <JournalSheet onClose={() => setPanel(null)} />}
      {panel === 'settings' && <SettingsSheet onClose={() => setPanel(null)} />}
    </>
  )
}

export default function App() {
  const { game } = useGame()
  if (!game) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <SetupScreen />
      </main>
    )
  }
  return <GameShell />
}
