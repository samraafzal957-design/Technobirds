'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity, AlertCircle, AlertTriangle, ArrowLeft, Brain, CheckCircle2,
  ChevronRight, Clock, Cpu, Download, FileText, Lock, LogOut, Mail,
  ScanLine, Shield, ShieldCheck, Sparkles, User, Zap,
} from 'lucide-react'

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

type Engine = 'free' | 'paid'

// ============================================================
// Particle background (same as Forensics)
// ============================================================
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let w = (canvas.width = window.innerWidth)
    let h = (canvas.height = window.innerHeight)
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.2 + 0.3,
    }))
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight }
    window.addEventListener('resize', onResize)
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.strokeStyle = `rgba(0, 102, 255, ${(1 - dist / 120) * 0.06})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 102, 255, 0.5)`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-40" aria-hidden />
}

// ============================================================
// Main AI Check page — dark cyber theme matching Forensics
// ============================================================
export default function AICheckPage() {
  const [user, setUser] = useState<User | null>(null)
  const [booted, setBooted] = useState(false)
  const [view, setView] = useState<'login' | 'setup' | 'scan'>('login')
  const [engine, setEngine] = useState<Engine>('free')
  const [serviceAvailable, setServiceAvailable] = useState<boolean | null>(null)

  // Login form
  const [users, setUsers] = useState<Array<{ name: string; state: string; isAdmin: boolean }>>([])
  const [selectedName, setSelectedName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Setup form
  const [setupCode, setSetupCode] = useState('')
  const [setupPassword, setSetupPassword] = useState('')

  // Scan
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/aicheck/me').then(r => r.json()),
      fetch('/api/aicheck/users').then(r => r.json()),
      fetch('/api/aicheck/status').then(r => r.json()),
    ]).then(([meData, usersData, statusData]) => {
      if (meData.user) { setUser(meData.user); setView('scan') }
      else { setUsers(usersData.users || []) }
      setServiceAvailable(statusData.available === true)
    }).finally(() => setBooted(true))
  }, [])

  const handleLogin = async () => {
    if (!selectedName || !password) { toast.error('Name aur password do'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/aicheck/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedName, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsSetup) { setView('setup'); toast.info('Pehle setup code se password set karo') }
        else toast.error(data.error || 'Login fail')
        return
      }
      setUser(data); setView('scan'); toast.success(`Welcome, ${data.name}`)
    } catch { toast.error('Network error') } finally { setLoading(false) }
  }

  const handleSetup = async () => {
    if (!selectedName || !setupCode || !setupPassword) { toast.error('Sab fields bharo'); return }
    if (setupPassword.length < 6) { toast.error('Password min 6 chars'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/aicheck/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedName, code: setupCode, password: setupPassword }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Setup fail'); return }
      setUser(data); setView('scan'); toast.success('Account ready!')
    } catch { toast.error('Network error') } finally { setLoading(false) }
  }

  const handleLogout = async () => {
    await fetch('/api/aicheck/logout', { method: 'POST' })
    setUser(null); setView('login'); setPassword(''); setResult(null); setFile(null)
  }

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.match(/\.(pdf|docx?|txt|rtf)$/i)) { toast.error('PDF, DOCX, DOC, TXT ya RTF'); return }
    if (f.size > 20 * 1024 * 1024) { toast.error('File 20MB se chhoti'); return }
    setFile(f); setScanning(true); setResult(null)
    try {
      const form = new FormData(); form.append('file', f)
      const res = await fetch('/api/aicheck/scan', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        if (data.unavailable) toast.warning(data.detail || 'AI Check temporarily unavailable')
        else toast.error(data.error || 'Scan fail')
        return
      }
      setResult(data)
      const score = data.ai_score ?? data.aiScore ?? 0
      toast.success(`Scan complete — AI score: ${score}%`)
    } catch { toast.error('Network error') } finally { setScanning(false) }
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const downloadReport = async () => {
    if (!result?.scanId) return
    try {
      const res = await fetch(`/api/aicheck/report/${result.scanId}`)
      if (!res.ok) { const data = await res.json(); toast.error(data.error || 'Report nahi mili'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `report-${result.scanId.slice(0, 8)}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { toast.error('Network error') }
  }

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-mono text-blue-400 animate-pulse">INITIALIZING...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <ParticleBackground />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Technobirds</span>
            </Link>
          </div>
          <div className="text-right">
            <div className="font-bold text-lg">
              AI <span className="text-blue-400">CHECK</span>
            </div>
            <div className="font-mono text-[9px] text-zinc-500 tracking-widest">
              AI WRITING DETECTION
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full flex-1">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4">
            <Brain className="w-3 h-3 text-blue-400" />
            <span className="font-mono text-[10px] tracking-widest text-blue-400">
              HYBRID DETECTION · PATTERN RULES + AI ANALYSIS
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            <span className="text-gradient-cool">Check for</span>{' '}
            <span style={{ background: 'linear-gradient(135deg, #0066ff 0%, #00d4ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              AI writing.
            </span>
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Upload any document. Get an instant AI-generation score with a downloadable PDF report.
          </p>
        </motion.div>

        {/* Engine selector */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <Card className="glass p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <Label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2 block">
                  Detection Engine
                </Label>
                <Select value={engine} onValueChange={(v) => setEngine(v as Engine)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    <SelectItem value="free" className="text-white hover:bg-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-mono text-xs">FREE</span>
                        <span>Technobirds Intelligence</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="paid" className="text-white hover:bg-white/10">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-mono text-xs">PAID</span>
                        <span>Turnitin</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {user && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono text-zinc-300">{user.email || user.name}</span>
                  </div>
                  <Button onClick={handleLogout} size="sm" variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 h-8">
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Engine warnings */}
            <AnimatePresence mode="wait">
              {engine === 'free' ? (
                <motion.div
                  key="free-warning"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-3 rounded-lg border border-amber-400/30 bg-amber-400/5 flex items-start gap-3"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200/90 leading-relaxed">
                    <strong>Technobirds Intelligence</strong> is approximately{' '}
                    <strong>80% accurate</strong>. It uses a hybrid rules + LLM engine.
                    For institutional-grade detection, consider the{' '}
                    <strong>Turnitin</strong> option. Always review results before acting on them.
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="paid-warning"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 p-3 rounded-lg border border-blue-400/30 bg-blue-400/5 flex items-start gap-3"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-200/90 leading-relaxed">
                    <strong>Turnitin</strong> integration is coming soon. Contact your admin
                    for institutional access. Turnitin provides the highest accuracy available
                    for AI writing detection.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ============ LOGIN / SETUP ============ */}
          {(view === 'login' || view === 'setup') && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card className="glass p-6 max-w-md mx-auto">
                <h2 className="text-xl font-bold text-white mb-1">
                  {view === 'login' ? 'Sign in' : 'Set your password'}
                </h2>
                <p className="text-sm text-zinc-400 mb-5">
                  {view === 'login'
                    ? 'Select your name and enter your password.'
                    : 'Enter the invite code from admin and your new password.'}
                </p>

                <div className="space-y-4">
                  <div>
                    <Label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5 block">
                      Your Name
                    </Label>
                    <Select value={selectedName} onValueChange={setSelectedName}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="— Select —" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        {users.map(u => (
                          <SelectItem key={u.name} value={u.name} className="text-white hover:bg-white/10">
                            {u.name}{u.isAdmin ? ' (admin)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {view === 'login' ? (
                    <div>
                      <Label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5 block">
                        Password
                      </Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        placeholder="••••••••"
                        className="bg-white/5 border-white/10"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5 block">
                          Setup Code (from admin)
                        </Label>
                        <Input
                          value={setupCode}
                          onChange={e => setSetupCode(e.target.value.toUpperCase())}
                          placeholder="ABCDEFGH"
                          className="bg-white/5 border-white/10 font-mono tracking-widest uppercase"
                          maxLength={8}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5 block">
                          New Password (min 6 chars)
                        </Label>
                        <Input
                          type="password"
                          value={setupPassword}
                          onChange={e => setSetupPassword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSetup()}
                          placeholder="••••••••"
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                    </>
                  )}

                  <Button
                    onClick={view === 'login' ? handleLogin : handleSetup}
                    disabled={loading}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold"
                  >
                    {loading ? 'Please wait…' : view === 'login' ? 'Sign in' : 'Set password'}
                  </Button>

                  {view === 'login' && (
                    <p className="text-xs text-zinc-500 text-center">
                      First time? Ask admin for an invite code, then set up your password.
                    </p>
                  )}
                  {view === 'setup' && (
                    <button
                      onClick={() => setView('login')}
                      className="block mx-auto text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      ← Back to login
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ============ SCAN ============ */}
          {view === 'scan' && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card className="glass p-6 relative overflow-hidden">
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute inset-x-0 h-px bg-blue-400 shadow-[0_0_20px_4px_rgba(0,102,255,0.6)] animate-scanline" />
                  </div>
                )}

                <div className="mb-5">
                  <h2 className="text-xl font-bold text-white mb-1">Scan a document</h2>
                  <p className="text-sm text-zinc-400">
                    Upload a file. Get an AI score + PDF report in seconds.
                  </p>
                </div>

                {serviceAvailable === false && (
                  <div className="mb-4 p-4 rounded-lg border border-amber-400/30 bg-amber-400/5 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-200/90">
                      <strong>AI Check is temporarily unavailable.</strong> The upstream detection
                      service is not connected. Please check back later.
                    </div>
                  </div>
                )}

                <div
                  onClick={() => serviceAvailable !== false && fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`cursor-${serviceAvailable === false ? 'not-allowed' : 'pointer'} relative rounded-2xl border-2 border-dashed transition-all p-10 text-center overflow-hidden ${
                    dragOver
                      ? 'border-blue-400 bg-blue-400/5 scale-[1.01]'
                      : 'border-white/15 hover:border-white/30 bg-white/[0.02]'
                  }`}
                  style={{ opacity: serviceAvailable === false ? 0.5 : 1 }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.rtf"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  />
                  <motion.div
                    animate={scanning ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="inline-flex items-center justify-center w-14 h-14 rounded-2xl glass mb-3"
                  >
                    {scanning ? (
                      <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
                    ) : (
                      <FileText className="w-6 h-6 text-blue-400" />
                    )}
                  </motion.div>
                  <div className="font-mono text-xs tracking-widest text-blue-400/70 mb-1">
                    {scanning ? 'SCANNING…' : serviceAvailable === false ? 'TEMPORARILY UNAVAILABLE' : file ? file.name : 'DROP FILE HERE'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {scanning ? 'AI engine analyzing…' : 'PDF · DOCX · DOC · TXT · RTF · max 20MB'}
                  </div>
                </div>

                {/* Result */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-5 p-5 rounded-xl border border-blue-400/30 bg-blue-400/5"
                  >
                    <div className="font-mono text-[10px] tracking-widest text-blue-400/70 mb-3">RESULT</div>
                    <div className="flex items-baseline gap-3 mb-4">
                      <div className="text-5xl font-bold" style={{ color: (result.ai_score ?? result.aiScore ?? 0) > 50 ? '#ff3b5c' : '#00ff9d' }}>
                        {result.ai_score ?? result.aiScore ?? result.plagiarism_score ?? 0}%
                      </div>
                      <div className="text-zinc-400 text-sm">AI-generated</div>
                    </div>
                    <div className="flex gap-4 text-xs text-zinc-400 mb-4">
                      <span><strong className="text-white">{result.word_count ?? result.wordCount ?? '—'}</strong> words</span>
                      <span>Scan ID: <code className="text-blue-400">{result.scanId.slice(0, 8)}</code></span>
                      {engine === 'free' && <span className="text-amber-400">~80% accurate</span>}
                    </div>
                    <Button onClick={downloadReport} className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold">
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF Report
                    </Button>
                  </motion.div>
                )}
              </Card>

              {/* Admin link */}
              {user?.isAdmin && (
                <div className="mt-4 text-center">
                  <Link href="/aicheck/admin" className="text-xs text-blue-400 hover:text-blue-300 font-mono">
                    Admin Panel →
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 mt-auto border-t border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
          <div className="font-mono text-[10px] text-zinc-500 tracking-widest">
            © 2026 TECHNOBIRDS · AI CHECK
            <span className="mx-2 text-zinc-700">·</span>
            CRAFTED BY <span className="text-blue-400 font-semibold">SOHAIB AFZAL</span>
            <span className="mx-2 text-zinc-700">·</span>
            CONTACT{' '}
            <a href="mailto:sohaibafzalkid@gmail.com" className="text-blue-400 hover:underline">
              sohaibafzalkid@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
