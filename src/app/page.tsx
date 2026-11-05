'use client'

import { Suspense, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles, MeshDistortMaterial, Environment, Icosahedron, TorusKnot } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Shield, ScanLine, Sparkles as SparklesIcon, ArrowRight, Eye, Brain, ShieldCheck,
  Zap, Lock, Cpu, FileText, Activity, Mail, Clock, AlertCircle, ChevronRight,
} from 'lucide-react'

// ============================================================
// 3D Scene 1: AI Check — ink swirl / paper aesthetic
// Dark icosahedron with distortion, ember-orange lighting
// ============================================================
function InkScene() {
  const meshRef = useRef<any>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.2
    }
  })
  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.8}>
      <Icosahedron ref={meshRef} args={[1.2, 4]}>
        <MeshDistortMaterial
          color="#c1563a"
          emissive="#3a1010"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.7}
          distort={0.35}
          speed={1.5}
        />
      </Icosahedron>
      <Sparkles count={40} scale={3} size={2} speed={0.4} color="#e9e0cb" opacity={0.6} />
    </Float>
  )
}

// ============================================================
// 3D Scene 2: Forensics — neon cyan wireframe knot
// ============================================================
function ForensicsScene() {
  const meshRef = useRef<any>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.2
    }
  })
  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={0.5}>
      <TorusKnot ref={meshRef} args={[0.8, 0.25, 128, 16]}>
        <meshStandardMaterial
          color="#00ff9d"
          emissive="#003322"
          emissiveIntensity={0.5}
          wireframe
          roughness={0.2}
          metalness={0.9}
        />
      </TorusKnot>
      <Sparkles count={60} scale={2.5} size={1.5} speed={0.6} color="#00ff9d" opacity={0.8} />
    </Float>
  )
}

// ============================================================
// 3D Scene 3: Humanizer — ghostly sphere (coming soon)
// ============================================================
function HumanizerScene() {
  const meshRef = useRef<any>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04)
    }
  })
  return (
    <Float speed={1} rotationIntensity={0.2} floatIntensity={0.3}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.2, 64, 64]} />
        <MeshDistortMaterial
          color="#b378ff"
          emissive="#2a0a4a"
          emissiveIntensity={0.3}
          roughness={0.1}
          metalness={0.3}
          distort={0.2}
          speed={2}
          transparent
          opacity={0.7}
        />
      </mesh>
      <Sparkles count={30} scale={2.8} size={3} speed={0.3} color="#b378ff" opacity={0.5} />
    </Float>
  )
}

// ============================================================
// Tool Card
// ============================================================
interface Tool {
  id: string
  name: string
  tagline: string
  description: string
  icon: React.ElementType
  href: string
  scene: React.ReactNode
  accent: string
  glow: string
  status: 'live' | 'soon' | 'unavailable'
}

