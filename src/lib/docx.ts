import JSZip from 'jszip'

export interface DocxMetadata {
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
  // Derived
  editTimeMinutes: number
  wordCount: number
  paragraphCount: number
  fileSize: number
}

export interface ScanResult {
  metadata: DocxMetadata
  verdict: 'ai' | 'human' | 'unknown'
  aiScore: number // 0-100
  flags: { key: string; label: string; severity: 'low' | 'high'; reason: string }[]
}

const DEFAULT_CORE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title></dc:title><dc:creator></dc:creator><cp:lastModifiedBy></cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified><cp:revision>1</cp:revision></cp:coreProperties>`

const DEFAULT_APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Office Word</Application><Company></Company><TotalTime>0</TotalTime></Properties>`

function getTagText(xml: string, tagNames: string[]): string {
  for (const tag of tagNames) {
    // Match <tag>...</tag> or <ns:tag>...</ns:tag>, allowing attributes
    const re = new RegExp(`<[^>]*\\b${tag}\\b[^>]*>([^<]*)</[^>]*\\b${tag}\\b[^>]*>`, 'i')
    const m = xml.match(re)
    if (m && m[1] !== undefined) return m[1].trim()
  }
  return ''
}

function countWordsInDocumentXml(documentXml: string): { words: number; paragraphs: number } {
  // Count <w:t>…</w:t> text content for word count
  const textChunks = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
  const allText = textChunks.map((c) => c.replace(/<[^>]+>/g, '')).join(' ')
  const words = (allText.trim().match(/\S+/g) || []).length

  // Count <w:p> paragraph elements
  const paragraphs = (documentXml.match(/<w:p[\s>]/g) || []).length

  return { words, paragraphs }
}

export async function parseDocx(buf: ArrayBuffer): Promise<ScanResult> {
  const zip = await JSZip.loadAsync(buf)

  // Read core.xml
  let coreXml = (await zip.file('docProps/core.xml')?.async('string')) || ''
  if (!coreXml) {
    coreXml = DEFAULT_CORE_XML
  }

  // Read app.xml
  let appXml = (await zip.file('docProps/app.xml')?.async('string')) || ''
  if (!appXml) {
    appXml = DEFAULT_APP_XML
  }

  // Read document.xml for word/paragraph counts
  const documentXml = (await zip.file('word/document.xml')?.async('string')) || ''
  const { words, paragraphs } = countWordsInDocumentXml(documentXml)

  const creator = getTagText(coreXml, ['creator'])
  const lastModifiedBy = getTagText(coreXml, ['lastModifiedBy'])
  const title = getTagText(coreXml, ['title'])
  const subject = getTagText(coreXml, ['subject'])
  const keywords = getTagText(coreXml, ['keywords'])
  const description = getTagText(coreXml, ['description'])
  const category = getTagText(coreXml, ['category'])
  const contentStatus = getTagText(coreXml, ['contentStatus'])
  const revision = getTagText(coreXml, ['revision'])
  const created = getTagText(coreXml, ['created'])
  const modified = getTagText(coreXml, ['modified'])

  const application = getTagText(appXml, ['Application']) || 'Unknown'
  const company = getTagText(appXml, ['Company'])
  const totalTime = getTagText(appXml, ['TotalTime', 'totalTime']) || '0'
  const editTimeMinutes = parseInt(totalTime, 10) || 0

  const metadata: DocxMetadata = {
    creator,
    lastModifiedBy,
    title,
    subject,
    keywords,
    description,
    category,
    contentStatus,
    revision,
    created,
    modified,
    application,
    company,
    totalTime,
    editTimeMinutes,
    wordCount: words,
    paragraphCount: paragraphs,
    fileSize: buf.byteLength,
  }

  // Heuristic AI detection
  const flags: ScanResult['flags'] = []

  // 1. Author anomalies
  const authorLower = creator.toLowerCase()
  if (!creator) {
    flags.push({
      key: 'author',
      label: 'Missing Author',
      severity: 'high',
      reason: 'No author is set. Common in AI-generated or programmatically-created docs.',
    })
  } else if (['no name', 'pythondocs', 'unknown', 'admin', 'user'].includes(authorLower)) {
    flags.push({
      key: 'author',
      label: 'Default Author',
      severity: 'high',
      reason: `Author "${creator}" is a common default for AI/programmatic generation.`,
    })
  }

  // 2. Edit time
  if (editTimeMinutes < 30) {
    flags.push({
      key: 'editTime',
      label: 'Low Edit Time',
      severity: editTimeMinutes === 0 ? 'high' : 'low',
      reason: `Only ${editTimeMinutes} min of editing. Suggests copy-paste or AI generation.`,
    })
  }

  // 3. Application anomalies
  const appLower = application.toLowerCase()
  if (appLower.includes('python') || appLower.includes('libreoffice') && false) {
    flags.push({
      key: 'application',
      label: 'Non-Word Application',
      severity: 'high',
      reason: `Application "${application}" suggests programmatic generation, not human Word use.`,
    })
  } else if (appLower === 'unknown' || !appLower.includes('word')) {
    flags.push({
      key: 'application',
      label: 'Suspicious Application',
      severity: 'low',
      reason: `Application string "${application}" is unusual.`,
    })
  }

  // 4. Missing modification date
  if (!modified || modified.startsWith('2024-01-01')) {
    flags.push({
      key: 'modified',
      label: 'Missing Modified Date',
      severity: 'low',
      reason: 'No real modification timestamp set.',
    })
  }

  // Score: 100 = definitely AI, 0 = definitely human
  let aiScore = 0
  for (const f of flags) {
    aiScore += f.severity === 'high' ? 30 : 15
  }
  aiScore = Math.min(100, aiScore)

  const verdict: ScanResult['verdict'] = aiScore >= 60 ? 'ai' : aiScore >= 30 ? 'unknown' : 'human'

  return { metadata, verdict, aiScore, flags }
}

