import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-moon text-night-950 font-bold active:bg-moon-dim disabled:bg-night-700 disabled:text-night-400',
  secondary: 'bg-night-700 text-mist active:bg-night-600 disabled:opacity-40',
  ghost: 'bg-transparent text-mist border border-night-600 active:bg-night-800 disabled:opacity-40',
  danger: 'bg-blood text-white font-bold active:brightness-90 disabled:opacity-40',
  success: 'bg-forest text-night-950 font-bold active:brightness-90 disabled:opacity-40',
}

export function Button({
  variant = 'secondary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`min-h-14 rounded-2xl px-5 text-lg transition-colors ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** Gros bouton d'action en bas d'écran, toujours accessible au pouce. */
export function MainAction({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-night-950 via-night-950 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button variant="primary" className="min-h-16 w-full text-xl" {...props}>
        {children}
      </Button>
    </div>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-night-800 p-4 ${className}`}>{children}</div>
}

/** La phrase que le narrateur lit à voix haute. */
export function Phrase({ children, label = 'À dire' }: { children: ReactNode; label?: string }) {
  return (
    <div className="rounded-2xl border-l-4 border-moon bg-night-800/70 px-4 py-3">
      <div className="mb-1 text-xs font-semibold tracking-widest text-moon-dim uppercase">🗣️ {label}</div>
      <p className="font-tale text-xl leading-snug text-mist italic">« {children} »</p>
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-base leading-snug text-night-400">ℹ️ {children}</p>
}

const BANNER_TONES = {
  danger: 'border-blood bg-blood/15 text-red-100',
  warning: 'border-ember bg-ember/15 text-amber-100',
  info: 'border-night-600 bg-night-800 text-mist',
  success: 'border-forest bg-forest/15 text-emerald-100',
}

export function Banner({ tone, children }: { tone: keyof typeof BANNER_TONES; children: ReactNode }) {
  return <div className={`rounded-2xl border-2 px-4 py-3 text-lg leading-snug ${BANNER_TONES[tone]}`}>{children}</div>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 mb-2 text-sm font-semibold tracking-widest text-night-400 uppercase">{children}</h3>
}

/** Panneau plein écran (liste des joueurs, journal, paramètres). */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-night-950 animate-rise" role="dialog" aria-label={title}>
      <header className="flex items-center justify-between gap-3 border-b border-night-800 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Fermer">
          ✕
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </div>
  )
}

export function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" className="w-14 px-0 text-2xl" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Moins">
        −
      </Button>
      <span className="min-w-12 text-center text-3xl font-bold tabular-nums">{value}</span>
      <Button variant="secondary" className="w-14 px-0 text-2xl" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Plus">
        +
      </Button>
    </div>
  )
}
