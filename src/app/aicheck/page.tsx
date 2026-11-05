'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

// ============================================================
// Ink particle background — same vibe as original DocCheck
// ============================================================
function InkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let w = (canvas.width = window.innerWidth)
    let h = (canvas.height = window.innerHeight)

    type P = { x: number; y: number; vx: number; vy: number; r: number }
    const particles: P[] = Array.from({ length: 50 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1.2 + 0.3,
    }))

    const onResize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const draw = () => {
      ctx.fillStyle = 'rgba(10, 9, 8, 0.06)'
      ctx.fillRect(0, 0, w, h)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(233, 224, 204, 0.4)'
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" aria-hidden />
}

// ============================================================
// Main AI Check page
// ============================================================
interface User { name: string; isAdmin: boolean }
interface ScanResult {
  scanId: string
  ai_score?: number
  aiScore?: number
  plagiarism_score?: number
  word_count?: number
  wordCount?: number
  status: string
  report_url: string
}

export default function AICheckPage() {
  // AI CHECK TEMPORARILY LOCKED — show unavailable screen instead of login/scan UI.
  // Admin can still access /aicheck/admin directly via URL.
  return (
    <div className="aicheck-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="aicheck-card"
        style={{ padding: 36, maxWidth: 460, width: '100%', textAlign: 'center' }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'rgba(193, 86, 58, .12)', border: '1px solid rgba(193, 86, 58, .35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <span style={{
            fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 500,
            fontSize: 28, color: 'var(--a-ember)',
          }}>!</span>
        </div>
        <h1 style={{
          fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 26,
          color: 'var(--a-ivory)', margin: '0 0 10px',
        }}>
          AI Check is <i style={{ color: 'var(--a-ember)', fontWeight: 400 }}>temporarily unavailable</i>
        </h1>
        <p style={{
          fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400,
          fontSize: 14, color: 'var(--a-ivory-dim)', lineHeight: 1.6, margin: '0 0 22px',
        }}>
          The upstream AI detection service is not connected right now. Please check back later.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block', padding: '11px 22px', borderRadius: 10,
            background: 'var(--a-ivory)', color: '#12100d',
            fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 14,
            textDecoration: 'none',
          }}
        >
          ← Back to Technobirds
        </a>
        <div style={{
          marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--a-line)',
          fontFamily: 'Outfit, sans-serif', fontSize: 10, letterSpacing: '.3em',
          textTransform: 'uppercase', color: 'var(--a-faint)',
        }}>
          Crafted by <span style={{ color: 'var(--a-ember)', fontWeight: 600 }}>Sohaib Afzal</span>
          {' '}·{' '}
          <a href="mailto:sohaibafzalkid@gmail.com" style={{ color: 'var(--a-ember)', textDecoration: 'underline' }}>
            sohaibafzalkid@gmail.com
          </a>
        </div>
      </motion.div>
    </div>
  )
}

