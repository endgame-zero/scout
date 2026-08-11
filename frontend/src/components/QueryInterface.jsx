import { useState, useRef } from 'react'
import { ArrowUpRight, Loader2, AlertCircle } from 'lucide-react'
import { streamQuery } from '../api'

const EXAMPLE_QUERIES = [
  'What are the biggest geopolitical stories right now?',
  'Catch me up on tech industry headlines',
  "What's moving markets today?",
  'Any major crises or disasters in the news?',
]

export default function QueryInterface() {
  const [question, setQuestion] = useState('')
  const [hoursBack, setHoursBack] = useState(24)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(false)

  const submit = async (q = question) => {
    if (!q.trim() || loading) return
    setAnswer('')
    setError(null)
    setLoading(true)
    abortRef.current = false

    try {
      let text = ''
      for await (const chunk of streamQuery(q.trim(), hoursBack)) {
        if (abortRef.current) break
        text += chunk
        setAnswer(text)
      }
    } catch (e) {
      setError(e.message || "Couldn't reach the backend — is Scout still running?")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
  }

  return (
    <section className="flex flex-1 flex-col">
      <label htmlFor="scout-question" className="sr-only">
        Your question
      </label>
      <div className="group relative border-b-2 border-ink/20 transition-colors duration-200 focus-within:border-signal">
        <textarea
          id="scout-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What should I know right now?"
          rows={2}
          className="w-full resize-none bg-transparent pb-4 pt-1 font-display text-2xl italic leading-snug text-ink placeholder:text-ink-faint focus:outline-none sm:text-3xl"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-sans text-sm text-ink-muted">
          <span>Look back</span>
          <select
            value={hoursBack}
            onChange={(e) => setHoursBack(Number(e.target.value))}
            aria-label="Time window"
            className="cursor-pointer rounded-none border-0 border-b border-ink/25 bg-transparent py-0.5 font-medium text-ink focus:border-signal focus:outline-none"
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => submit()}
          disabled={!question.trim() || loading}
          className="inline-flex cursor-pointer items-center gap-2 bg-ink px-5 py-2.5 font-sans text-sm font-semibold text-white transition-all duration-200 hover:bg-signal disabled:cursor-not-allowed disabled:opacity-35"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Reading the wire…
            </>
          ) : (
            <>
              Ask Scout
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </div>
      <p className="mt-2 font-sans text-xs text-ink-faint">Ctrl+Enter to send</p>

      {!answer && !loading && (
        <div className="mt-10 animate-fade-in">
          <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            Try one of these
          </p>
          <ul className="space-y-0">
            {EXAMPLE_QUERIES.map((q) => (
              <li key={q} className="border-t border-ink/10 last:border-b">
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(q)
                    submit(q)
                  }}
                  className="group flex w-full cursor-pointer items-center justify-between gap-4 py-3.5 text-left font-sans text-sm text-ink-soft transition-colors duration-200 hover:text-signal"
                >
                  <span>{q}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-8 flex items-start gap-2.5 border-l-2 border-red-500 bg-red-50/80 px-4 py-3 font-sans text-sm text-red-700 animate-rise-in"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {(answer || loading) && (
        <article className="mt-10 flex-1 animate-rise-in">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-signal" />
            <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-muted">
              Briefing
            </h2>
          </div>
          {answer ? (
            <div className="font-sans text-[15px] leading-[1.75] text-ink-soft whitespace-pre-wrap">
              {answer}
              {loading && (
                <span
                  className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-0.5 bg-signal align-text-bottom animate-cursor-blink"
                  aria-hidden
                />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 font-sans text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin text-signal" aria-hidden />
              Digging through fresh headlines…
            </div>
          )}
        </article>
      )}
    </section>
  )
}
