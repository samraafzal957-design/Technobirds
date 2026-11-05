'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  Fingerprint,
  Lock,
  LogOut,
  Mail,
  ScanLine,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  User,
  XCircle,
  Zap,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================
interface ScanResult {
  ok: boolean
  fileName: string
  metadata: {
    creator: string
    lastModifiedBy: string
    title: string
    subject: string
    keywords: string
    description: string
    category: string
    contentStatus: string
    revision: string
    created: string
    modified: string
    application: string
    company: string
    totalTime: string
    editTimeMinutes: number
    wordCount: number
    paragraphCount: number
    fileSize: number
  }
  verdict: 'ai' | 'human' | 'unknown'
  aiScore: number
  flags: { key: string; label: string; severity: 'low' | 'high'; reason: string }[]
}

interface User {
  id: string
  email: string
  name: string | null
  createdAt?: string
}

// ============================================================================
// Animated Particle Background
// ============================================================================
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

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      hue: Math.random() > 0.5 ? 156 : 215,
    }))

    const onResize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 130) {
            ctx.strokeStyle = `rgba(0, 255, 157, ${(1 - dist / 130) * 0.08})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 100%, 60%, 0.6)`
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

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-60"
      aria-hidden
    />
  )
}

// ============================================================================
// Cursor Glow
// ============================================================================
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!ref.current) return
      ref.current.style.transform = `translate(${e.clientX - 250}px, ${e.clientY - 250}px)`
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])
  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none z-0 transition-transform duration-100 ease-out"
      style={{
        background:
          'radial-gradient(circle, rgba(0,255,157,0.06) 0%, rgba(0,102,255,0.04) 30%, transparent 70%)',
        mixBlendMode: 'screen',
      }}
      aria-hidden
    />
  )
}

