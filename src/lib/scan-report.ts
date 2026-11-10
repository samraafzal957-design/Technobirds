// Local PDF report generator for AI Check scans.
// Uses pdfkit (already installed). Produces a Turnitin-style report:
//   - Cover page with file name, scan date, AI score
//   - Summary stats (words, flagged sentences, verdict breakdown)
//   - Flagged sentences list with color-coded verdicts
//
// No external service needed — generates entirely from scan data + flagged sentences.

import PDFDocument from 'pdfkit'

export interface ReportFlaggedSentence {
  id: number
  page: number
  text: string
  words: number
  verdict: 'ai' | 'para'
  score: number
}

export interface ReportInput {
  fileName: string
  scanId: string
  aiScore: number // 0-100
  wordCount: number
  flagged: ReportFlaggedSentence[]
  engine?: string
  scannedAt?: string
}

const PAGE_W = 595.28 // A4
const PAGE_H = 841.89
const M = 40

const COLORS = {
  bg: '#0a0908',
  card: '#1a1a1a',
  ink: '#e9e0cb',
  ivory: '#f5f1e8',
  dim: '#a89f8c',
  faint: '#6e675a',
  ember: '#c1563a',
  ok: '#8fbf8a',
  bad: '#e08a6f',
  ai: '#c1563a',
  para: '#b378ff',
}

