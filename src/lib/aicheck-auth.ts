import crypto from 'crypto'
import { cookies } from 'next/headers'
import { db } from './db'

// ============================================================
// AI Check auth — signed session cookies, scrypt password hashing,
// invite codes for first-time setup. Mirrors the original auth.js
// behavior but uses Prisma+Postgres instead of file JSON.
// ============================================================

const COOKIE_NAME = 'aicheck_session'
const SESSION_TTL_MS = 30 * 86400000 // 30 days

const ADMIN_NAME = 'Sohaib'

function getSecret(): string {
  // Persistent secret from env, falls back to a dev secret.
  return process.env.AICHECK_SESSION_SECRET || process.env.JWT_SECRET || 'dev-aicheck-secret-change-me'
}

const sha = (s: string) => crypto.createHash('sha256').update(String(s)).update('aicheck-v1').digest('hex')
const sign = (p: string) => crypto.createHmac('sha256', getSecret()).update(p).digest('base64url')
const eq = (a: string, b: string) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
const hashPw = (pw: string, salt: string) => crypto.scryptSync(pw, salt, 64).toString('hex')

function verOf(u: { isAdmin: boolean; version: number }): string {
  // For admin, version is derived from ADMIN_PASSWORD so changing it invalidates sessions.
  if (u.isAdmin) {
    const ap = process.env.AICHECK_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
    return sha('admin:' + ap).slice(0, 10)
  }
  return String(u.version)
}

function makeToken(name: string, u: { isAdmin: boolean; version: number }): string {
  const p = Buffer.from(JSON.stringify({ n: name, v: verOf(u), e: Date.now() + SESSION_TTL_MS })).toString('base64url')
  return p + '.' + sign(p)
}

function readToken(t: string): string | null {
  try {
    const [p, s] = String(t).split('.')
    if (!p || !s || !eq(sign(p), s)) return null
    const d = JSON.parse(Buffer.from(p, 'base64url').toString()) as { n: string; v: string; e: number }
    if (d.e < Date.now()) return null
    return d.n
  } catch { return null }
}

// ---------- seed admin on first call ----------
let seeded = false
async function seedAdminIfNeeded() {
  if (seeded) return
  seeded = true
  const exists = await db.aICheckUser.findUnique({ where: { name: ADMIN_NAME } })
  if (!exists) {
    await db.aICheckUser.create({
      data: { name: ADMIN_NAME, isAdmin: true, version: 1 },
    })
  }
}

// ---------- middleware-style helpers ----------
export async function getCurrentAICheckUser(): Promise<{ name: string; isAdmin: boolean } | null> {
  await seedAdminIfNeeded()
  const cookieStore = await cookies()
  const t = cookieStore.get(COOKIE_NAME)?.value
  if (!t) return null
  const name = readToken(t)
  if (!name) return null
  const u = await db.aICheckUser.findUnique({ where: { name } })
  if (!u) return null
  // Verify version still matches (catches password changes / revocations)
  if (verOf(u) !== readTokenVersion(t)) return null
  if (u.isAdmin && !(process.env.AICHECK_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)) return null
  return { name: u.name, isAdmin: u.isAdmin }
}

function readTokenVersion(t: string): string | null {
  try {
    const [p] = String(t).split('.')
    const d = JSON.parse(Buffer.from(p, 'base64url').toString()) as { v: string }
    return d.v
  } catch { return null }
}

async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86400,
    secure: process.env.NODE_ENV === 'production',
  })
}

async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// ---------- public ops ----------
export async function listUsers() {
  await seedAdminIfNeeded()
  const users = await db.aICheckUser.findMany({ orderBy: { name: 'asc' } })
  const adminPwSet = !!(process.env.AICHECK_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD)
  return users.map(u => ({
    name: u.name,
    isAdmin: u.isAdmin,
    state: u.isAdmin
      ? (adminPwSet ? 'ready' : 'disabled')
      : (u.hash ? 'ready' : (u.inviteHash && u.inviteExpiry && u.inviteExpiry > new Date() ? 'invited' : 'needs_setup')),
  }))
}

