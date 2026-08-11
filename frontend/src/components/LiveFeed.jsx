import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Radio } from 'lucide-react'
import NewsCard from './NewsCard'
import { fetchRecentArticles } from '../api'

export default function LiveFeed() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [hours, setHours] = useState(24)

  const load = useCallback(async () => {
    try {
      const data = await fetchRecentArticles(hours, 30)
      setArticles(data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('LiveFeed fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="flex h-full flex-col px-5 py-6 sm:px-6 lg:py-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
              <span className="relative inline-flex h-2 w-2 animate-pulse-live rounded-full bg-live" />
            </span>
            <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-ink">
              The wire
            </h2>
          </div>
          <p className="font-display text-2xl italic text-ink-soft">
            {loading ? '…' : articles.length}{' '}
            <span className="font-sans text-sm not-italic text-ink-faint">
              {hours === 1 ? 'past hour' : `past ${hours}h`}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            aria-label="Feed time window"
            className="cursor-pointer border-0 border-b border-ink/20 bg-transparent py-0.5 font-sans text-xs font-medium text-ink-soft focus:border-signal focus:outline-none"
          >
            <option value={1}>1h</option>
            <option value={6}>6h</option>
            <option value={24}>24h</option>
            <option value={48}>48h</option>
          </select>
          <button
            type="button"
            onClick={load}
            className="cursor-pointer p-2 text-ink-faint transition-colors duration-200 hover:text-signal"
            title="Refresh"
            aria-label="Refresh the wire"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-16 border-t border-ink/8 bg-ink/[0.03] animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <Radio className="mb-3 h-7 w-7 text-ink-faint opacity-50" aria-hidden />
            <p className="font-display text-xl italic text-ink-muted">Nothing on the wire yet</p>
            <p className="mt-1 max-w-[220px] font-sans text-xs text-ink-faint">
              Feeds are warming up — fresh stories should land shortly.
            </p>
          </div>
        ) : (
          <div className="border-t border-ink/10">
            {articles.map((a, i) => (
              <div
                key={a.id}
                className="animate-rise-in"
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                <NewsCard article={a} />
              </div>
            ))}
          </div>
        )}
      </div>

      {lastRefresh && (
        <p className="mt-4 text-center font-sans text-[10px] tracking-wide text-ink-faint">
          Refreshed {lastRefresh.toLocaleTimeString()} · checks every minute
        </p>
      )}
    </div>
  )
}
