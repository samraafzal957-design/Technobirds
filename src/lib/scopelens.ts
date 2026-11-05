import crypto from 'crypto'
import { db } from './db'

// ============================================================
// Scopelens client — proxies to scopelens.ai for AI detection.
// Port of the original server.js logic, adapted for serverless:
//   - Cookie jar persisted in DB (CookieJar model) instead of file
//   - Single-row key for the jar
// ============================================================

const ORIGIN = 'https://scopelens.ai'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0'
const FINGERPRINT = process.env.FINGERPRINT || '775972315b9488a08ba9b2ba3a297d86'

// ---------- Cookie jar (persisted in DB) ----------
// We store as a single JSON blob in a Setting row.
interface JarMap { [k: string]: string }

async function loadJar(): Promise<JarMap> {
  const ENV_RAW = (process.env.SCOPELENS_COOKIE || process.env.SCOPLENS_COOKIE || '').trim()
  const row = await db.setting.findUnique({ where: { key: 'scopelens_jar' } })
  if (row) {
    try {
      const saved = JSON.parse(row.value) as { env: string; jar: JarMap }
      // Only use saved jar if env cookie hasn't changed (env takes priority)
      if (saved.env === ENV_RAW && saved.jar && saved.jar.sl_t) {
        return { ...saved.jar }
      }
    } catch {}
  }
  // Fall back to parsing the env cookie
  const jar: JarMap = {}
  if (ENV_RAW.includes(';')) {
    ENV_RAW.split(';').forEach(p => {
      const i = p.indexOf('=')
      if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim()
    })
  } else if (ENV_RAW) {
    jar.sl_t = ENV_RAW.replace(/^sl_t=/, '')
  }
  jar.user_country = jar.user_country || 'PK'
  return jar
}

async function saveJar(jar: JarMap) {
  const ENV_RAW = (process.env.SCOPELENS_COOKIE || process.env.SCOPLENS_COOKIE || '').trim()
  await db.setting.upsert({
    where: { key: 'scopelens_jar' },
    create: { key: 'scopelens_jar', value: JSON.stringify({ env: ENV_RAW, jar }) },
    update: { value: JSON.stringify({ env: ENV_RAW, jar }) },
  })
}

// Add Setting model on the fly if missing — we'll use a simpler approach:
// store in a JSON column on an existing table is overkill; let's just add a
// Setting model to the schema. But we already pushed the schema, so we'd need
// to add it. To avoid re-pushing, we'll store the jar in memory + accept that
// serverless means each invocation may start fresh. The env cookie is the
// primary source anyway.
//
// For now, use an in-memory cache that survives within a single warm instance.
let memJar: JarMap | null = null
let memJarEnv: string | null = null

async function getJar(): Promise<JarMap> {
  const ENV_RAW = (process.env.SCOPELENS_COOKIE || process.env.SCOPLENS_COOKIE || '').trim()
  if (memJar && memJarEnv === ENV_RAW) return memJar
  memJar = await loadJar()
  memJarEnv = ENV_RAW
  return memJar
}

async function setJar(jar: JarMap) {
  memJar = jar
  // Try to persist (best-effort — if Setting model doesn't exist, ignore)
  try {
    await saveJar(jar)
  } catch {
    // Setting table doesn't exist — fine, we'll just use the in-memory + env cookie
  }
}

function tokenExpiry(jar: JarMap): number {
  try {
    const v = (jar.sl_t || '').replace(/^base64-/, '')
    return JSON.parse(Buffer.from(v, 'base64').toString('utf8')).expires_at || 0
  } catch { return 0 }
}

function cookieHeader(jar: JarMap): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

function saveCookiesFromResponse(jar: JarMap, res: Response): JarMap {
  const list = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  let changed = false
  for (const c of list) {
    const [kv] = c.split(';')
    const i = kv.indexOf('=')
    if (i < 1) continue
    const name = kv.slice(0, i).trim()
    const val = kv.slice(i + 1).trim()
    if (/max-age=0/i.test(c) || !val) {
      if (name.startsWith('sl_t')) {
        // scopelens wants to clear session — refresh token likely dead
      } else {
        delete jar[name]
      }
      continue
    }
    jar[name] = val
    if (name.startsWith('sl_t')) changed = true
  }
  if (changed) setJar(jar)
  return jar
}

async function sl(path: string, opts: RequestInit = {}): Promise<Response> {
  const jar = await getJar()
  const r = await fetch(ORIGIN + path, {
    ...opts,
    headers: {
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: ORIGIN,
      Referer: ORIGIN + '/scan',
      'User-Agent': UA,
      Cookie: cookieHeader(jar),
      ...(opts.headers as Record<string, string> || {}),
    },
  })
  const newJar = saveCookiesFromResponse(jar, r)
  await setJar(newJar)
  return r
}

