import { useState } from 'react'
import GlassSurface from '../components/GlassSurface'
import PageHeader from '../components/PageHeader'
import { API_BASE } from '../constants'
import { fetchOpts } from '../utils'

export default function AIPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const runSummarize = async () => {
    setBusy('summarize'); setError('')
    try {
      const res = await fetch(`${API_BASE}/ai/summarize`, fetchOpts({
        method: 'POST',
        body: JSON.stringify({ limit: 50, hours: 24 }),
      }))
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setSummary(data.summary)
    } catch (e) {
      setError(e.message)
    }
    setBusy('')
  }

  const runAsk = async () => {
    if (!question.trim()) return
    setBusy('ask'); setError('')
    try {
      const res = await fetch(`${API_BASE}/ai/ask`, fetchOpts({
        method: 'POST',
        body: JSON.stringify({ question: question.trim(), limit: 40, hours: 24 }),
      }))
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setAnswer(data.answer)
    } catch (e) {
      setError(e.message)
    }
    setBusy('')
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="AI Analyst" subtitle="Summarize incidents and ask questions about recent events" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 960 }}>
        <GlassSurface width="100%" borderRadius={4} backgroundOpacity={0.45}>
          <div style={{ padding: '14px 16px' }}>
            <h3 style={{ fontSize: 11, fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
              Incident Summary
            </h3>
            <button className="btn-primary" onClick={runSummarize} disabled={!!busy} style={{ fontSize: 11, padding: '8px 14px', marginBottom: 12 }}>
              {busy === 'summarize' ? 'Analyzing…' : 'Summarize last 24h'}
            </button>
            <div style={{
              minHeight: 120, padding: '10px 12px', background: 'var(--color-bg)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.6, color: 'var(--color-text)',
              whiteSpace: 'pre-wrap',
            }}>
              {summary || 'No summary yet — click above to generate from recent events.'}
            </div>
          </div>
        </GlassSurface>

        <GlassSurface width="100%" borderRadius={4} backgroundOpacity={0.45}>
          <div style={{ padding: '14px 16px' }}>
            <h3 style={{ fontSize: 11, fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
              Ask a Question
            </h3>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="e.g. Which IPs had the most SSH failures?"
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', marginBottom: 10,
                background: 'var(--color-bg)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
                fontFamily: 'var(--font-body)', fontSize: 12, resize: 'vertical', outline: 'none',
              }}
            />
            <button className="btn-primary" onClick={runAsk} disabled={!!busy || !question.trim()} style={{ fontSize: 11, padding: '8px 14px', marginBottom: 12 }}>
              {busy === 'ask' ? 'Thinking…' : 'Ask'}
            </button>
            <div style={{
              minHeight: 80, padding: '10px 12px', background: 'var(--color-bg)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: 1.6, color: 'var(--color-text)',
              whiteSpace: 'pre-wrap',
            }}>
              {answer || 'Answers appear here based on your recent event context.'}
            </div>
          </div>
        </GlassSurface>
      </div>

      {error && (
        <p style={{ marginTop: 12, color: 'var(--color-accent)', fontSize: 11, fontFamily: 'var(--font-body)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