function AICheckPageInner() {
  const [user, setUser] = useState<User | null>(null)
  const [booted, setBooted] = useState(false)
  const [view, setView] = useState<'login' | 'setup' | 'scan'>('login')

  // Login form state
  const [users, setUsers] = useState<Array<{ name: string; state: string; isAdmin: boolean }>>([])
  const [selectedName, setSelectedName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Setup form state
  const [setupCode, setSetupCode] = useState('')
  const [setupPassword, setSetupPassword] = useState('')

  // Scan state
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initial load — check session, list users, and check service status
  useEffect(() => {
    Promise.all([
      fetch('/api/aicheck/me').then(r => r.json()),
      fetch('/api/aicheck/users').then(r => r.json()),
      fetch('/api/aicheck/status').then(r => r.json()),
    ]).then(([meData, usersData, statusData]) => {
      if (meData.user) {
        setUser(meData.user)
        setView('scan')
      } else {
        setUsers(usersData.users || [])
      }
      setServiceAvailable(statusData.available === true)
    }).finally(() => setBooted(true))
  }, [])

  const handleLogin = async () => {
    if (!selectedName || !password) {
      toast.error('Name aur password do')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/aicheck/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedName, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsSetup) {
          setView('setup')
          toast.info('Pehle setup code se password set karo')
        } else {
          toast.error(data.error || 'Login fail')
        }
        return
      }
      setUser(data)
      setView('scan')
      toast.success(`Khush aamdeed, ${data.name}`)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async () => {
    if (!selectedName || !setupCode || !setupPassword) {
      toast.error('Sab fields bharo')
      return
    }
    if (setupPassword.length < 6) {
      toast.error('Password kam az kam 6 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/aicheck/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedName, code: setupCode, password: setupPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Setup fail')
        return
      }
      setUser(data)
      setView('scan')
      toast.success('Account ready!')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/aicheck/logout', { method: 'POST' })
    setUser(null)
    setView('login')
    setPassword('')
    setResult(null)
    setFile(null)
  }

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.match(/\.(pdf|docx?|txt|rtf)$/i)) {
      toast.error('PDF, DOCX, DOC, TXT ya RTF upload karo')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error('File 20MB se chhoti honi chahiye')
      return
    }
    setFile(f)
    setScanning(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', f)
      const res = await fetch('/api/aicheck/scan', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Scan fail')
        return
      }
      setResult(data)
      const score = data.ai_score ?? data.aiScore ?? data.plagiarism_score ?? 0
      toast.success(`Scan complete — AI score: ${score}%`)
    } catch {
      toast.error('Network error')
    } finally {
      setScanning(false)
    }
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const downloadReport = async () => {
    if (!result?.scanId) return
    try {
      const res = await fetch(`/api/aicheck/report/${result.scanId}`)
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Report nahi mili')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${result.scanId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Network error')
    }
  }

  if (!booted) {
    return (
      <div className="aicheck-root flex items-center justify-center">
        <div style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--a-ivory-dim)' }}>
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div className="aicheck-root" style={{ padding: '32px 18px 100px' }}>
      <InkBackground />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontWeight: 500,
            fontSize: 'clamp(26px, 5vw, 34px)',
            letterSpacing: '.02em',
            color: 'var(--a-ivory)',
          }}>
            DocCheck <i style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--a-ivory-dim)' }}>AI</i>
          </div>
          <div style={{
            marginTop: 8, fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10,
            letterSpacing: '.42em', textTransform: 'uppercase', color: 'var(--a-faint)',
          }}>
            Technobirds Assignments
          </div>
          <div style={{ marginTop: 16 }}>
            <Link href="/" style={{
              fontFamily: 'Outfit, sans-serif', fontSize: 12, color: 'var(--a-faint)',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}>← Back to Technobirds</Link>
            {user && (
              <>
                <span style={{ color: 'var(--a-faint)', margin: '0 10px' }}>·</span>
                <button onClick={handleLogout} style={{
                  background: 'none', border: 0, color: 'var(--a-ivory-dim)',
                  fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}>Logout ({user.name})</button>
                {user.isAdmin && (
                  <>
                    <span style={{ color: 'var(--a-faint)', margin: '0 10px' }}>·</span>
                    <Link href="/aicheck/admin" style={{
                      fontFamily: 'Outfit, sans-serif', fontSize: 12, color: 'var(--a-ember)',
                      textDecoration: 'underline', textUnderlineOffset: 3,
                    }}>Admin panel</Link>
                  </>
                )}
              </>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {/* ============ LOGIN / SETUP ============ */}
          {view === 'login' || view === 'setup' ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="aicheck-card"
              style={{ padding: 32 }}
            >
              <div style={{ marginBottom: 22 }}>
                <h2 style={{
                  fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 24,
                  color: 'var(--a-ivory)', margin: 0,
                }}>
                  {view === 'login' ? 'Sign in' : 'Set your password'}
                </h2>
                <p style={{
                  marginTop: 5, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                  fontWeight: 400, fontSize: 14, color: 'var(--a-faint)',
                }}>
                  {view === 'login'
                    ? 'Apna naam select karo, password daalo.'
                    : 'Admin ne invite code diya hai — woh aur apna naya password daalo.'}
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="aicheck-label">Your name</label>
                <select
                  value={selectedName}
                  onChange={e => setSelectedName(e.target.value)}
                  className="aicheck-input"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">— Select —</option>
                  {users.map(u => (
                    <option key={u.name} value={u.name} style={{ background: '#1a1a1a' }}>
                      {u.name}{u.isAdmin ? ' (admin)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {view === 'login' ? (
                <div style={{ marginBottom: 20 }}>
                  <label className="aicheck-label">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="••••••••"
                    className="aicheck-input"
                  />
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <label className="aicheck-label">Setup code (from admin)</label>
                    <input
                      type="text"
                      value={setupCode}
                      onChange={e => setSetupCode(e.target.value.toUpperCase())}
                      placeholder="ABCDEFGH"
                      className="aicheck-input"
                      style={{ letterSpacing: '.2em', textTransform: 'uppercase' }}
                      maxLength={8}
                    />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label className="aicheck-label">New password (min 6 chars)</label>
                    <input
                      type="password"
                      value={setupPassword}
                      onChange={e => setSetupPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSetup()}
                      placeholder="••••••••"
                      className="aicheck-input"
                    />
                  </div>
                </>
              )}

              <button
                onClick={view === 'login' ? handleLogin : handleSetup}
                disabled={loading}
                className="aicheck-btn"
                style={{ width: '100%' }}
              >
                {loading ? 'Please wait…' : view === 'login' ? 'Sign in' : 'Set password'}
              </button>

              {view === 'login' && (
                <p style={{
                  marginTop: 16, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                  fontWeight: 400, fontSize: 13, color: 'var(--a-faint)', textAlign: 'center',
                }}>
                  Pehli baar? Admin se invite code mango, phir setup karo.
                </p>
              )}
              {view === 'setup' && (
                <button
                  onClick={() => setView('login')}
                  style={{
                    marginTop: 16, display: 'block', margin: '16px auto 0', background: 'none',
                    border: 0, color: 'var(--a-faint)', fontFamily: 'inherit', fontSize: 13,
                    cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
                  }}
                >
                  ← Back to login
                </button>
              )}
            </motion.div>
          ) : (
            /* ============ SCAN ============ */
            <motion.div
              key="scan"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="aicheck-card"
              style={{ padding: 32, position: 'relative', overflow: 'hidden' }}
            >
              {scanning && (
                <div style={{
                  position: 'absolute', left: '10%', right: '10%', height: 1, borderRadius: 1,
                  background: 'linear-gradient(90deg, transparent, rgba(233,224,204,.55), transparent)',
                  animation: 'aicheck-sweep 2.2s ease-in-out infinite',
                  pointerEvents: 'none', zIndex: 2,
                }} />
              )}
              <style>{`@keyframes aicheck-sweep { 0%,100% { top: 10px } 50% { top: calc(100% - 11px) } }`}</style>

              <div style={{ marginBottom: 22 }}>
                <h2 style={{
                  fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 24,
                  color: 'var(--a-ivory)', margin: 0,
                }}>
                  Scan a document
                </h2>
                <p style={{
                  marginTop: 5, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                  fontWeight: 400, fontSize: 14, color: 'var(--a-faint)',
                }}>
                  Upload karo. AI score + PDF report seconds mein.
                </p>
              </div>

              {serviceAvailable === false && (
                <div style={{
                  marginBottom: 20, padding: '18px 20px', borderRadius: 12,
                  border: '1px solid rgba(193, 86, 58, .35)',
                  background: 'rgba(193, 86, 58, .08)',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(193, 86, 58, .15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                    fontWeight: 500, color: 'var(--a-ember)', fontSize: 16,
                  }}>!</div>
                  <div>
                    <div style={{
                      fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 16,
                      color: 'var(--a-ivory)', marginBottom: 4,
                    }}>
                      AI Check is temporarily unavailable
                    </div>
                    <div style={{
                      fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                      fontWeight: 400, fontSize: 13, color: 'var(--a-ivory-dim)',
                      lineHeight: 1.5,
                    }}>
                      The upstream AI detection service is not connected right now. Please check back later.
                    </div>
                  </div>
                </div>
              )}

              <div
                onClick={() => serviceAvailable !== false && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                style={{
                  cursor: serviceAvailable === false ? 'not-allowed' : 'pointer',
                  opacity: serviceAvailable === false ? 0.4 : 1,
                  border: `2px dashed ${dragOver ? 'var(--a-ember)' : 'rgba(233,224,204,.2)'}`,
                  borderRadius: 14, padding: '36px 18px', textAlign: 'center',
                  background: dragOver ? 'rgba(193,86,58,.05)' : 'rgba(255,255,255,.025)',
                  transition: 'border-color .2s, background .2s, opacity .2s',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.rtf"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
                <div style={{
                  fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 13,
                  letterSpacing: '.2em', textTransform: 'uppercase',
                  color: scanning ? 'var(--a-ember)' : serviceAvailable === false ? 'var(--a-faint)' : 'var(--a-ivory-dim)',
                }}>
                  {scanning
                    ? 'SCANNING…'
                    : serviceAvailable === false
                      ? 'TEMPORARILY UNAVAILABLE'
                      : file ? file.name : 'DROP FILE HERE'}
                </div>
                <div style={{
                  marginTop: 6, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                  fontWeight: 400, fontSize: 13, color: 'var(--a-faint)',
                }}>
                  {scanning
                    ? 'Scopelens AI engine se check ho raha hai…'
                    : serviceAvailable === false
                      ? 'Please check back later.'
                      : 'PDF · DOCX · DOC · TXT · RTF · max 20MB'}
                </div>
              </div>

              {/* Result */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: 24, padding: 22,
                    background: 'rgba(193, 86, 58, .06)',
                    border: '1px solid rgba(193, 86, 58, .25)',
                    borderRadius: 14,
                  }}
                >
                  <div style={{
                    fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10,
                    letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--a-faint)',
                    marginBottom: 12,
                  }}>
                    RESULT
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500,
                      fontSize: 56, lineHeight: 1,
                      color: (result.ai_score ?? result.aiScore ?? 0) > 50 ? 'var(--a-bad)' : 'var(--a-ok)',
                    }}>
                      {result.ai_score ?? result.aiScore ?? result.plagiarism_score ?? 0}%
                    </div>
                    <div style={{
                      fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                      fontWeight: 400, fontSize: 16, color: 'var(--a-ivory-dim)',
                    }}>
                      AI-generated
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', gap: 16, fontFamily: 'Outfit, sans-serif', fontSize: 13,
                    color: 'var(--a-ivory-dim)', marginBottom: 16,
                  }}>
                    <span><strong style={{ color: 'var(--a-ivory)' }}>{result.word_count ?? result.wordCount ?? '—'}</strong> words</span>
                    <span>Scan ID: <code style={{ fontFamily: 'Outfit, monospace', color: 'var(--a-ivory)' }}>{result.scanId.slice(0, 8)}</code></span>
                  </div>
                  <button
                    onClick={downloadReport}
                    className="aicheck-btn"
                    style={{ width: '100%' }}
                  >
                    Download PDF report ↓
                  </button>
                </motion.div>
              )}

              {/* Tips */}
              {!result && !scanning && (
                <p style={{
                  marginTop: 20, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                  fontWeight: 400, fontSize: 13, color: 'var(--a-faint)', textAlign: 'center',
                }}>
                  Files scopelens.ai ke AI detection engine pe scan hote hain. Result ek PDF report ke saath aata hai.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer credit */}
        <div style={{
          marginTop: 40, textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: 10,
          letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--a-faint)',
        }}>
          Crafted by <span style={{ color: 'var(--a-ember)', fontWeight: 600 }}>Sohaib Afzal</span>
          {' '}·{' '}Contact{' '}
          <a href="mailto:sohaibafzalkid@gmail.com" style={{ color: 'var(--a-ember)', textDecoration: 'underline' }}>
            sohaibafzalkid@gmail.com
          </a>
        </div>
      </div>
    </div>
  )
}