const TOOLS: Tool[] = [
  {
    id: 'aicheck',
    name: 'AI Check',
    tagline: 'Plagiarism & AI content detection',
    description: 'Upload any document. Get an instant AI-generation score backed by a real PDF report. Per-user daily limits, admin audit trail, shareable report links.',
    icon: ScanLine,
    href: '/aicheck',
    scene: <InkScene />,
    accent: 'text-orange-300',
    glow: 'rgba(193, 86, 58, 0.4)',
    status: 'unavailable',
  },
  {
    id: 'forensics',
    name: 'Document Forensics',
    tagline: 'Deep .docx metadata extraction & sanitization',
    description: 'Strip every hidden metadata field from a .docx, run AI-generation heuristics, and forge a clean identity — with proper OOXML relationships so Word actually reads them.',
    icon: Shield,
    href: '/forensics',
    scene: <ForensicsScene />,
    accent: 'text-emerald-300',
    glow: 'rgba(0, 255, 157, 0.4)',
    status: 'live',
  },
  {
    id: 'humanizer',
    name: 'Humanizer',
    tagline: 'Rewrite AI text to sound human',
    description: 'Paste any text. We strip the patterns Wikipedia flags as AI writing — empty vocabulary, fake analysis, vague attribution — and rewrite it to read like a real person.',
    icon: SparklesIcon,
    href: '/humanizer',
    scene: <HumanizerScene />,
    accent: 'text-purple-300',
    glow: 'rgba(179, 120, 255, 0.4)',
    status: 'unavailable',
  },
]

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const [hovered, setHovered] = useState(false)
  const isSoon = tool.status === 'soon'
  const isUnavailable = tool.status === 'unavailable'

  const CardInner = (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.15, duration: 0.6 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative group h-full rounded-3xl overflow-hidden glass-strong"
      style={{
        boxShadow: hovered ? `0 30px 80px -20px ${tool.glow}` : '0 20px 50px -20px rgba(0,0,0,0.5)',
        transition: 'box-shadow 0.4s ease',
      }}
    >
      {/* 3D Scene */}
      <div className="relative h-64 w-full" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 60%)' }}>
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }} dpr={[1, 2]}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.3} />
            <pointLight position={[5, 5, 5]} intensity={1} color={tool.glow.replace('rgba(', '').split(',')[0].slice(1)} />
            <pointLight position={[-5, -3, 2]} intensity={0.4} color="#ffffff" />
            {tool.scene}
            <Environment preset="night" />
          </Suspense>
        </Canvas>

        {/* Status badge */}
        <div className="absolute top-4 right-4">
          {isSoon ? (
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest bg-purple-500/10 border border-purple-400/40 text-purple-300 backdrop-blur-md">
              COMING SOON
            </span>
          ) : isUnavailable ? (
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest bg-amber-400/10 border border-amber-400/40 text-amber-300 backdrop-blur-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              UNAVAILABLE
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest bg-emerald-400/10 border border-emerald-400/40 text-emerald-300 backdrop-blur-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative p-7">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
            style={{
              background: `linear-gradient(135deg, ${tool.glow} 0%, transparent 100%)`,
              borderColor: tool.glow,
            }}
          >
            <tool.icon className={`w-5 h-5 ${tool.accent}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-xl font-bold ${tool.accent}`}>{tool.name}</h3>
            <p className="text-xs text-zinc-500 font-mono tracking-wider uppercase mt-0.5">{tool.tagline}</p>
          </div>
        </div>

        <p className="text-sm text-zinc-400 leading-relaxed mb-5 min-h-[3em]">
          {tool.description}
        </p>

        <div
          className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
            isSoon
              ? 'text-zinc-500 cursor-not-allowed'
              : isUnavailable
                ? 'text-amber-400/80 cursor-not-allowed'
                : tool.accent + ' group-hover:gap-2.5 transition-all'
          }`}
        >
          {isSoon
            ? 'In development'
            : isUnavailable
              ? 'Temporarily unavailable'
              : 'Launch tool'}
          {!isSoon && !isUnavailable && <ArrowRight className="w-4 h-4" />}
        </div>
      </div>

      {/* Bottom gradient line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${tool.glow}, transparent)` }}
      />
    </motion.div>
  )

  // Coming soon OR unavailable — no link, just show the card
  if (isSoon || isUnavailable) {
    return <div className="h-full cursor-default">{CardInner}</div>
  }
  // Live — link to the tool
  return (
    <Link href={tool.href} className="h-full block">
      {CardInner}
    </Link>
  )
}

// ============================================================
// Background canvas — drifting particles + grid
// ============================================================
function BackgroundCanvas() {
  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(193, 86, 58, 0.06) 0%, transparent 40%),' +
            'radial-gradient(circle at 80% 30%, rgba(0, 255, 157, 0.06) 0%, transparent 40%),' +
            'radial-gradient(circle at 50% 100%, rgba(179, 120, 255, 0.06) 0%, transparent 40%)',
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 80%)',
        }}
      />
    </>
  )
}

// ============================================================
// Cursor glow
// ============================================================
function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!ref.current) return
      ref.current.style.transform = `translate(${e.clientX - 300}px, ${e.clientY - 300}px)`
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])
  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none z-0 transition-transform duration-100 ease-out"
      style={{
        background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)',
        mixBlendMode: 'screen',
      }}
    />
  )
}

