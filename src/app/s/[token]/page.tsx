'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface ShareScan {
  t: string
  user: string
  file: string
  score: number | null
  words: number | null
  status: string
  scanId: string | null
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const [scan, setScan] = useState<ShareScan | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/aicheck/share/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        if (data.needsPassword) {
          setNeedsPassword(true)
          setLoading(false)
        } else {
          setScan(data.scan)
          setLoading(false)
        }
      })
      .catch(() => { setError('Network error'); setLoading(false) })
  }, [token])

  const submitPassword = async () => {
    setError('')
    const res = await fetch(`/api/aicheck/share/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Wrong password'); return }
    setNeedsPassword(false)
    setScan(data.scan)
  }

  if (loading) {
    return (
      <div className="aicheck-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', color: 'var(--a-ivory-dim)' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (error && !scan) {
    return (
      <div className="aicheck-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="aicheck-card"
          style={{ padding: 32, maxWidth: 460, textAlign: 'center' }}
        >
          <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 28, color: 'var(--a-ivory)', margin: 0 }}>
            Link <i style={{ color: 'var(--a-ember)', fontWeight: 400 }}>expired</i>
          </h1>
          <p style={{ marginTop: 12, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontSize: 15, color: 'var(--a-ivory-dim)' }}>
            {error}
          </p>
          <Link href="/" style={{
            display: 'inline-block', marginTop: 18, fontFamily: 'Outfit, sans-serif', fontSize: 13,
            color: 'var(--a-ember)', textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            ← Technobirds home
          </Link>
        </motion.div>
      </div>
    )
  }

  if (needsPassword) {
    return (
      <div className="aicheck-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="aicheck-card"
          style={{ padding: 32, maxWidth: 460 }}
        >
          <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 24, color: 'var(--a-ivory)', margin: 0 }}>
            Password <i style={{ color: 'var(--a-ember)', fontWeight: 400 }}>required</i>
          </h1>
          <p style={{ marginTop: 8, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontSize: 14, color: 'var(--a-faint)' }}>
            Enter the password to view this scan result.
          </p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitPassword()}
            placeholder="••••••••"
            className="aicheck-input"
            style={{ marginTop: 20, marginBottom: 12 }}
            autoFocus
          />
          {error && (
            <p style={{ color: 'var(--a-bad)', fontFamily: 'Outfit, sans-serif', fontSize: 13, marginBottom: 12 }}>
              {error}
            </p>
          )}
          <button onClick={submitPassword} className="aicheck-btn" style={{ width: '100%' }}>
            Unlock
          </button>
        </motion.div>
      </div>
    )
  }

  if (!scan) return null

  return (
    <div className="aicheck-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="aicheck-card"
        style={{ padding: 36, maxWidth: 520, width: '100%' }}
      >
        <div style={{
          fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10,
          letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--a-faint)',
          marginBottom: 12,
        }}>
          SHARED SCAN RESULT
        </div>

        <h1 style={{
          fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 28,
          color: 'var(--a-ivory)', margin: 0, lineHeight: 1.2, wordBreak: 'break-word',
        }}>
          {scan.file}
        </h1>

        <div style={{ marginTop: 24, padding: 22, background: 'rgba(193,86,58,.06)', border: '1px solid rgba(193,86,58,.25)', borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{
              fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 56, lineHeight: 1,
              color: (scan.score ?? 0) > 50 ? 'var(--a-bad)' : 'var(--a-ok)',
            }}>
              {scan.score != null ? `${scan.score}%` : '—'}
            </div>
            <div style={{
              fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontWeight: 400, fontSize: 16,
              color: 'var(--a-ivory-dim)',
            }}>
              AI-generated
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 18, fontFamily: 'Outfit, sans-serif', fontSize: 13, color: 'var(--a-ivory-dim)' }}>
            <span><strong style={{ color: 'var(--a-ivory)', fontWeight: 500 }}>{scan.words ?? '—'}</strong> words</span>
            <span>by <strong style={{ color: 'var(--a-ivory)', fontWeight: 500 }}>{scan.user}</strong></span>
          </div>
          <div style={{ marginTop: 8, fontFamily: 'Outfit, sans-serif', fontSize: 11, color: 'var(--a-faint)' }}>
            Scanned: {new Date(scan.t).toLocaleString()}
          </div>
        </div>

        <p style={{ marginTop: 22, fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontSize: 13, color: 'var(--a-faint)', textAlign: 'center' }}>
          PDF download is not available via share links.
        </p>

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <Link href="/" style={{
            fontFamily: 'Outfit, sans-serif', fontSize: 12, color: 'var(--a-ember)',
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
            Powered by Technobirds
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