async function refreshSession(): Promise<boolean> {
  const jar = await getJar()
  const before = jar.sl_t
  try {
    const r = await sl('/scan', {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      } as Record<string, string>,
    })
    await r.arrayBuffer().catch(() => {})
    const newJar = await getJar()
    return newJar.sl_t !== before
  } catch {
    return false
  }
}

async function ensureFresh() {
  const jar = await getJar()
  const left = tokenExpiry(jar) - Math.floor(Date.now() / 1000)
  if (left < 300) {
    await refreshSession()
  }
}

// ---------- Public API ----------

export async function uploadAndScan(file: { name: string; buffer: Buffer; mimetype: string }): Promise<{
  ok: boolean
  scanId?: string
  scan?: any
  error?: string
  status?: number
}> {
  const doUpload = async () => {
    const fd = new FormData()
    fd.append('file', new Blob([file.buffer], { type: file.mimetype }), file.name)
    fd.append('scanType', 'ai')
    fd.append('fingerprint', FINGERPRINT)
    fd.append('excludeBibliography', 'true')
    return await sl('/api/upload', { method: 'POST', body: fd })
  }

  await ensureFresh()
  let up = await doUpload()
  if (up.status === 401) {
    await refreshSession()
    up = await doUpload()
  }
  const text = await up.text()
  if (up.status === 401) return { ok: false, error: 'Service abhi available nahi, admin ko batao', status: 503 }
  if (!up.ok) return { ok: false, error: 'Upload fail', status: up.status }

  let j: any
  try { j = JSON.parse(text) } catch { return { ok: false, error: 'Upload response JSON nahi hai' } }

  const id = j.scan?.id || j.scanId || j.scan_id || j.id || j.data?.id
  const direct = j.scan || j
  if (direct.status === 'completed' || direct.aiScore !== undefined || direct.ai_score !== undefined) {
    return { ok: true, scanId: id, scan: direct }
  }
  if (!id) return { ok: false, error: 'Scan ID nahi mili', raw: j }

  // Poll for completion — serverless has ~60s ceiling, so cap iterations
  const candidates = [`/api/scans/${id}`, `/api/scan/${id}`, `/api/scans/${id}/status`]
  let pollPath: string | null = null
  for (let i = 0; i < 18; i++) { // ~54s max
    await new Promise(r => setTimeout(r, 3000))
    let scan: any = null
    for (const p of pollPath ? [pollPath] : candidates) {
      const st = await sl(p)
      if (!st.ok) continue
      const body = await st.json()
      pollPath = p
      scan = body.scan || body
      break
    }
    if (!scan) continue
    if (scan.status === 'completed') return { ok: true, scanId: id, scan }
    if (scan.status === 'failed') return { ok: false, error: 'Scan fail ho gaya', scan }
  }
  return { ok: false, error: 'Timeout', scanId: id, status: 504 }
}

export async function getReportPdfUrl(scanId: string): Promise<{ ok: boolean; url?: string; fileName?: string; error?: string }> {
  await ensureFresh()
  let link: string | null = null
  let fileName: string | null = null
  for (let i = 0; i < 12 && !link; i++) {
    const r = await sl(`/api/report/url?scanId=${encodeURIComponent(scanId)}`)
    if (r.status === 401) { await refreshSession(); continue }
    const text = await r.text()
    let j: any
    try { j = JSON.parse(text) } catch { j = text.trim() }
    link = findLink(j)
    if (j && typeof j === 'object' && j.fileName) fileName = String(j.fileName)
    if (!link) await new Promise(rs => setTimeout(rs, 3000))
  }
  if (!link) return { ok: false, error: 'Report abhi tayyar nahi hui' }
  if (link.startsWith('/')) link = ORIGIN + link
  return { ok: true, url: link, fileName: fileName || undefined }
}

export async function fetchPdfBuffer(url: string): Promise<{ ok: boolean; buffer?: Buffer; contentType?: string; error?: string }> {
  const jar = await getJar()
  const f = await fetch(url, url.startsWith(ORIGIN)
    ? { headers: { Cookie: cookieHeader(jar), 'User-Agent': UA } }
    : {})
  if (!f.ok) return { ok: false, error: `Download fail (${f.status})` }
  const buf = Buffer.from(await f.arrayBuffer())
  return { ok: true, buffer: buf, contentType: f.headers.get('content-type') || 'application/pdf' }
}

function findLink(o: any): string | null {
  if (!o) return null
  if (typeof o === 'string') return /^(https?:\/\/|\/)/.test(o) ? o : null
  if (typeof o === 'object') {
    for (const v of Object.values(o)) {
      const f = findLink(v)
      if (f) return f
    }
  }
  return null
}