export async function login(name: string, password: string): Promise<{ ok: boolean; error?: string; needsSetup?: boolean }> {
  await seedAdminIfNeeded()
  const u = await db.aICheckUser.findUnique({ where: { name } })
  if (!u) return { ok: false, error: 'Name aur password do' }
  if (u.isAdmin) {
    const ap = process.env.AICHECK_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
    if (!ap) return { ok: false, error: 'Admin password set nahi hai' }
    if (!eq(sha(password), sha(ap))) return { ok: false, error: 'Galat password' }
  } else {
    if (!u.hash || !u.salt) return { ok: false, error: 'Pehle setup code se password set karo', needsSetup: true }
    if (!eq(hashPw(password, u.salt), u.hash)) return { ok: false, error: 'Galat password' }
  }
  await setSessionCookie(makeToken(u.name, u))
  return { ok: true }
}

export async function setup(name: string, code: string, password: string): Promise<{ ok: boolean; error?: string }> {
  await seedAdminIfNeeded()
  const u = await db.aICheckUser.findUnique({ where: { name } })
  if (!u || u.isAdmin) return { ok: false, error: 'Invalid user' }
  if (password.length < 6 || password.length > 100) return { ok: false, error: 'Password kam az kam 6 characters ka rakho' }
  if (!u.inviteHash || !u.inviteExpiry || u.inviteExpiry < new Date()) {
    return { ok: false, error: 'Setup code galat ya expire ho gaya' }
  }
  if (!eq(sha(code.trim().toUpperCase()), u.inviteHash)) {
    return { ok: false, error: 'Setup code galat ya expire ho gaya' }
  }
  const salt = crypto.randomBytes(16).toString('hex')
  await db.aICheckUser.update({
    where: { id: u.id },
    data: {
      salt, hash: hashPw(password, salt),
      version: u.version + 1,
      inviteHash: null, inviteExpiry: null,
    },
  })
  await setSessionCookie(makeToken(u.name, { isAdmin: false, version: u.version + 1 }))
  return { ok: true }
}

export async function logout() {
  await clearSessionCookie()
}

// ---------- admin ops ----------
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function genCode(len = 8): string {
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return s
}

export async function adminInviteUser(name: string): Promise<{ ok: boolean; error?: string; code?: string; hours?: number }> {
  const u = await db.aICheckUser.findUnique({ where: { name } })
  if (!u || u.isAdmin) return { ok: false, error: 'Invalid user' }
  const code = genCode()
  await db.aICheckUser.update({
    where: { id: u.id },
    data: {
      inviteHash: sha(code),
      inviteExpiry: new Date(Date.now() + 2 * 86400000),
      version: u.version + 1,
    },
  })
  return { ok: true, code, hours: 48 }
}

export async function adminCreateUser(name: string): Promise<{ ok: boolean; error?: string; code?: string; hours?: number }> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Naam do' }
  if (trimmed.length > 40) return { ok: false, error: 'Naam itna lamba nahi ho sakta' }
  if (!/^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(trimmed)) return { ok: false, error: 'Naam sirf letters, digits, space, _ ya - se shuru hona chahiye' }
  const existing = await db.aICheckUser.findUnique({ where: { name: trimmed } })
  if (existing) return { ok: false, error: 'Yeh naam pehle se mojood hai' }
  const code = genCode()
  await db.aICheckUser.create({
    data: {
      name: trimmed,
      inviteHash: sha(code),
      inviteExpiry: new Date(Date.now() + 2 * 86400000),
    },
  })
  return { ok: true, code, hours: 48 }
}

export async function adminListAll(): Promise<{
  limit: number
  users: Array<{ name: string; admin: boolean; state: string; today: number; total: number; last: string | null }>
  scans: Array<any>
}> {
  await seedAdminIfNeeded()
  const limit = parseInt(process.env.AICHECK_DAILY_LIMIT || process.env.DAILY_LIMIT_PER_USER || '5', 10)
  const users = await db.aICheckUser.findMany({ include: { scans: true } })
  const todayStr = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10)
  const result = users.map(u => {
    const nonFailed = u.scans.filter(s => s.status !== 'failed')
    const todayScans = nonFailed.filter(s => new Date(s.createdAt.getTime() + 5 * 3600000).toISOString().slice(0, 10) === todayStr).length
    return {
      name: u.name,
      admin: u.isAdmin,
      state: u.isAdmin ? 'admin' : (u.hash ? 'active' : (u.inviteHash && u.inviteExpiry && u.inviteExpiry > new Date() ? 'invited' : 'needs_setup')),
      today: todayScans,
      total: nonFailed.length,
      last: nonFailed.length ? nonFailed[nonFailed.length - 1].createdAt.toISOString() : null,
    }
  })
  const allScans = await db.aICheckScan.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 500 })
  return { limit, users: result, scans: allScans }
}

