import { ArrowUpRight } from 'lucide-react'

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff <= 0) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NewsCard({ article }) {
  const pub = article.published_at || article.ingested_at

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex cursor-pointer items-start justify-between gap-3 border-b border-ink/10 py-3.5 transition-colors duration-200 hover:bg-white/40"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-signal">
            {article.source}
          </span>
          {pub && (
            <span className="font-sans text-[10px] tabular-nums text-ink-faint">
              {timeAgo(pub)}
            </span>
          )}
        </div>
        <p className="font-sans text-sm font-medium leading-snug text-ink transition-colors duration-200 group-hover:text-signal">
          {article.title}
        </p>
      </div>
      <ArrowUpRight
        className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-faint opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-hover:text-signal"
        aria-hidden
      />
    </a>
  )
}
