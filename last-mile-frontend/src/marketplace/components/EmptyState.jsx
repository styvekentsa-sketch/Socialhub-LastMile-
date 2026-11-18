import { SearchX } from 'lucide-react'

/**
 * Etat vide ou erreur : icone, titre, texte et action facultative.
 * tone : 'neutral' (aucun resultat) ou 'error' (chargement impossible).
 */
export default function EmptyState({ icon: Icon = SearchX, title, text, action, tone = 'neutral' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="flex flex-col items-center rounded-lg border border-dashed border-zinc-800 px-6 py-16 text-center"
    >
      <span className={`grid size-12 place-items-center rounded-lg border ${tone === 'error' ? 'border-amber-500/40 text-amber-500' : 'border-zinc-800 text-zinc-500'}`}>
        <Icon aria-hidden="true" size={22} strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 text-base font-semibold text-white">{title}</h2>
      {text && <p className="mt-2 max-w-md text-sm text-zinc-400">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
