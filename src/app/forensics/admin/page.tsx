'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Activity, Brain, Clock, FileText, Lock, LogOut, Mail, Shield, User,
} from 'lucide-react'

interface ScanRow {
  id: string; fileName: string; verdict: 'ai'|'human'|'unknown'; aiScore: number;
  author: string|null; editTime: number|null; application: string|null;
  createdAt: string; user: { email: string; name: string|null }|null;
}

const STORAGE_KEY = 'tb_forensics_admin_token'

export default function ForensicsAdminPage() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [scans, setScans] = useState<ScanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) { setToken(saved); setAuthed(true); loadScans(saved) }
  }, [])

  const loadScans = async (t: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/forensics/admin/scans', { headers: { Authorization: `Bearer ${t}` } })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed'); 
        if (res.status === 401) { setAuthed(false); sessionStorage.removeItem(STORAGE_KEY) }
        return
      }
      setScans(data.scans)
    } catch { toast.error('Network error') } finally { setLoading(false) }
  }

  const handleAuth = () => {
    if (!token.trim()) { toast.error('Enter the admin token'); return }
    sessionStorage.setItem(STORAGE_KEY, token.trim())
    setAuthed(true); loadScans(token.trim())
  }

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY); setAuthed(false); setToken(''); setScans([])
  }

  const verdictColor = (v: string) =>
    v === 'ai' ? 'text-red-400 border-red-400/40 bg-red-400/10'
    : v === 'human' ? 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10'
    : 'text-amber-400 border-amber-400/40 bg-amber-400/10'

  const filtered = scans.filter(s => {
    if (!filter) return true
    const f = filter.toLowerCase()
    return s.fileName.toLowerCase().includes(f) || s.user?.email.toLowerCase().includes(f)
      || s.user?.name?.toLowerCase().includes(f) || s.author?.toLowerCase().includes(f)
      || s.verdict.toLowerCase().includes(f)
  })

  const stats = {
    total: scans.length,
    ai: scans.filter(s => s.verdict === 'ai').length,
    human: scans.filter(s => s.verdict === 'human').length,
    unknown: scans.filter(s => s.verdict === 'unknown').length,
    uniqueUsers: new Set(scans.map(s => s.user?.email).filter(Boolean)).size,
    anonymous: scans.filter(s => !s.user).length,
  }

  if (!authed) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="glass-strong rounded-2xl p-8 max-w-md w-full relative">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-bold">TECHNO<span className="text-emerald-400">BIRDS</span></div>
              <div className="font-mono text-[9px] text-zinc-500 tracking-widest">FORENSICS ADMIN</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gradient-cool">Admin access</h1>
          <p className="text-sm text-zinc-400 mb-6">Enter the admin token to view every document scanned.</p>
          <div className="space-y-3">
            <Input type="password" value={token} onChange={e=>setToken(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleAuth()} placeholder="Admin token"
              className="bg-white/5 border-white/10 font-mono" />
            <Button onClick={handleAuth} className="w-full bg-emerald-400 text-black hover:bg-emerald-300 font-semibold">
              <Lock className="w-4 h-4 mr-2" /> Unlock admin panel
            </Button>
            <a href="/forensics" className="block text-center text-xs text-zinc-500 hover:text-zinc-300 pt-2">← Back to scanner</a>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
      <header className="relative border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">TECHNO<span className="text-emerald-400">BIRDS</span>{' '}
              <span className="text-xs font-mono text-zinc-500 ml-1">/ forensics admin</span>
            </div>
            <div className="font-mono text-[9px] text-zinc-500 tracking-widest">SCAN AUDIT TRAIL</div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/forensics" className="text-xs text-zinc-400 hover:text-white px-3">Scanner</a>
            <a href="/" className="text-xs text-zinc-400 hover:text-white px-3">Home</a>
            <Button onClick={handleLogout} variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10 h-8">
              <LogOut className="w-3.5 h-3.5 mr-1" />Lock
            </Button>
          </div>
        </div>
      </header>
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard label="Total scans" value={stats.total} icon={Activity} />
          <StatCard label="AI suspected" value={stats.ai} icon={Brain} color="text-red-400" />
          <StatCard label="Likely human" value={stats.human} icon={Shield} color="text-emerald-400" />
          <StatCard label="Uncertain" value={stats.unknown} icon={FileText} color="text-amber-400" />
          <StatCard label="Unique users" value={stats.uniqueUsers} icon={User} />
          <StatCard label="Anonymous" value={stats.anonymous} icon={Clock} />
        </div>
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-xl font-bold text-gradient-cool">All scans</h2>
          <div className="flex items-center gap-2">
            <Input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter..."
              className="bg-white/5 border-white/10 h-9 w-64 font-mono text-sm" />
            <Button onClick={()=>loadScans(token)} variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10 h-9">
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>
        <Card className="glass p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-black/30">
                  <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest text-zinc-500">SCANNED BY</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest text-zinc-500">FILE</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest text-zinc-500">AUTHOR</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest text-zinc-500">EDIT</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest text-zinc-500">APP</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest text-zinc-500">VERDICT</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest text-zinc-500">AI%</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest text-zinc-500">WHEN</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-zinc-500">{loading ? 'Loading...' : 'No scans match.'}</td></tr>
                ) : filtered.map((s,i) => (
                  <motion.tr key={s.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:Math.min(i*0.02,0.5)}}
                    className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      {s.user ? (
                        <div className="flex items-center gap-1.5 text-white text-xs">
                          <Mail className="w-3 h-3 text-emerald-400" />{s.user.email}
                        </div>
                      ) : <span className="text-xs text-zinc-500 font-mono">anonymous</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300 max-w-[200px] truncate">{s.fileName}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{s.author || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-zinc-400">{s.editTime !== null ? `${s.editTime}m` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400 max-w-[140px] truncate">{s.application || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold ${verdictColor(s.verdict)}`}>{s.verdict.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10"><Progress value={s.aiScore} className="h-1.5 bg-white/5" /></div>
                        <span className="text-xs font-mono text-zinc-400 w-8">{s.aiScore}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 font-mono whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString(undefined, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="text-center mt-10 pb-6 font-mono text-[10px] text-zinc-600 tracking-widest">
          CRAFTED BY <span className="text-emerald-400 font-semibold">SOHAIB AFZAL</span>
        </div>
      </main>
    </div>
  )
}

function StatCard({label, value, icon: Icon, color='text-white'}: {label:string; value:number; icon:React.ElementType; color?:string}) {
  return (
    <Card className="glass p-4 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-20 h-20 bg-emerald-400/5 rounded-full blur-2xl" />
      <div className="relative">
        <Icon className={`w-4 h-4 mb-2 ${color}`} />
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="font-mono text-[9px] tracking-widest text-zinc-500 mt-1 uppercase">{label}</div>
      </div>
    </Card>
  )
}