export async function generateScanReport(input: ReportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const aiCount = input.flagged.filter(f => f.verdict === 'ai').length
    const paraCount = input.flagged.filter(f => f.verdict === 'para').length
    const aiWords = input.flagged.filter(f => f.verdict === 'ai').reduce((a, f) => a + f.words, 0)
    const paraWords = input.flagged.filter(f => f.verdict === 'para').reduce((a, f) => a + f.words, 0)
    const scannedAt = input.scannedAt || new Date().toISOString()
    const engine = input.engine || 'technobirds-intelligence'

    // ========== COVER PAGE ==========
    // Dark band background
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLORS.bg)

    // Top label
    doc.fillColor(COLORS.ember)
    doc.font('Helvetica-Bold').fontSize(9)
    doc.text('TECHNOBIRDS // AI WRITING DETECTION', M, 60, { characterSpacing: 2 })

    doc.fillColor(COLORS.dim)
    doc.font('Helvetica').fontSize(9)
    doc.text('Report ID: ' + input.scanId.slice(0, 16), M, 76)

    // Big title
    doc.fillColor(COLORS.ivory)
    doc.font('Helvetica-Bold').fontSize(34)
    doc.text('AI Writing', M, 180)
    doc.fillColor(COLORS.ember)
    doc.text('Detection Report', M, 220)

    // File name
    doc.fillColor(COLORS.dim)
    doc.font('Helvetica').fontSize(11)
    doc.text('Document:', M, 290)
    doc.fillColor(COLORS.ink)
    doc.font('Helvetica-Bold').fontSize(13)
    const safeName = input.fileName.replace(/[^\x20-\x7E]/g, '_').slice(0, 80)
    doc.text(safeName, M, 308, { width: PAGE_W - 2 * M })

    // Date
    doc.fillColor(COLORS.dim)
    doc.font('Helvetica').fontSize(11)
    doc.text('Scanned:', M, 340)
    doc.fillColor(COLORS.ink)
    doc.font('Helvetica-Bold').fontSize(11)
    doc.text(new Date(scannedAt).toLocaleString(), M, 358)

    // Engine
    doc.fillColor(COLORS.dim)
    doc.font('Helvetica').fontSize(11)
    doc.text('Engine:', M, 388)
    doc.fillColor(COLORS.ember)
    doc.font('Helvetica-Bold').fontSize(11)
    doc.text(engine === 'technobirds-intelligence' ? 'Technobirds Intelligence (~80% accurate)' : engine, M, 406)

    // ===== AI SCORE BIG NUMBER =====
    const scoreColor = input.aiScore >= 60 ? COLORS.bad : input.aiScore >= 30 ? COLORS.ember : COLORS.ok
    doc.fillColor(COLORS.dim)
    doc.font('Helvetica').fontSize(10)
    doc.text('AI WRITING SCORE', M, 480, { characterSpacing: 2 })

    doc.fillColor(scoreColor)
    doc.font('Helvetica-Bold').fontSize(96)
    doc.text(input.aiScore + '%', M, 500)

    doc.fillColor(COLORS.dim)
    doc.font('Helvetica-Oblique').fontSize(11)
    doc.text(input.aiScore >= 60 ? 'High probability of AI-generated content' : input.aiScore >= 30 ? 'Some AI-generated content detected' : 'Low AI signal', M, 620)

    // Footer
    doc.fillColor(COLORS.faint)
    doc.font('Helvetica').fontSize(8)
    doc.text('Technobirds Technology · AI Writing Detection · Crafted by Sohaib Afzal', M, PAGE_H - 60, { align: 'center', width: PAGE_W - 2 * M })
    doc.text('sohaibafzalkid@gmail.com', M, PAGE_H - 48, { align: 'center', width: PAGE_W - 2 * M })

    // ========== PAGE 2: SUMMARY ==========
    doc.addPage()
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLORS.bg)

    doc.fillColor(COLORS.ember)
    doc.font('Helvetica-Bold').fontSize(9)
    doc.text('SUMMARY', M, 50, { characterSpacing: 2 })

    doc.fillColor(COLORS.ivory)
    doc.font('Helvetica-Bold').fontSize(22)
    doc.text('Detection summary', M, 70)

    // Stats grid (2x2)
    const stats = [
      { label: 'AI Score', value: input.aiScore + '%', color: scoreColor },
      { label: 'Words analyzed', value: String(input.wordCount), color: COLORS.ink },
      { label: 'AI-generated sentences', value: String(aiCount), color: COLORS.ai },
      { label: 'AI-paraphrased sentences', value: String(paraCount), color: COLORS.para },
    ]
    let sy = 130
    for (let i = 0; i < stats.length; i += 2) {
      const sx = M
      const sx2 = PAGE_W / 2 + 10
      for (let j = 0; j < 2 && i + j < stats.length; j++) {
        const s = stats[i + j]
        const x = j === 0 ? sx : sx2
        // Card background
        doc.roundedRect(x, sy, PAGE_W / 2 - M - 10, 70, 8).fill(COLORS.card)
        doc.fillColor(COLORS.faint)
        doc.font('Helvetica').fontSize(9)
        doc.text(s.label.toUpperCase(), x + 14, sy + 14, { characterSpacing: 1.5 })
        doc.fillColor(s.color)
        doc.font('Helvetica-Bold').fontSize(24)
        doc.text(s.value, x + 14, sy + 32)
      }
      sy += 90
    }

    // Words breakdown
    doc.fillColor(COLORS.dim)
    doc.font('Helvetica').fontSize(10)
    doc.text('WORDS BREAKDOWN', M, sy + 10, { characterSpacing: 2 })

    const totalFlaggedWords = aiWords + paraWords
    const humanWords = Math.max(0, input.wordCount - totalFlaggedWords)
    const breakdown = [
      { label: 'AI-generated words', value: aiWords, color: COLORS.ai },
      { label: 'AI-paraphrased words', value: paraWords, color: COLORS.para },
      { label: 'Likely human words', value: humanWords, color: COLORS.ok },
    ]
    let by = sy + 35
    for (const b of breakdown) {
      doc.fillColor(b.color)
      doc.font('Helvetica-Bold').fontSize(11)
      doc.rect(M, by, 6, 14).fill(b.color)
      doc.fillColor(COLORS.ink)
      doc.text(b.label, M + 14, by)
      doc.fillColor(COLORS.dim)
      doc.font('Helvetica').fontSize(11)
      doc.text(String(b.value) + ' words', PAGE_W - M - 80, by, { width: 80, align: 'right' })
      by += 22
    }

    // Footer
    doc.fillColor(COLORS.faint)
    doc.font('Helvetica').fontSize(8)
    doc.text('Page 2', M, PAGE_H - 30, { align: 'center', width: PAGE_W - 2 * M })

    // ========== PAGE 3+: FLAGGED SENTENCES ==========
    if (input.flagged.length > 0) {
      doc.addPage()
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLORS.bg)

      doc.fillColor(COLORS.ember)
      doc.font('Helvetica-Bold').fontSize(9)
      doc.text('FLAGGED SENTENCES', M, 50, { characterSpacing: 2 })

      doc.fillColor(COLORS.ivory)
      doc.font('Helvetica-Bold').fontSize(22)
      doc.text('AI-flagged passages', M, 70)

      doc.fillColor(COLORS.dim)
      doc.font('Helvetica-Oblique').fontSize(10)
      doc.text('Each sentence below was flagged as likely AI-generated or AI-paraphrased.', M, 100, { width: PAGE_W - 2 * M })

      let fy = 130
      const maxY = PAGE_H - M - 20
      for (let i = 0; i < input.flagged.length; i++) {
        const f = input.flagged[i]
        const color = f.verdict === 'ai' ? COLORS.ai : COLORS.para
        const verdictLabel = f.verdict === 'ai' ? 'AI-GENERATED' : 'AI-PARAPHRASED'

        // Check if we need a new page
        const textHeight = doc.heightOfString(f.text, { width: PAGE_W - 2 * M - 28, fontSize: 10 })
        const blockHeight = 60 + textHeight
        if (fy + blockHeight > maxY) {
          doc.addPage()
          doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLORS.bg)
          fy = 50
        }

        // Card background
        doc.roundedRect(M, fy, PAGE_W - 2 * M, blockHeight, 8).fill(COLORS.card)
        // Left color stripe
        doc.rect(M, fy, 4, blockHeight).fill(color)

        // Verdict badge
        doc.fillColor(color)
        doc.font('Helvetica-Bold').fontSize(8)
        doc.text(verdictLabel, M + 16, fy + 12, { characterSpacing: 1.5 })

        // Score
        doc.fillColor(COLORS.dim)
        doc.font('Helvetica').fontSize(8)
        doc.text('Score: ' + f.score + ' · ' + f.words + ' words · Page ' + f.page, PAGE_W - M - 200, fy + 12, { width: 184, align: 'right' })

        // Sentence text
        doc.fillColor(COLORS.ink)
        doc.font('Helvetica').fontSize(10)
        doc.text(f.text, M + 16, fy + 30, { width: PAGE_W - 2 * M - 28, lineGap: 2 })

        fy += blockHeight + 8
      }
    }

    // ========== DISCLAIMER PAGE ==========
    doc.addPage()
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLORS.bg)

    doc.fillColor(COLORS.ember)
    doc.font('Helvetica-Bold').fontSize(9)
    doc.text('DISCLAIMER', M, 200, { characterSpacing: 2 })

    doc.fillColor(COLORS.ivory)
    doc.font('Helvetica-Bold').fontSize(22)
    doc.text('About this report', M, 220)

    doc.fillColor(COLORS.dim)
    doc.font('Helvetica').fontSize(11)
    const disclaimer = [
      'This report was generated by Technobirds Intelligence, a hybrid rules + LLM detection engine with approximately 80% accuracy.',
      '',
      'AI writing detection is probabilistic. A high score does not guarantee the text was AI-generated, and a low score does not guarantee it was human-written. False positives and false negatives occur.',
      '',
      'Always use this report as one signal among many. Review the flagged passages yourself. Consider the context: who wrote it, when, and why.',
      '',
      'For institutional or legal decisions, consider using Turnitin or a similar enterprise-grade detector alongside this report.',
      '',
      'If this is for a university assignment, check your school\'s AI policy before acting on these results.',
    ]
    doc.text(disclaimer.join('\n'), M, 260, { width: PAGE_W - 2 * M, lineGap: 4 })

    doc.fillColor(COLORS.faint)
    doc.font('Helvetica').fontSize(9)
    doc.text('Technobirds Technology', M, PAGE_H - 80, { align: 'center', width: PAGE_W - 2 * M })
    doc.text('Crafted by Sohaib Afzal · sohaibafzalkid@gmail.com', M, PAGE_H - 65, { align: 'center', width: PAGE_W - 2 * M })

    // Stamped page numbers on every page (skip cover)
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      if (i === 0) continue // skip cover
      doc.switchToPage(i)
      doc.fillColor(COLORS.faint)
      doc.font('Helvetica').fontSize(8)
      doc.text('Page ' + (i + 1) + ' of ' + range.count, M, PAGE_H - 30, { align: 'center', width: PAGE_W - 2 * M })
    }

    doc.end()
  })
}