// ---------- Sanitization ----------

export interface SanitizeUpdates {
  creator?: string
  lastModifiedBy?: string
  title?: string
  subject?: string
  keywords?: string
  description?: string
  category?: string
  contentStatus?: string
  revision?: string
  created?: string
  modified?: string
  application?: string
  company?: string
  totalTime?: string
}

function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string') return ''
  return unsafe.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`)
}

function updateCoreXml(xml: string, u: SanitizeUpdates): string {
  const replace = (tag: string, value: string | undefined, attrs = ''): void => {
    if (value === undefined) return
    // Match either <tag>...</tag> (with optional ns prefix and attrs) or
    // self-closing <tag ... />. We do this in two passes because JS regex
    // has no clean alternation that captures both forms uniformly.
    const paired = new RegExp(`<[^>]*\\b${tag}\\b[^>]*>([^<]*)</[^>]*\\b${tag}\\b[^>]*>`, 'i')
    const selfClosed = new RegExp(`<[^>]*\\b${tag}\\b[^>]*\\/>`, 'i')
    const replacement = `<${tag}${attrs}>${escapeXml(value)}</${tag}>`
    if (paired.test(xml)) {
      xml = xml.replace(paired, replacement)
    } else if (selfClosed.test(xml)) {
      xml = xml.replace(selfClosed, replacement)
    } else {
      // Insert before </cp:coreProperties>
      xml = xml.replace(/<\/cp:coreProperties>/i, `${replacement}</cp:coreProperties>`)
    }
  }

  replace('dc:creator', u.creator)
  replace('cp:lastModifiedBy', u.lastModifiedBy)
  replace('dc:title', u.title)
  replace('dc:subject', u.subject)
  replace('cp:keywords', u.keywords)
  replace('dc:description', u.description)
  replace('cp:category', u.category)
  replace('cp:contentStatus', u.contentStatus)
  replace('cp:revision', u.revision)
  if (u.created !== undefined) {
    replace('dcterms:created', u.created, ' xsi:type="dcterms:W3CDTF"')
  }
  if (u.modified !== undefined) {
    replace('dcterms:modified', u.modified, ' xsi:type="dcterms:W3CDTF"')
  }
  return xml
}

function updateAppXml(xml: string, u: SanitizeUpdates): string {
  const replace = (tag: string, value: string | undefined): void => {
    if (value === undefined) return
    const paired = new RegExp(`<[^>]*\\b${tag}\\b[^>]*>([^<]*)</[^>]*\\b${tag}\\b[^>]*>`, 'i')
    const selfClosed = new RegExp(`<[^>]*\\b${tag}\\b[^>]*\\/>`, 'i')
    const replacement = `<${tag}>${escapeXml(value)}</${tag}>`
    if (paired.test(xml)) {
      xml = xml.replace(paired, replacement)
    } else if (selfClosed.test(xml)) {
      xml = xml.replace(selfClosed, replacement)
    } else {
      xml = xml.replace(/<\/Properties>/i, `${replacement}</Properties>`)
    }
  }

  replace('Application', u.application)
  replace('Company', u.company)
  replace('TotalTime', u.totalTime)
  return xml
}

/**
 * Ensure the OOXML package actually references docProps/core.xml and
 * docProps/app.xml. Without these relationships Word IGNORES the metadata
 * files entirely (the "bro not edited" bug — 0 min editing time, "Never"
 * modified, no author shown). Many python/AI-generated .docx files have
 * the metadata files but are missing the relationships that tell Word they
 * exist.
 */
async function ensureMetadataRelationships(zip: JSZip): Promise<void> {
  // ---------- _rels/.rels ----------
  let relsXml = (await zip.file('_rels/.rels')?.async('string')) || ''
  if (!relsXml) {
    relsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  }

  const idMatches = [...relsXml.matchAll(/Id="rId(\d+)"/g)]
  let maxId = 0
  idMatches.forEach((m) => {
    maxId = Math.max(maxId, parseInt(m[1], 10))
  })
  let nextId = maxId + 1
  let relsChanged = false

  if (!relsXml.includes('/metadata/core-properties')) {
    const newId = 'rId' + nextId++
    const newRel =
      `<Relationship Id="${newId}"` +
      ` Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"` +
      ` Target="docProps/core.xml"/>`
    relsXml = relsXml.replace('</Relationships>', newRel + '</Relationships>')
    relsChanged = true
  }

  if (!relsXml.includes('/extended-properties')) {
    const newId = 'rId' + nextId++
    const newRel =
      `<Relationship Id="${newId}"` +
      ` Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"` +
      ` Target="docProps/app.xml"/>`
    relsXml = relsXml.replace('</Relationships>', newRel + '</Relationships>')
    relsChanged = true
  }

  if (relsChanged) {
    zip.file('_rels/.rels', relsXml)
  }

  // ---------- [Content_Types].xml ----------
  let ctXml = (await zip.file('[Content_Types].xml')?.async('string')) || ''
  if (ctXml) {
    let ctChanged = false
    if (!ctXml.includes('PartName="/docProps/core.xml"')) {
      const override =
        '<Override ContentType="application/vnd.openxmlformats-package.core-properties+xml" PartName="/docProps/core.xml"/>'
      ctXml = ctXml.replace('</Types>', override + '</Types>')
      ctChanged = true
    }
    if (!ctXml.includes('PartName="/docProps/app.xml"')) {
      const override =
        '<Override ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" PartName="/docProps/app.xml"/>'
      ctXml = ctXml.replace('</Types>', override + '</Types>')
      ctChanged = true
    }
    if (ctChanged) {
      zip.file('[Content_Types].xml', ctXml)
    }
  }
}

export async function sanitizeDocx(
  buf: ArrayBuffer,
  updates: SanitizeUpdates
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buf)

  // Read existing or default
  let coreXml = (await zip.file('docProps/core.xml')?.async('string')) || DEFAULT_CORE_XML
  let appXml = (await zip.file('docProps/app.xml')?.async('string')) || DEFAULT_APP_XML

  coreXml = updateCoreXml(coreXml, updates)
  appXml = updateAppXml(appXml, updates)

  zip.file('docProps/core.xml', coreXml)
  zip.file('docProps/app.xml', appXml)

  // CRITICAL: wire up the metadata files so Word actually reads them
  await ensureMetadataRelationships(zip)

  const out = await zip.generateAsync({
    type: 'uint8array',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Use STORED (no compression) for parts already stored that way, to
    // keep the package looking like a real Word save.
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  return out
}
