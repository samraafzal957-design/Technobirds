'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Check, Sparkles, Wand2, AlertCircle, Zap, ShieldCheck } from 'lucide-react'

interface ScanRow {
  id: string
  label: string
  count: number
  samples: string[]
  retry: boolean
}

interface HumanizeResponse {
  output: string
  before: ScanRow[]
  after: ScanRow[]
  mode: 'rules-only' | 'rules-fallback' | 'llm'
  note?: string
  error?: string
}

const MAX_CHARS = 8000

export default function HumanizerPage() {
  const [text, setText] = useState('')
  const [tone, setTone] = useState<'casual' | 'neutral' | 'formal'>('casual')
  const [output, setOutput] = useState('')
  const [before, setBefore] = useState<ScanRow[]>([])
  const [after, setAfter] = useState<ScanRow[]>([])
  const [mode, setMode] = useState<HumanizeResponse['mode'] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const outRef = useRef<HTMLTextAreaElement>(null)

  const total = (a: ScanRow[]) => a.reduce((n, r) => n + r.count, 0)

  const handleHumanize = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      toast.error('Paste some text first')
      return
    }
    if (trimmed.length > MAX_CHARS) {
      toast.error(`Keep it under ${MAX_CHARS.toLocaleString()} characters`)
      return
    }

    setLoading(true)
    setOutput('')
    setBefore([])
    setAfter([])
    setMode(null)
    setNote(null)

    try {
      const res = await fetch('/api/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, tone }),
      })
      const data: HumanizeResponse = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Humanize failed')
        return
      }
      setOutput(data.output)
      setBefore(data.before)
      setAfter(data.after)
      setMode(data.mode)
      if (data.note) setNote(data.note)
      toast.success(
        data.mode === 'llm'
          ? `Done — ${total(data.before)} → ${total(data.after)} flagged patterns`
          : `Rule cleanup done — ${total(data.before)} → ${total(data.after)} flagged patterns`
      )
    } catch (e) {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      outRef.current?.select()
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  // Pattern ledger rows: union of before/after ids
  const allIds = new Set([...before.map((r) => r.id), ...after.map((r) => r.id)])
  const rows = [...allIds].map((id) => {
    const b = before.find((r) => r.id === id)
    const a = after.find((r) => r.id === id)
    return { id, label: (b || a)!.label, bCount: b?.count || 0, aCount: a?.count || 0, samples: a?.samples || [], fixed: !a }
  })

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(179, 120, 255, 0.10) 0%, transparent 45%),' +
            'radial-gradient(circle at 80% 100%, rgba(0, 255, 157, 0.05) 0%, transparent 40%)',
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          maskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 75%)',
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Technobirds</span>
          </Link>
          <div className="text-right">
            <div className="font-bold text-lg">
              HUMAN<span className="text-purple-400">IZER</span>
            </div>
            <div className="font-mono text-[9px] text-zinc-500 tracking-widest">
              PLAIN · SPECIFIC · REAL
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full flex-1">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="font-mono text-[10px] tracking-widest text-purple-400">
              RULES + LLM · WIKIPEDIA-SOURCED PATTERNS
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            <span className="text-gradient-cool">Make your text sound</span>{' '}
            <span style={{ background: 'linear-gradient(135deg, #b378ff 0%, #d4a3ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              human.
            </span>
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Paste any text. We strip the patterns Wikipedia flags as AI writing — empty
            vocabulary, fake analysis, vague attribution, formulaic structure — and rewrite
            it to read like a real person.
          </p>
        </motion.div>

        {/* Tone toggle */}
        <div className="flex justify-center mb-6">
          <fieldset className="border border-white/15 rounded-full overflow-hidden flex">
            <legend className="sr-only">Tone</legend>
            {(['casual', 'neutral', 'formal'] as const).map((t) => (
              <label key={t} className="relative">
                <input
                  type="radio"
                  name="tone"
                  value={t}
                  checked={tone === t}
                  onChange={() => setTone(t)}
                  className="sr-only"
                />
                <span
                  className={`block px-5 py-2 text-sm font-mono font-semibold transition-colors cursor-pointer ${
                    tone === t
                      ? 'bg-purple-400 text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {t}
                </span>
              </label>
            ))}
          </fieldset>
        </div>

        {/* Editor */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Input */}
          <div className="glass rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-zinc-500">YOUR TEXT</span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">
                {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Paste something here. AI-written text, a draft you want to tighten, anything."
              className="flex-1 min-h-[300px] md:min-h-[400px] p-4 bg-transparent border-0 outline-none resize-none font-mono text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Output */}
          <div className="glass rounded-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-zinc-500">REWRITTEN</span>
                {mode && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-widest border ${
                      mode === 'llm'
                        ? 'text-purple-300 border-purple-400/40 bg-purple-400/10'
                        : mode === 'rules-fallback'
                          ? 'text-amber-300 border-amber-400/40 bg-amber-400/10'
                          : 'text-zinc-300 border-white/15 bg-white/5'
                    }`}
                  >
                    {mode === 'llm' ? 'LLM' : mode === 'rules-fallback' ? 'RULES+LLM-FAIL' : 'RULES ONLY'}
                  </span>
                )}
              </div>
              {output && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-300 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <textarea
              ref={outRef}
              value={output}
              readOnly
              placeholder={loading ? 'Rewriting…' : 'The rewrite shows up here.'}
              className="flex-1 min-h-[300px] md:min-h-[400px] p-4 bg-transparent border-0 outline-none resize-none font-mono text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* Action row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <p className="text-xs text-zinc-500 flex-1">
            No tool can promise a detector won&apos;t flag your text. Read the rewrite and
            fix anything that doesn&apos;t sound like you. For uni work, check your
            school&apos;s AI policy.
          </p>
          <button
            onClick={handleHumanize}
            disabled={loading || !text.trim()}
            className="px-6 py-3 rounded-xl font-semibold text-black inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 disabled:hover:scale-100"
            style={{
              background: loading ? '#6b7280' : 'linear-gradient(135deg, #b378ff 0%, #d4a3ff 100%)',
              boxShadow: loading ? 'none' : '0 10px 40px -10px rgba(179, 120, 255, 0.6)',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Rewriting…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Humanize
              </>
            )}
          </button>
        </div>

        {/* Note (mode warning) */}
        <AnimatePresence>
          {note && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl border border-amber-400/30 bg-amber-400/5 flex items-start gap-3"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200/90">{note}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pattern ledger */}
        <AnimatePresence>
          {(before.length > 0 || after.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gradient-cool">Pattern check</h2>
                <span className="font-mono text-xs text-zinc-500">
                  {total(before)} before · {total(after)} after
                </span>
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                Patterns from Wikipedia&apos;s &quot;Signs of AI writing&quot; page.
              </p>
              <ul className="space-y-1">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between gap-4 px-3 py-2 rounded-md text-sm transition-colors ${
                      r.fixed
                        ? 'bg-emerald-400/5 border border-emerald-400/20'
                        : 'bg-amber-400/5 border border-amber-400/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          r.fixed
                            ? 'bg-emerald-400/15 text-emerald-300'
                            : 'bg-amber-400/15 text-amber-300'
                        }`}
                      >
                        {r.label}
                      </span>
                      {r.samples.length > 0 && !r.fixed && (
                        <span className="text-xs text-zinc-500 font-mono truncate" title={r.samples.join(' | ')}>
                          still: {r.samples[0]}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono font-bold text-sm whitespace-nowrap ${
                        r.fixed ? 'text-emerald-400' : 'text-zinc-300'
                      }`}
                    >
                      {r.bCount} → {r.aCount}
                      {r.fixed && <Check className="inline-block w-3.5 h-3.5 ml-1" />}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works */}
        <div className="mt-16 grid md:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: '1. Drop your text', desc: 'Up to 8,000 characters. Any tone — casual, neutral, or formal for uni.' },
            { icon: Wand2, title: '2. We rewrite it', desc: 'Rule-based cleanup first (always free), then an LLM pass to rework sentences. Falls back to rules-only if no API key is set.' },
            { icon: ShieldCheck, title: '3. Read & own it', desc: 'You get a pattern check showing exactly what was flagged and fixed. Edit until it sounds like you.' },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-5"
            >
              <s.icon className="w-5 h-5 text-purple-400 mb-3" />
              <h3 className="font-semibold text-white mb-1">{s.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 mt-auto border-t border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-mono text-[10px] text-zinc-500 tracking-widest text-center sm:text-left">
            © 2026 TECHNOBIRDS · HUMANIZER
            <span className="hidden sm:inline mx-2 text-zinc-700">·</span>
            <span className="block sm:inline mt-1 sm:mt-0">
              CRAFTED BY <span className="text-purple-400 font-semibold">SOHAIB AFZAL</span>
            </span>
          </div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-white transition-colors">
            Technobirds suite →
          </Link>
        </div>
      </footer>
    </div>
  )
}