// ============================================================================
// Live Terminal Ticker
// ============================================================================
function TerminalTicker() {
  const lines = [
    '$ technobirds scan --deep doc.docx',
    '> reading OOXML package structure...',
    '> extracting docProps/core.xml ✓',
    '> extracting docProps/app.xml ✓',
    '> verifying _rels/.rels integrity...',
    '> cross-checking [Content_Types].xml overrides...',
    '> applying heuristic AI-detection model...',
    '> author anomaly: clean',
    '> edit-time anomaly: 12 min — FLAG',
    '> application anomaly: clean',
    '> verdict: AI suspected (score: 35)',
    '> ready to sanitize — 9 fields editable',
    '$ _',
  ]
  const [visible, setVisible] = useState<string[]>([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (current >= lines.length) return
    const t = setTimeout(() => {
      setVisible((v) => [...v, lines[current]])
      setCurrent((c) => c + 1)
    }, 350)
    return () => clearTimeout(t)
  }, [current])

  return (
    <div className="font-mono text-[11px] sm:text-xs leading-relaxed text-emerald-400/80">
      <AnimatePresence mode="popLayout">
        {visible.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="whitespace-pre"
          >
            {line}
            {i === visible.length - 1 && current < lines.length && (
              <span className="animate-blink">▋</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {current >= lines.length && <span className="animate-blink">▋</span>}
    </div>
  )
}

// ============================================================================
// Auth Modal
// ============================================================================
function AuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean
  onClose: () => void
  onAuthed: (u: User) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)

  const reset = () => {
    setEmail('')
    setName('')
    setPassword('')
    setOtp('')
    setStep('credentials')
    setDevCode(null)
  }

  const handleSendOtp = async () => {
    setLoading(true)
    try {
      const endpoint = mode === 'register' ? '/api/forensics/auth/register' : '/api/forensics/auth/login'
      const body: Record<string, unknown> = { email, password }
      if (mode === 'register' && name) body.name = name

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed')
        return
      }
      if (data.devCode) {
        setDevCode(data.devCode)
        toast.info(`Dev mode: code is ${data.devCode}`)
      } else {
        toast.success('OTP sent to your email')
      }
      setStep('otp')
    } catch (e) {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/forensics/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Verification failed')
        return
      }
      toast.success(mode === 'register' ? 'Account created!' : 'Welcome back!')
      onAuthed(data.user)
      reset()
      onClose()
    } catch (e) {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="glass-strong border-white/10 max-w-md p-0 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="relative p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
              <Fingerprint className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-mono text-xs tracking-widest text-emerald-400">
              TECHNOBIRDS // SECURE ACCESS
            </span>
          </div>

          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold text-gradient-cool">
              {mode === 'register' ? 'Create your account' : 'Welcome back'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {step === 'credentials'
                ? 'Email + password. We email you a 6-digit code as second factor.'
                : 'Enter the 6-digit code we just sent to your inbox.'}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {step === 'credentials' ? (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {mode === 'register' && (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs text-zinc-400">
                      Display name (optional)
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Kriti Khati Chhetri"
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs text-zinc-400">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs text-zinc-400">
                    Password {mode === 'register' && '(min 8 chars)'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <Button
                  onClick={handleSendOtp}
                  disabled={loading || !email || !password || (mode === 'register' && password.length < 8)}
                  className="w-full bg-emerald-400 text-black hover:bg-emerald-300 font-semibold"
                >
                  {loading ? 'Sending...' : 'Send verification code'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <div className="text-center text-xs text-zinc-500 pt-2">
                  {mode === 'register' ? 'Already have an account?' : "Don't have one?"}{' '}
                  <button
                    onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                    className="text-emerald-400 hover:underline"
                  >
                    {mode === 'register' ? 'Sign in' : 'Sign up'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {devCode && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-300 font-mono">
                    DEV MODE — your code: <span className="font-bold">{devCode}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400">6-digit code</Label>
                  <div className="flex justify-center pt-2">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(v) => setOtp(v)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="bg-white/5 border-white/15 text-white" />
                        <InputOTPSlot index={1} className="bg-white/5 border-white/15 text-white" />
                        <InputOTPSlot index={2} className="bg-white/5 border-white/15 text-white" />
                        <InputOTPSlot index={3} className="bg-white/5 border-white/15 text-white" />
                        <InputOTPSlot index={4} className="bg-white/5 border-white/15 text-white" />
                        <InputOTPSlot index={5} className="bg-white/5 border-white/15 text-white" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                <Button
                  onClick={handleVerify}
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-emerald-400 text-black hover:bg-emerald-300 font-semibold"
                >
                  {loading ? 'Verifying...' : 'Verify & continue'}
                  <ShieldCheck className="w-4 h-4 ml-1" />
                </Button>
                <button
                  onClick={() => setStep('credentials')}
                  className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
                >
                  ← Back
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Scanner Component
// ============================================================================
function Scanner({ user }: { user: User | null }) {
  const [file, setFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith('.docx')) {
      toast.error('Please upload a .docx file')
      return
    }
    setFile(f)
    setScanning(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', f)
      const res = await fetch('/api/forensics/scan', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Scan failed')
        return
      }
      setResult(data)
      // Initialize edit form with current values
      const m = data.metadata
      setEditValues({
        creator: m.creator || '',
        lastModifiedBy: m.lastModifiedBy || '',
        title: m.title || '',
        application: m.application || 'Microsoft Office Word',
        company: m.company || '',
        totalTime: m.totalTime || '0',
        created: isoToLocalInput(m.created),
        modified: isoToLocalInput(m.modified),
        revision: m.revision || '1',
        subject: m.subject || '',
        keywords: m.keywords || '',
        category: m.category || '',
        contentStatus: m.contentStatus || '',
        description: m.description || '',
      })
      toast.success(`Scan complete — verdict: ${data.verdict.toUpperCase()}`)
    } catch (e) {
      toast.error('Network error during scan')
    } finally {
      setScanning(false)
    }
  }, [])

  const isoToLocalInput = (iso: string): string => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return ''
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return ''
    }
  }

  const localToIso = (local: string): string => {
    if (!local) return ''
    try {
      const d = new Date(local)
      if (isNaN(d.getTime())) return ''
      return d.toISOString().split('.')[0] + 'Z'
    } catch {
      return ''
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const sanitize = async () => {
    if (!file) return
    setSaving(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const updates = {
        creator: editValues.creator,
        lastModifiedBy: editValues.lastModifiedBy,
        title: editValues.title,
        subject: editValues.subject,
        keywords: editValues.keywords,
        category: editValues.category,
        contentStatus: editValues.contentStatus,
        description: editValues.description,
        revision: editValues.revision,
        created: localToIso(editValues.created),
        modified: localToIso(editValues.modified),
        application: editValues.application,
        company: editValues.company,
        totalTime: editValues.totalTime,
      }
      form.append('updates', JSON.stringify(updates))

      const res = await fetch('/api/forensics/scan/sanitize', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Sanitize failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sanitized_${file.name}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Sanitized document downloaded')
    } catch (e) {
      toast.error('Network error during sanitize')
    } finally {
      setSaving(false)
    }
  }

  const verdictColor = (v: string) =>
    v === 'ai'
      ? 'text-red-400 border-red-400/40 bg-red-400/10'
      : v === 'human'
        ? 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10'
        : 'text-amber-400 border-amber-400/40 bg-amber-400/10'

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-12 text-center overflow-hidden ${
          dragOver
            ? 'border-emerald-400 bg-emerald-400/5 scale-[1.01]'
            : 'border-white/15 hover:border-white/30 bg-white/[0.02]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {scanning && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-x-0 h-px bg-emerald-400 shadow-[0_0_20px_4px_rgba(0,255,157,0.6)] animate-scanline" />
          </div>
        )}
        <motion.div
          animate={scanning ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass mb-4"
        >
          {scanning ? (
            <ScanLine className="w-7 h-7 text-emerald-400 animate-pulse" />
          ) : (
            <FileText className="w-7 h-7 text-emerald-400" />
          )}
        </motion.div>
        <div className="font-mono text-xs tracking-widest text-emerald-400/70 mb-2">
          {scanning ? 'SCANNING...' : 'DROP .DOCX HERE'}
        </div>
        <div className="text-sm text-zinc-500">
          {file ? (
            <span className="text-zinc-300 font-mono">{file.name}</span>
          ) : (
            'Files processed 100% locally in your browser. Zero data leaves your machine.'
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid lg:grid-cols-2 gap-6"
          >
            {/* Metadata Display */}
            <Card className="glass p-6 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full blur-3xl" />
              <div className="relative flex items-center justify-between">
                <div>
                  <div className="font-mono text-[10px] tracking-widest text-emerald-400/70 mb-1">
                    EXTRACTED METADATA
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {result.fileName}
                  </h3>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-full border text-xs font-mono font-bold ${verdictColor(
                    result.verdict
                  )}`}
                >
                  {result.verdict === 'ai'
                    ? 'AI SUSPECTED'
                    : result.verdict === 'human'
                      ? 'LIKELY HUMAN'
                      : 'UNCERTAIN'}
                </div>
              </div>

              {/* AI Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-mono">AI PROBABILITY</span>
                  <span className="font-bold text-white">{result.aiScore}%</span>
                </div>
                <Progress
                  value={result.aiScore}
                  className="h-2 bg-white/5"
                  // Color via indicator style
                />
              </div>

              {/* Flags */}
              {result.flags.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-mono text-zinc-500">FLAGS RAISED</div>
                  {result.flags.map((f, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 text-xs p-2 rounded-md ${
                        f.severity === 'high'
                          ? 'bg-red-400/5 border border-red-400/20'
                          : 'bg-amber-400/5 border border-amber-400/20'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                          f.severity === 'high' ? 'text-red-400' : 'text-amber-400'
                        }`}
                      />
                      <div>
                        <span className="font-semibold text-white">{f.label}:</span>{' '}
                        <span className="text-zinc-400">{f.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="bg-white/5" />

              {/* Fields */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                {[
                  ['Author', result.metadata.creator],
                  ['Last Modified By', result.metadata.lastModifiedBy],
                  ['Title', result.metadata.title],
                  ['Edit Time', `${result.metadata.editTimeMinutes} min`],
                  ['Application', result.metadata.application],
                  ['Company', result.metadata.company],
                  ['Created', result.metadata.created?.split('T')[0] || '—'],
                  ['Modified', result.metadata.modified?.split('T')[0] || '—'],
                  ['Revision', result.metadata.revision],
                  ['Word Count', result.metadata.wordCount.toString()],
                  ['Paragraphs', result.metadata.paragraphCount.toString()],
                  ['File Size', `${(result.metadata.fileSize / 1024).toFixed(1)} KB`],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="flex justify-between items-center text-xs py-1.5 border-b border-white/5"
                  >
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-mono text-zinc-200 truncate ml-4 max-w-[60%] text-right">
                      {val || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Edit & Sanitize */}
            <Card className="glass p-6 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
              <div className="relative">
                <div className="font-mono text-[10px] tracking-widest text-blue-400/70 mb-1">
                  EDIT & SANITIZE
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Forge new metadata</h3>
                <p className="text-xs text-zinc-500 mb-4">
                  Edit any field. We&apos;ll rebuild the OOXML package with the proper{' '}
                  <code className="text-emerald-400">_rels/.rels</code> and{' '}
                  <code className="text-emerald-400">[Content_Types].xml</code> entries so
                  Word actually reads them.
                </p>

                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                  <Field label="Author / Creator" value={editValues.creator || ''} onChange={(v) => setEditValues({ ...editValues, creator: v })} />
                  <Field label="Last Modified By" value={editValues.lastModifiedBy || ''} onChange={(v) => setEditValues({ ...editValues, lastModifiedBy: v })} />
                  <Field label="Title" value={editValues.title || ''} onChange={(v) => setEditValues({ ...editValues, title: v })} full />
                  <Field label="Application" value={editValues.application || ''} onChange={(v) => setEditValues({ ...editValues, application: v })} />
                  <Field label="Company" value={editValues.company || ''} onChange={(v) => setEditValues({ ...editValues, company: v })} />
                  <Field label="Total Edit Time (min)" value={editValues.totalTime || ''} onChange={(v) => setEditValues({ ...editValues, totalTime: v })} type="number" />
                  <Field label="Revision" value={editValues.revision || ''} onChange={(v) => setEditValues({ ...editValues, revision: v })} />
                  <Field label="Subject" value={editValues.subject || ''} onChange={(v) => setEditValues({ ...editValues, subject: v })} full />
                  <Field label="Keywords" value={editValues.keywords || ''} onChange={(v) => setEditValues({ ...editValues, keywords: v })} full />
                  <Field label="Category" value={editValues.category || ''} onChange={(v) => setEditValues({ ...editValues, category: v })} />
                  <Field label="Content Status" value={editValues.contentStatus || ''} onChange={(v) => setEditValues({ ...editValues, contentStatus: v })} />
                  <Field label="Created Date" value={editValues.created || ''} onChange={(v) => setEditValues({ ...editValues, created: v })} type="datetime-local" full />
                  <Field label="Modified Date" value={editValues.modified || ''} onChange={(v) => setEditValues({ ...editValues, modified: v })} type="datetime-local" full />
                  <Field label="Description" value={editValues.description || ''} onChange={(v) => setEditValues({ ...editValues, description: v })} full />
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={sanitize}
                    disabled={saving}
                    className="flex-1 bg-emerald-400 text-black hover:bg-emerald-300 font-semibold"
                  >
                    {saving ? (
                      <>
                        <Activity className="w-4 h-4 mr-2 animate-spin" />
                        Sanitizing...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download Sanitized Doc
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null)
                      setResult(null)
                    }}
                    className="border-white/10 bg-white/5 hover:bg-white/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  full = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  full?: boolean
}) {
  return (
    <div className={`space-y-1 ${full ? 'col-span-2' : ''}`}>
      <Label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border-white/10 text-sm h-9 font-mono"
      />
    </div>
  )
}

// ============================================================================
// Features Grid
// ============================================================================
function FeaturesGrid() {
  const features = [
    {
      icon: Eye,
      title: 'Deep OOXML Inspection',
      desc: 'Reads docProps/core.xml + app.xml, _rels/.rels integrity, and [Content_Types].xml overrides. Nothing hides.',
    },
    {
      icon: Brain,
      title: 'AI-Generation Heuristics',
      desc: 'Multi-signal scoring: default authors, sub-30min edit times, non-Word applications, missing modification dates.',
    },
    {
      icon: ShieldCheck,
      title: 'Bulletproof Sanitization',
      desc: 'Rewrites metadata and rebuilds package relationships so Word actually reads them — no more "0 minutes" bug.',
    },
    {
      icon: Lock,
      title: 'Email + MFA Auth',
      desc: 'Password + 6-digit OTP via Resend. Server-side session, JWT-signed cookies. Your scan history is yours.',
    },
    {
      icon: Zap,
      title: 'Instant. Browser-Native.',
      desc: 'No upload roundtrip to a third party. JSZip parses everything client-side; sanitize runs server-side.',
    },
    {
      icon: Database,
      title: 'Audit Trail',
      desc: 'Every scan you run is timestamped and tied to your account. Admins see who scanned what, when.',
    },
  ]
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ delay: i * 0.05 }}
          className="glass rounded-xl p-6 hover:border-emerald-400/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-400/0 group-hover:bg-emerald-400/10 rounded-full blur-2xl transition-all" />
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <f.icon className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ============================================================================
// Logic / Math section
// ============================================================================
function LogicSection() {
  const rules = [
    {
      formula: 'Author ∈ { "No name", "pythondocs", ∅ }',
      result: '→ AI Suspected',
      icon: User,
    },
    {
      formula: 'Time_edit < 30 min',
      result: '→ AI Suspected',
      icon: Clock,
    },
    {
      formula: 'App ≠ "Microsoft Office Word"',
      result: '→ AI Suspected',
      icon: Cpu,
    },
    {
      formula: '∑ flags × severity = AI Score',
      result: '→ 0–100 verdict',
      icon: Sparkles,
    },
  ]
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {rules.map((r, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className="glass rounded-xl p-5 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="relative">
            <r.icon className="w-5 h-5 text-emerald-400 mb-3" />
            <div className="font-mono text-[11px] text-zinc-300 mb-2 leading-relaxed">
              {r.formula}
            </div>
            <div className="font-mono text-xs text-emerald-400">{r.result}</div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ============================================================================
// Main Page
// ============================================================================
export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    fetch('/api/forensics/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user)
      })
      .finally(() => setBooted(true))
  }, [])

  const logout = async () => {
    await fetch('/api/forensics/auth/logout', { method: 'POST' })
    setUser(null)
    toast.success('Signed out')
  }

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-emerald-400 animate-pulse">INITIALIZING...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <ParticleBackground />
      <CursorGlow />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <div className="font-bold tracking-tight text-lg">
                TECHNO<span className="text-emerald-400">BIRDS</span>
              </div>
              <div className="font-mono text-[9px] text-zinc-500 tracking-widest">
                DARK FORENSICS
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-2 sm:gap-4">
            <a
              href="#scanner"
              className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block"
            >
              Scanner
            </a>
            <a
              href="#features"
              className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block"
            >
              Features
            </a>
            <a
              href="/forensics/admin"
              className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block"
            >
              Admin
            </a>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-zinc-300">{user.email}</span>
                </div>
                <Button
                  onClick={logout}
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 h-8"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setAuthOpen(true)}
                size="sm"
                className="bg-emerald-400 text-black hover:bg-emerald-300 font-semibold h-8"
              >
                <Lock className="w-3.5 h-3.5 mr-1" />
                Sign in
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span className="font-mono text-[10px] tracking-widest text-emerald-400">
                PURE BLACK · PURE LOGIC · PURE FRONTEND
              </span>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              <span className="text-gradient-cool">Document</span>
              <br />
              <span className="text-gradient-primary text-glow-primary">Forensics.</span>
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed mb-8 max-w-xl">
              Upload any <code className="text-emerald-400 font-mono">.docx</code>. We strip
              every hidden metadata field, run AI-generation heuristics, and let you forge a
              clean identity — with proper OOXML relationships so Word actually reads it.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#scanner">
                <Button className="bg-emerald-400 text-black hover:bg-emerald-300 font-semibold h-12 px-6">
                  <ScanLine className="w-4 h-4 mr-2" />
                  Initiate Scan
                </Button>
              </a>
              <a href="#features">
                <Button
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 h-12 px-6"
                >
                  See how it works
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </a>
            </div>

            <div className="flex items-center gap-6 mt-10 text-xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                100% browser-side parsing
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Email + MFA auth
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Word-compatible fix
              </div>
            </div>
          </motion.div>

          {/* Terminal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="glass-strong rounded-2xl overflow-hidden glow-primary">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/40">
                <div className="w-3 h-3 rounded-full bg-red-400/70" />
                <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
                <div className="ml-2 font-mono text-[10px] text-zinc-500 tracking-widest">
                  technobirds://scan --deep
                </div>
              </div>
              <div className="p-5 min-h-[280px] max-h-[280px] overflow-y-auto">
                <TerminalTicker />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-400/10 rounded-full blur-2xl animate-pulse" />
          </motion.div>
        </div>
      </section>

      {/* Scanner */}
      <section id="scanner" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-widest text-emerald-400/70 mb-2">
            01 // SCANNER
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-gradient-cool">
            Upload. Analyze. Sanitize.
          </h2>
          <p className="text-zinc-400">
            {user
              ? `Signed in as ${user.email}. Your scans are saved to history.`
              : 'Sign in to save your scan history. Otherwise everything runs anonymously.'}
          </p>
        </div>
        <Scanner user={user} />
      </section>

      {/* Logic */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-widest text-emerald-400/70 mb-2">
            02 // DETECTION MATHEMATICS
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-gradient-cool">
            Heuristic ruleset.
          </h2>
          <p className="text-zinc-400 max-w-2xl">
            We don&apos;t pretend to detect AI with magic. We apply four transparent rules and
            combine their signals into a 0–100 score.
          </p>
        </div>
        <LogicSection />
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-widest text-emerald-400/70 mb-2">
            03 // CAPABILITIES
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-gradient-cool">
            Built for rigorous integrity.
          </h2>
        </div>
        <FeaturesGrid />
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="glass-strong rounded-3xl p-12 sm:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
          <div className="relative">
            <Shield className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-gradient-cool">
              Ready to scan?
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto mb-6">
              Create an account to keep a full audit trail of every document you scan, or just
              drop a file and stay anonymous.
            </p>
            <a href="#scanner">
              <Button className="bg-emerald-400 text-black hover:bg-emerald-300 font-semibold h-12 px-8">
                <ScanLine className="w-4 h-4 mr-2" />
                Initiate Scan
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="font-mono text-[10px] text-zinc-500 tracking-widest text-center sm:text-left">
            © 2026 TECHNOBIRDS · BUILT FOR RIGOROUS DOCUMENT INTEGRITY
            <span className="hidden sm:inline mx-2 text-zinc-700">·</span>
            <span className="block sm:inline mt-1 sm:mt-0">
              CRAFTED BY{' '}
              <span className="text-emerald-400 font-semibold tracking-wide">SOHAIB AFZAL</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <a href="#scanner" className="hover:text-white transition-colors">Scanner</a>
            <a href="/forensics/admin" className="hover:text-white transition-colors">Admin</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
          </div>
        </div>
      </footer>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={(u) => setUser(u)}
      />
    </div>
  )
}
