const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function* streamQuery(question, hoursBack = 24) {
  const response = await fetch(`${API_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, hours_back: hoursBack }),
  })

  if (!response.ok) {
    throw new Error(`Query failed: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data)
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.chunk) yield parsed.chunk
      } catch (e) {
        if (e.message?.startsWith('Query failed') || e.message?.includes('error')) throw e
      }
    }
  }
}

export async function fetchRecentArticles(hours = 24, limit = 30) {
  const resp = await fetch(`${API_URL}/api/articles/recent?hours=${hours}&limit=${limit}`)
  if (!resp.ok) throw new Error('Failed to fetch articles')
  return resp.json()
}

export async function fetchStats() {
  const resp = await fetch(`${API_URL}/api/stats`)
  if (!resp.ok) throw new Error('Failed to fetch stats')
  return resp.json()
}