// ---------- scan log helpers ----------
export async function startScan(name: string, ip: string | null, fileName: string) {
  const u = await db.aICheckUser.findUnique({ where: { name } })
  if (!u) throw new Error('User not found')
  const internalId = crypto.randomBytes(8).toString('hex')
  const scan = await db.aICheckScan.create({
    data: {
      internalId,
      userId: u.id,
      ip,
      fileName: String(fileName).slice(0, 200),
      status: 'running',
    },
  })
  return scan
}

export async function finishScan(internalId: string, scopelensScanId: string, score: number | null, words: number | null) {
  await db.aICheckScan.update({
    where: { internalId },
    data: { status: 'done', scanId: scopelensScanId, score, words },
  })
}

export async function failScan(internalId: string, error: number | null) {
  await db.aICheckScan.update({
    where: { internalId },
    data: { status: 'failed', error },
  })
}

export async function checkLimit(name: string): Promise<{ ok: boolean; limit: number; used: number }> {
  const u = await db.aICheckUser.findUnique({ where: { name }, include: { scans: true } })
  if (!u) return { ok: false, limit: 0, used: 0 }
  if (u.isAdmin) return { ok: true, limit: 0, used: 0 }
  const limit = parseInt(process.env.AICHECK_DAILY_LIMIT || process.env.DAILY_LIMIT_PER_USER || '5', 10)
  const todayStr = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10)
  const used = u.scans
    .filter(s => s.status !== 'failed')
    .filter(s => new Date(s.createdAt.getTime() + 5 * 3600000).toISOString().slice(0, 10) === todayStr)
    .length
  return { ok: used < limit, limit, used }
}

export async function canDownload(name: string, scanId: string): Promise<boolean> {
  const u = await db.aICheckUser.findUnique({ where: { name }, include: { scans: true } })
  if (!u) return false
  if (u.isAdmin) return true
  return u.scans.some(s => s.scanId === scanId)
}

export async function findScan(id: string) {
  // Look up by internalId OR scanId
  return await db.aICheckScan.findFirst({
    where: {
      OR: [
        { internalId: id },
        { scanId: id },
      ],
    },
    include: { user: true },
  })
}

// ---------- share helpers ----------
export async function createShare(scanId: string, password: string | null, createdBy: string): Promise<string> {
  const token = crypto.randomBytes(16).toString('hex')
  await db.aICheckShare.create({
    data: {
      token,
      scanId,
      passwordHash: password ? sha(password) : null,
      createdBy,
    },
  })
  return token
}

export async function revokeShares(scanId: string): Promise<number> {
  const r = await db.aICheckShare.deleteMany({ where: { scanId } })
  return r.count
}

export async function getShareByToken(token: string) {
  return await db.aICheckShare.findUnique({
    where: { token },
    include: { scan: { include: { user: true } } },
  })
}

export async function deleteScans(ids: string[]): Promise<number> {
  const r = await db.aICheckScan.deleteMany({
    where: { scanId: { in: ids } },
  })
  return r.count
}

export async function deleteFailedScans(): Promise<number> {
  const r = await db.aICheckScan.deleteMany({ where: { status: 'failed' } })
  return r.count
}

export async function updateScan(id: string, updates: { status?: string; score?: number | null; words?: number | null }): Promise<void> {
  const scan = await findScan(id)
  if (!scan) throw new Error('Scan not found')
  await db.aICheckScan.update({
    where: { id: scan.id },
    data: {
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.score !== undefined ? { score: updates.score } : {}),
      ...(updates.words !== undefined ? { words: updates.words } : {}),
    },
  })
}

export async function getAllScansForReport() {
  return await db.aICheckScan.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } })
}

export async function getUsersSummaryForReport() {
  await seedAdminIfNeeded()
  const users = await db.aICheckUser.findMany({ include: { scans: true } })
  const todayStr = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10)
  return users.map(u => {
    const nonFailed = u.scans.filter(s => s.status !== 'failed')
    return {
      name: u.name,
      admin: u.isAdmin,
      today: nonFailed.filter(s => new Date(s.createdAt.getTime() + 5 * 3600000).toISOString().slice(0, 10) === todayStr).length,
      total: nonFailed.length,
      last: nonFailed.length ? nonFailed[nonFailed.length - 1].createdAt.toISOString() : null,
    }
  })
}

export { ADMIN_NAME }
