# Technobirds — Document Intelligence Suite

Three forensic tools in one Next.js 16 app, each with its own visual identity and 3D animations.

## Tools

| Route | Tool | Status | Description |
|---|---|---|---|
| `/` | Landing page | ✅ Live | Hero with 3D animations, 3 tool cards |
| `/aicheck` | AI Check | ⚠️ Temporarily unavailable | Plagiarism & AI content detection (needs scopelens cookie) |
| `/aicheck/admin` | AI Check admin | ✅ Live | User management, invite codes, scan audit |
| `/forensics` | Document Forensics | ✅ Live | .docx metadata extraction + sanitizer with OOXML fix |
| `/forensics/admin` | Forensics admin | ✅ Live | Scan audit panel |
| `/humanizer` | Humanizer | ✅ Live | Rewrite AI text to sound human (rules + Gemini LLM) |
| `/s/[token]` | Public share | ✅ Live | Password-optional scan result share page |

## Quick start

```bash
bun install           # or npm install
cp .env.example .env  # then edit .env with your values
bun run db:push       # creates DB tables
bun run dev           # http://localhost:3000
```

## AI Check — temporarily unavailable

AI Check proxies to scopelens.ai. To enable it:
1. Sign up at https://scopelens.ai
2. Open browser DevTools → Application → Cookies → `https://scopelens.ai`
3. Copy the `sl_t` cookie value
4. Set `SCOPELENS_COOKIE=sl_t=YOUR_VALUE` in `.env`

Until then, the AI Check page shows "temporarily unavailable" and refuses scans. Login still works.

## Deploy to Vercel (free)

Read `SETUP_RESEND.md` for the full guide. TL;DR:

1. Free Neon database (no credit card) — https://neon.tech
2. Free Resend API key — https://resend.com (for Forensics email MFA)
3. Free Gemini API key — https://aistudio.google.com/apikey (for Humanizer LLM)
4. (Optional) Get scopelens.ai cookie to enable AI Check
5. Set 11 env vars on Vercel (see `.env.example`)
6. Switch Prisma to `postgresql` in `prisma/schema.prisma`
7. `bun run db:push` to create tables in Postgres
8. Deploy

## Tech stack

- Next.js 16 (App Router, Turbopack)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York)
- Prisma ORM (SQLite dev, Postgres prod)
- Three.js + @react-three/fiber (3D landing animations)
- Framer Motion (page transitions)
- Resend (Forensics email MFA)
- jose + bcryptjs (Forensics JWT sessions)
- pdfkit (AI Check PDF report generation)
- JSZip (Forensics .docx parsing)
- Google Gemini 3.8 Flash (Humanizer LLM — free forever tier)

## Crafted by

**Sohaib Afzal**
