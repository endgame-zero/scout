import { useEffect, useState } from 'react'
import QueryInterface from './components/QueryInterface'
import LiveFeed from './components/LiveFeed'
import { fetchStats } from './api'

function timeAgo(iso) {
  if (!iso) return null
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function App() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setStats(await fetchStats())
      } catch {
        /* backend may still be starting */
      }
    }
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col lg:overflow-hidden">
        <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
          {/* Ask panel — brand + query as one composition */}
          <section className="relative flex flex-1 flex-col px-6 pb-10 pt-8 sm:px-10 lg:overflow-y-auto lg:px-14 lg:pt-12">
            <div className="mb-10 animate-fade-in sm:mb-14">
              <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-signal">
                Live news intelligence
              </p>
              <h1 className="font-display text-[clamp(3.25rem,9vw,5.5rem)] leading-[0.9] tracking-[-0.03em] text-ink">
                Scout
              </h1>
              <p className="mt-4 max-w-md font-sans text-base leading-relaxed text-ink-soft sm:text-lg">
                Ask the news what&apos;s going on. We pull from outlets that just published — not yesterday&apos;s digest.
              </p>

              {stats && (
                <p className="mt-5 font-sans text-sm text-ink-muted animate-rise-in">
                  <span className="text-ink font-medium">
                    {stats.total_articles?.toLocaleString() ?? '—'}
                  </span>
                  {' '}stories indexed
                  <span className="mx-2 text-mist-mid">·</span>
                  <span className="text-ink font-medium">
                    {stats.articles_last_24h?.toLocaleString() ?? '—'}
                  </span>
                  {' '}in the last day
                  {stats.last_ingested && (
                    <>
                      <span className="mx-2 text-mist-mid">·</span>
                      last pickup {timeAgo(stats.last_ingested)}
                    </>
                  )}
                </p>
              )}
            </div>

            <QueryInterface />
          </section>

          {/* Wire column */}
          <aside className="flex min-h-[420px] w-full flex-col border-t border-ink/10 bg-ink/[0.03] backdrop-blur-sm lg:min-h-0 lg:w-[380px] lg:shrink-0 lg:border-l lg:border-t-0 xl:w-[420px]">
            <LiveFeed />
          </aside>
        </div>
      </div>
    </div>
  )
}
