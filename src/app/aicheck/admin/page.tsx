'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

interface ScanRow {
  id: string; internalId: string; userId: string; fileName: string;
  status: string; scanId: string | null; score: number | null; words: number | null;
  error: number | null; createdAt: string;
  user: { name: string; isAdmin: boolean };
}

interface UserRow {
  name: string; admin: boolean; state: string;
  today: number; total: number; last: string | null;
}

export default function AICheckAdminPage() {
  const [authed, setAuthed] = useState(false)
  const [booted, setBooted] = useState(false)
  const [limit, setLimit] = useState(5)
  const [users, setUsers] = useState<UserRow[]>([])
  const [scans, setScans] = useState<ScanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [inviteResult, setInviteResult] = useState<{ name: string; code: string; hours: number } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/aicheck/admin/data')
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to load')
        if (res.status === 403) {
          setTimeout(() => { window.location.href = '/aicheck' }, 1500)
        }
        return
      }
      setLimit(data.limit)
      setUsers(data.users)
      setScans(data.scans)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/aicheck/me').then(r => r.json()).then(data => {
      if (data.user?.isAdmin) {
        setAuthed(true)
        loadData()
      } else {
        setTimeout(() => { window.location.href = '/aicheck' }, 1500)
      }
    }).finally(() => setBooted(true))
  }, [loadData])

  const createUser = async () => {
    if (!newUserName.trim()) return
    try {
      const res = await fetch('/api/aicheck/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setInviteResult({ name: data.name, code: data.code, hours: data.hours })
      setNewUserName('')
      toast.success(`Invite code generated for ${data.name}`)
      loadData()
    } catch { toast.error('Network error') }
  }

  const regenerateInvite = async (name: string) => {
    try {
      const res = await fetch('/api/aicheck/admin/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setInviteResult({ name: data.name, code: data.code, hours: data.hours })
      toast.success(`New code for ${data.name}`)
      loadData()
    } catch { toast.error('Network error') }
  }

  const toggleSelect = (scanId: string) => {
    const next = new Set(selectedIds)
    if (next.has(scanId)) next.delete(scanId)
    else next.add(scanId)
    setSelectedIds(next)
  }

  const deleteSelected = async (failedOnly = false) => {
    try {
      const res = await fetch('/api/aicheck/admin/scans/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failedOnly ? { failedOnly: true } : { ids: [...selectedIds] }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      toast.success(`${data.deleted} scan(s) deleted`)
      setSelectedIds(new Set())
      loadData()
    } catch { toast.error('Network error') }
  }

  const createShare = async (scanId: string) => {
    const password = prompt('Optional password (cancel for none):') || ''
    try {
      const res = await fetch(`/api/aicheck/admin/scans/${scanId}/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      const full = `${window.location.origin}/s/${data.token}`
      navigator.clipboard?.writeText(full)
      toast.success(`Share link copied: /s/${data.token.slice(0, 8)}…`)
    } catch { toast.error('Network error') }
  }

  const downloadReportPdf = () => {
    window.open('/api/aicheck/admin/report.pdf', '_blank')
  }

  if (!booted) {
    return (
      <div className="aicheck-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--a-ivory-dim)' }}>Loading…</div>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="aicheck-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', color: 'var(--a-ivory-dim)', fontSize: 18 }}>
            Admin access required.
          </p>
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13, color: 'var(--a-faint)', marginTop: 8 }}>
            Redirecting to login…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="aicheck-root" style={{ padding: '32px 18px 80px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
          <div>
            <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 30, color: 'var(--a-ivory)', margin: 0 }}>
              Admin <i style={{ color: 'var(--a-ember)', fontWeight: 400 }}>panel</i>
            </h1>
            <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--a-faint)', marginTop: 6 }}>
              DocCheck AI · Technobirds
            </p>
          </div>
          <nav style={{ display: 'flex', gap: 16, fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>
            <Link href="/aicheck" style={{ color: 'var(--a-ivory-dim)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Scanner</Link>
            <Link href="/" style={{ color: 'var(--a-ivory-dim)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Home</Link>
            <button onClick={downloadReportPdf} style={{
              background: 'none', border: '1px solid var(--a-line)', borderRadius: 9,
              padding: '6px 12px', color: 'var(--a-ivory)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
            }}>
              ↓ Report PDF
            </button>
          </nav>
        </header>

        {/* Invite code result */}
        {inviteResult && (
          <div style={{
            marginBottom: 22, padding: 16, borderRadius: 12,
            border: '1px solid rgba(193,86,58,.4)', background: 'rgba(193,86,58,.08)',
          }}>
            <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--a-faint)', marginBottom: 6 }}>
              Invite code for {inviteResult.name} · expires in {inviteResult.hours}h
            </div>
            <code style={{
              display: 'inline-block', fontFamily: 'Outfit, sans-serif', fontWeight: 600,
              fontSize: 24, letterSpacing: '.2em', color: 'var(--a-ivory)',
            }}>
              {inviteResult.code}
            </code>
            <button onClick={() => { navigator.clipboard?.writeText(inviteResult.code); toast.success('Code copied') }} style={{
              marginLeft: 14, background: 'none', border: '1px solid var(--a-line)',
              borderRadius: 8, padding: '6px 10px', color: 'var(--a-ivory-dim)',
              fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
            }}>Copy</button>
            <button onClick={() => setInviteResult(null)} style={{
              marginLeft: 8, background: 'none', border: 0, color: 'var(--a-faint)',
              fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
            }}>Dismiss</button>
          </div>
        )}

        {/* Add user */}
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--a-faint)', margin: '30px 0 12px' }}>
          Add user
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newUserName}
            onChange={e => setNewUserName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createUser()}
            placeholder="New user name (letters, digits, space, _ -)"
            className="aicheck-input"
            style={{ flex: 1, minWidth: 240 }}
          />
          <button onClick={createUser} className="aicheck-btn" style={{ whiteSpace: 'nowrap' }}>
            Create + get invite code
          </button>
        </div>

        {/* Users grid */}
        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--a-faint)', margin: '30px 0 12px' }}>
          Users ({users.length})
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          {users.map(u => (
            <div key={u.name} className="aicheck-card" style={{ padding: 16 }}>
              <h3 style={{
                fontFamily: 'Fraunces, Georgia, serif', fontWeight: 500, fontSize: 18,
                color: 'var(--a-ivory)', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                <span>{u.name}</span>
                <span className={`aicheck-tag ${u.admin ? 'admin' : u.state === 'active' ? 'active' : u.state === 'invited' ? 'invited' : ''}`}>
                  {u.admin ? 'admin' : u.state === 'active' ? 'active' : u.state === 'invited' ? 'invited' : 'needs setup'}
                </span>
              </h3>
              <p style={{ marginTop: 8, fontFamily: 'Outfit, sans-serif', fontSize: 13, color: 'var(--a-ivory-dim)' }}>
                <b style={{ color: 'var(--a-ivory)', fontWeight: 500 }}>{u.today}</b> today ·{' '}
                <b style={{ color: 'var(--a-ivory)', fontWeight: 500 }}>{u.total}</b> total
              </p>
              {u.last && (
                <p style={{ marginTop: 4, fontFamily: 'Outfit, sans-serif', fontSize: 11, color: 'var(--a-faint)' }}>
                  Last: {new Date(u.last).toLocaleString()}
                </p>
              )}
              {!u.admin && (
                <button
                  onClick={() => regenerateInvite(u.name)}
                  style={{
                    marginTop: 12, width: '100%', padding: 9, borderRadius: 9,
                    border: '1px solid var(--a-line)', background: 'rgba(255,255,255,.04)',
                    color: 'var(--a-ivory)', fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {u.state === 'invited' ? 'Regenerate code' : 'Reset password'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Scans table */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', margin: '30px 0 12px' }}>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--a-faint)', margin: 0 }}>
            All scans ({scans.length})
          </h2>
          <div style={{ flex: 1 }} />
          {selectedIds.size > 0 && (
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 13, color: 'var(--a-ivory-dim)' }}>
              {selectedIds.size} selected
            </span>
          )}
          <button
            onClick={() => deleteSelected(false)}
            disabled={selectedIds.size === 0}
            style={{
              background: 'rgba(193,86,58,.12)', border: '1px solid rgba(193,86,58,.5)',
              color: 'var(--a-ivory)', padding: '8px 14px', borderRadius: 9,
              fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 13, cursor: 'pointer',
              opacity: selectedIds.size === 0 ? 0.4 : 1,
            }}
          >
            Delete selected
          </button>
          <button
            onClick={() => deleteSelected(true)}
            style={{
              background: 'rgba(193,86,58,.12)', border: '1px solid rgba(193,86,58,.5)',
              color: 'var(--a-ivory)', padding: '8px 14px', borderRadius: 9,
              fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 13, cursor: 'pointer',
            }}
          >
            Clear failed
          </button>
          <button
            onClick={loadData}
            style={{
              background: 'none', border: '1px solid var(--a-line)',
              color: 'var(--a-ivory-dim)', padding: '8px 14px', borderRadius: 9,
              fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 13, cursor: 'pointer',
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="aicheck-card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--a-line)' }}>
                  <th style={{ padding: '6px 8px', width: 32 }}></th>
                  <th style={{ padding: '11px 14px', textAlign: 'left', fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--a-faint)' }}>When</th>
                  <th style={{ padding: '11px 14px', textAlign: 'left', fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--a-faint)' }}>User</th>
                  <th style={{ padding: '11px 14px', textAlign: 'left', fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--a-faint)' }}>File</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--a-faint)' }}>AI %</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--a-faint)' }}>Words</th>
                  <th style={{ padding: '11px 14px', textAlign: 'left', fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--a-faint)' }}>Status</th>
                  <th style={{ padding: '11px 14px', textAlign: 'left', fontFamily: 'Outfit, sans-serif', fontWeight: 500, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--a-faint)' }}></th>
                </tr>
              </thead>
              <tbody>
                {scans.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 26, textAlign: 'center', fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontSize: 14, color: 'var(--a-faint)' }}>
                    {loading ? 'Loading…' : 'No scans yet.'}
                  </td></tr>
                ) : scans.map(s => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ borderBottom: '1px solid var(--a-line)', transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.scanId || s.internalId)}
                        onChange={() => toggleSelect(s.scanId || s.internalId)}
                        style={{ accentColor: 'var(--a-ember)', width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'Outfit, sans-serif', fontSize: 12, color: 'var(--a-ivory-dim)' }}>
                      {new Date(s.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'Outfit, sans-serif', fontSize: 13, color: s.user.isAdmin ? 'var(--a-ember)' : 'var(--a-ivory)' }}>
                      {s.user.name}
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'Outfit, sans-serif', fontSize: 12, color: 'var(--a-ivory-dim)', maxWidth: 280, wordBreak: 'break-all' }}>
                      {s.fileName}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 14, color: (s.score ?? 0) > 50 ? 'var(--a-bad)' : 'var(--a-ok)' }}>
                      {s.score != null ? `${s.score}%` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'Outfit, sans-serif', fontSize: 12, color: 'var(--a-ivory-dim)' }}>
                      {s.words != null ? s.words : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'Outfit, sans-serif', fontSize: 12 }}>
                      <span style={{
                        color: s.status === 'done' ? 'var(--a-ok)' : s.status === 'failed' ? 'var(--a-bad)' : 'var(--a-ivory-dim)',
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {s.status === 'done' && s.scanId && (
                        <button
                          onClick={() => createShare(s.scanId)}
                          style={{
                            background: 'none', border: '1px solid var(--a-line)', borderRadius: 7,
                            padding: '5px 10px', color: 'var(--a-ivory-dim)',
                            fontFamily: 'Outfit, sans-serif', fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          Share
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 40, textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', color: 'var(--a-faint)' }}>
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
