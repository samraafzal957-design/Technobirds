import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'

const SESSION_COOKIE = 'tb_session'
const SESSION_TTL_DAYS = 7

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    // In development fall back to a deterministic dev secret so the app
    // doesn't crash. In production the user MUST set JWT_SECRET.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production')
    }
    return new TextEncoder().encode('dev-only-secret-please-set-JWT_SECRET')
  }
  return new TextEncoder().encode(secret)
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function createSession(userId: string): Promise<string> {
  // Persist a session row and return a signed JWT that references it.
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.session.create({
    data: { userId, token, expiresAt },
  })

  const jwt = await new SignJWT({ sub: userId, sid: token })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getJwtSecret())

  return jwt
}

export async function verifySession(jwt: string): Promise<{ userId: string; sid: string } | null> {
  try {
    const { payload } = await jwtVerify(jwt, getJwtSecret())
    const userId = payload.sub as string | undefined
    const sid = payload.sid as string | undefined
    if (!userId || !sid) return null

    // Confirm the session is still valid in the DB
    const session = await db.session.findUnique({ where: { token: sid } })
    if (!session || session.expiresAt < new Date() || session.userId !== userId) {
      return null
    }
    return { userId, sid }
  } catch {
    return null
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(SESSION_COOKIE)?.value
  if (!jwt) return null

  const session = await verifySession(jwt)
  if (!session) return null

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, createdAt: true },
  })
  return user
}

export async function setSessionCookie(jwt: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  const jwt = cookieStore.get(SESSION_COOKIE)?.value
  if (jwt) {
    const session = await verifySession(jwt)
    if (session) {
      await db.session.deleteMany({ where: { token: session.sid } }).catch(() => {})
    }
  }
  await clearSessionCookie()
}

export function generateOtpCode(): string {
  // 6-digit code
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
}
