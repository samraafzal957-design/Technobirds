# Technobirds — Setup Guide

Three tools in one Next.js 16 app:

| Route | Tool | Status |
|---|---|---|
| `/` | Landing page | Live |
| `/aicheck` | AI Check (formerly DocCheck/Turnitin) — plagiarism & AI detection | Live |
| `/aicheck/admin` | AI Check admin panel (audit + invite codes + share links) | Live |
| `/forensics` | Document Forensics — .docx metadata extractor + sanitizer | Live |
| `/forensics/admin` | Forensics admin panel | Live |
| `/s/[token]` | Public share page for AI Check scan results | Live |
| `/humanizer` | Humanizer — rewrites AI text to sound human (rules + LLM) | Live |

## What you need (all FREE)

| Service | Why | Cost |
|---|---|---|
| **Vercel** | Hosts the Next.js app + API routes | Free tier (no credit card) |
| **Neon** or **Supabase** | Free Postgres DB (Vercel's own Postgres now requires a card) | Free, no card |
| **Resend** | Sends OTP emails for the Forensics tool | Free 100/day |
| **A scopelens.ai account** | Needed for AI Check to actually scan documents | Free signup |

---

## 1. Get a Postgres database (Neon, recommended — no credit card)

1. Go to **https://neon.tech** → sign up (free, GitHub/Google login).
2. **New Project** → name it `technobirds` → pick a region near you.
3. Neon shows you a connection string like:
   `postgresql://user:pass@ep-xxx.region.aws.neon.dev/technobirds?sslmode=require`
4. Copy it. That's your `DATABASE_URL`.

**Alternative:** Supabase (https://supabase.com) — also free, also Postgres.

## 2. Get a Resend API key (for Forensics email MFA)

1. Go to **https://resend.com** → sign up (free).
2. **API Keys** → **Create API Key** → "Sending access" → copy the key (`re_...`).
3. (Optional) Verify your own domain to send from `you@yourdomain.com` instead of `onboarding@resend.dev`.

## 3. Get your scopelens.ai cookie (for AI Check)

AI Check proxies to scopelens.ai. To get the cookie:

1. Sign up / log in at **https://scopelens.ai**
2. Open your browser DevTools → Application → Cookies → `https://scopelens.ai`
3. Copy the full `sl_t=...` cookie value (the long string after `sl_t=`).
4. Paste it as the `SCOPELENS_COOKIE` env var.

If scopelens switches to requiring a fresh login, just repeat — the app auto-refreshes the session.

## 4. Set environment variables

Create a `.env` locally (already created) and add these on Vercel:

```env
# Database (Neon or Supabase Postgres URL)
DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.dev/technobirds?sslmode=require

# Forensics auth (email MFA)
JWT_SECRET=replace-with-a-long-random-string   # openssl rand -hex 32
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_ADDRESS=Technobirds <onboarding@resend.dev>
ADMIN_TOKEN=pick-a-long-random-string           # for /forensics/admin

# AI Check auth
AICHECK_ADMIN_PASSWORD=pick-a-strong-password   # Sohaib's admin login
AICHECK_SESSION_SECRET=replace-with-another-long-random-string
AICHECK_DAILY_LIMIT=5                            # scans per user per day

# AI Check backend (scopelens proxy)
SCOPELENS_COOKIE=sl_t=paste-the-long-cookie-value-here
FINGERPRINT=775972315b9488a08ba9b2ba3a297d86
```

## 5. Switch Prisma to Postgres before deploying

Edit `prisma/schema.prisma` — change the datasource:

```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Then push the schema:

```bash
bun install
bun run db:push      # creates all tables in Postgres
```

## 6. Deploy to Vercel

1. Push your code to GitHub.
2. Vercel → **New Project** → import the repo.
3. **Settings → Environment Variables** → add each var above.
4. **Deploy**.
5. After first deploy, the AI Check admin (Sohaib) is auto-seeded in the DB.

## 7. Run locally

```bash
bun install
cp .env.example .env   # then edit with your values
bun run db:push
bun run dev            # http://localhost:3000
```

Without `RESEND_API_KEY`, the Forensics OTP shows in a dev toast so you can complete the flow.

Without `SCOPELENS_COOKIE`, AI Check will fail scans with "Service abhi available nahi" — that's expected.

## 8. Test the full flow

### Forensics (`/forensics`)
1. Click **Sign in** → register with email + password.
2. Get the OTP (real email, or dev toast if no Resend key).
3. Drop a `.docx` → see metadata + AI verdict.
4. Edit fields → download sanitized doc → open in Word → metadata is set.

### AI Check (`/aicheck`)
1. Login as **Sohaib** with `AICHECK_ADMIN_PASSWORD`.
2. Drop a PDF/DOCX → see AI score.
3. Download the PDF report.
4. Visit `/aicheck/admin` → add a user → get invite code.
5. Logout, log back in as the new user (using the invite code).
6. In admin, click "Share" on a completed scan → share link copied → open in incognito.

## 9. AI Check data model (separate from Forensics)

| Model | Purpose |
|---|---|
| `AICheckUser` | Users with name + scrypt password hash + invite codes (Sohaib auto-seeded as admin) |
| `AICheckScan` | Every scan attempt — running/done/failed — with score, words, fileName |
| `AICheckShare` | Public share tokens with optional password hash |
| `Setting` | Generic key-value (used to persist scopelens cookie jar) |

The Forensics tool uses its own `User`, `AuthCode`, `Session`, `Scan` models — completely separate auth, as you asked.

---

## Environment variable reference

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string (Neon/Supabase) |
| `JWT_SECRET` | ✅ | Signs Forensics session JWTs |
| `RESEND_API_KEY` | For email | Forensics OTP emails |
| `RESEND_FROM_ADDRESS` | Optional | From: address (default: `onboarding@resend.dev`) |
| `ADMIN_TOKEN` | ✅ for `/forensics/admin` | Password to view Forensics admin panel |
| `AICHECK_ADMIN_PASSWORD` | ✅ for AI Check admin | Sohaib's admin login password |
| `AICHECK_SESSION_SECRET` | ✅ | Signs AI Check session cookies |
| `AICHECK_DAILY_LIMIT` | Optional | Per-user daily scan limit (default: 5) |
| `SCOPELENS_COOKIE` | ✅ for AI Check to work | The `sl_t=...` cookie from scopelens.ai |
| `FINGERPRINT` | Optional | Scopelens browser fingerprint (default works) |
| `GEMINI_API_KEY` | Optional | Humanizer LLM mode. Free key from https://aistudio.google.com/apikey (free forever tier: 1,500 req/day). Without it, falls back to rule-only cleanup. |

That's it. Five env vars to deploy the whole suite.