// ============================================================
// Hero floating 3D
// ============================================================
function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 50 }} dpr={[1, 2]}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.2} />
        <pointLight position={[5, 5, 5]} intensity={0.6} color="#c1563a" />
        <pointLight position={[-5, -3, 4]} intensity={0.5} color="#00ff9d" />
        <pointLight position={[0, 5, -5]} intensity={0.3} color="#b378ff" />

        <Float speed={1.2} rotationIntensity={0.5} floatIntensity={1} position={[-2.2, 0.8, 0]}>
          <Icosahedron args={[0.7, 4]}>
            <MeshDistortMaterial color="#c1563a" emissive="#3a1010" emissiveIntensity={0.5} roughness={0.3} metalness={0.7} distort={0.4} speed={1.5} />
          </Icosahedron>
        </Float>

        <Float speed={2} rotationIntensity={0.6} floatIntensity={0.7} position={[2.2, -0.5, 0]}>
          <TorusKnot args={[0.5, 0.18, 100, 16]}>
            <meshStandardMaterial color="#00ff9d" emissive="#003322" emissiveIntensity={0.5} wireframe roughness={0.2} metalness={0.9} />
          </TorusKnot>
        </Float>

        <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5} position={[0, 0.5, 0]}>
          <mesh>
            <sphereGeometry args={[0.6, 64, 64]} />
            <MeshDistortMaterial color="#b378ff" emissive="#2a0a4a" emissiveIntensity={0.3} roughness={0.1} metalness={0.3} distort={0.25} speed={2} transparent opacity={0.6} />
          </mesh>
        </Float>

        <Sparkles count={80} scale={8} size={2} speed={0.3} color="#ffffff" opacity={0.4} />
        <Environment preset="night" />
      </Suspense>
    </Canvas>
  )
}

// ============================================================
// Stats counter
// ============================================================
function StatCounter({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const animated = useRef(false)

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true
          const duration = 1500
          const start = performance.now()
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            setDisplay(Math.floor(eased * value))
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      })
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value])

  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl sm:text-5xl font-bold text-gradient-cool">
        {display.toLocaleString()}{suffix}
      </div>
      <div className="text-xs font-mono tracking-widest text-zinc-500 uppercase mt-2">{label}</div>
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <BackgroundCanvas />
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
                DOCUMENT INTELLIGENCE SUITE
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-4 sm:gap-6">
            <a href="#tools" className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors">Tools</a>
            <a href="#about" className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors">About</a>
            <a href="#stats" className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">Stats</a>
            <Link
              href="/humanizer"
              className="text-xs sm:text-sm text-purple-400 hover:text-purple-300 font-mono"
            >
              Humanizer ↗
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
              <SparklesIcon className="w-3 h-3 text-emerald-400" />
              <span className="font-mono text-[10px] tracking-widest text-emerald-400">
                THREE TOOLS · ONE SUITE · BUILT BY SOHAIB AFZAL
              </span>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              <span className="text-gradient-cool">Document</span>
              <br />
              <span className="text-gradient-primary text-glow-primary">Intelligence.</span>
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed mb-8 max-w-xl">
              Three forensic tools for the modern document workflow. Detect AI-written
              content, strip hidden metadata from your files, and soon — humanize AI text
              to read like it was written by you.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#tools">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-emerald-400 text-black hover:bg-emerald-300 font-semibold h-12 px-6 rounded-xl flex items-center gap-2"
                >
                  Choose a tool
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </a>
              <a href="#about">
                <button className="border border-white/10 bg-white/5 hover:bg-white/10 h-12 px-6 rounded-xl font-semibold text-sm">
                  Learn more
                </button>
              </a>
            </div>

            <div className="flex items-center gap-6 mt-10 text-xs text-zinc-500 flex-wrap">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Email + MFA auth
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                PDF report generation
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Share-link audit trail
              </div>
            </div>
          </motion.div>

          {/* 3D Hero */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative h-[400px] sm:h-[500px]"
          >
            <HeroScene />
          </motion.div>
        </div>
      </section>

      {/* Tools */}
      <section id="tools" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="mb-10">
          <div className="font-mono text-[10px] tracking-widest text-emerald-400/70 mb-2">
            01 // TOOLS
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 text-gradient-cool">
            Pick your weapon.
          </h2>
          <p className="text-zinc-400 max-w-2xl">
            Each tool runs independently with its own auth. Use one, use all three — your call.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((tool, i) => (
            <ToolCard key={tool.id} tool={tool} index={i} />
          ))}
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="glass-strong rounded-3xl p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-15" />
          <div className="relative">
            <div className="font-mono text-[10px] tracking-widest text-emerald-400/70 mb-2">
              02 // STATS
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-10 text-gradient-cool">
              Trusted for serious document work.
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <StatCounter value={3} label="Tools in suite" />
              <StatCounter value={3} label="Live now" />
              <StatCounter value={13} label="Patterns flagged" />
              <StatCounter value={100} label="Browser-side" suffix="%" />
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="font-mono text-[10px] tracking-widest text-emerald-400/70 mb-2">
              03 // ABOUT
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gradient-cool">
              Built for rigorous integrity.
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              <strong className="text-white">Technobirds</strong> is a small but focused suite of
              document-forensics tools — built by Sohaib Afzal to give students, writers, and
              professionals the same level of insight into a file that platforms like Turnitin
              have, but without the black-box pricing.
            </p>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Each tool is self-contained. AI Check uses an industry-grade detection engine under
              the hood. Forensics dissects the OOXML package of any .docx and rebuilds it with
              proper relationships so Word actually reads the metadata you set. Humanizer is on
              the way.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass rounded-xl p-4">
                <Cpu className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="text-sm font-semibold text-white">Built on Next.js 16</div>
                <div className="text-xs text-zinc-500 mt-0.5">TypeScript · Tailwind · Prisma</div>
              </div>
              <div className="glass rounded-xl p-4">
                <Lock className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="text-sm font-semibold text-white">Privacy-first</div>
                <div className="text-xs text-zinc-500 mt-0.5">Files processed in your browser</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-3"
          >
            {[
              { icon: ScanLine, title: 'AI Check', desc: 'Upload → AI score + PDF report in seconds. Per-user daily limits, admin audit panel, password-protected share links.', color: 'text-orange-300' },
              { icon: Shield, title: 'Forensics', desc: 'Drop a .docx → see every hidden metadata field, AI-generation heuristics, and a one-click sanitize-and-download with proper OOXML relationships.', color: 'text-emerald-300' },
              { icon: SparklesIcon, title: 'Humanizer', desc: 'Paste AI text, get back plain, specific, human-sounding prose. Strips the patterns Wikipedia flags as AI writing — vocab, fake analysis, vague attribution.', color: 'text-purple-300' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-xl p-5 flex items-start gap-3"
              >
                <f.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${f.color}`} />
                <div>
                  <div className="font-semibold text-white">{f.title}</div>
                  <div className="text-sm text-zinc-400 mt-0.5">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-white/5 backdrop-blur-md bg-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="font-mono text-[10px] text-zinc-500 tracking-widest">
              © 2026 TECHNOBIRDS · DOCUMENT INTELLIGENCE SUITE
            </div>
            <div className="font-mono text-[10px] text-zinc-500 tracking-widest mt-1">
              CRAFTED BY{' '}
              <span className="text-emerald-400 font-semibold tracking-wide">SOHAIB AFZAL</span>
            </div>
            <div className="font-mono text-[10px] text-zinc-500 tracking-widest mt-1">
              CONTACT:{' '}
              <a
                href="mailto:sohaibafzalkid@gmail.com"
                className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
              >
                sohaibafzalkid@gmail.com
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <a href="#tools" className="hover:text-white transition-colors">Tools</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <Link href="/forensics" className="hover:text-white transition-colors">Forensics ↗</Link>
            <Link href="/aicheck" className="hover:text-white transition-colors">AI Check ↗</Link>
            <Link href="/humanizer" className="hover:text-white transition-colors">Humanizer ↗</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
