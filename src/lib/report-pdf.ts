// report-pdf.js — Generates a professional scan report PDF for sending to company.
// Uses pdfkit. All content is English (file names, dates, scores).
// Layout: A4 portrait, dark header band, summary stats, per-user breakdown, full table.
// Footer page numbers are stamped at the END via bufferedPageRange() and switchToPage().

import PDFDocument from 'pdfkit';

const PAGE_W = 595.28; // A4 width in points (1pt = 1/72 inch)
const PAGE_H = 841.89; // A4 height
const M = { top: 40, bottom: 40, left: 30, right: 30 };
const CONTENT_W = PAGE_W - M.left - M.right; // ~535

// Column definitions for the scan table
const COLS = [
  { key: 'no',     label: '#',          w: 30,  align: 'left'  },
  { key: 'date',   label: 'When (PKT)',  w: 100, align: 'left'  },
  { key: 'user',   label: 'User',        w: 70,  align: 'left'  },
  { key: 'file',   label: 'File',        w: 170, align: 'left'  },
  { key: 'score',  label: 'AI %',        w: 45,  align: 'right' },
  { key: 'words',  label: 'Words',       w: 50,  align: 'right' },
  { key: 'status', label: 'Status',      w: 70,  align: 'left'  },
];

function colX(i) {
  let x = M.left;
  for (let k = 0; k < i; k++) x += COLS[k].w;
  return x;
}

function truncate(text, maxChars) {
  let t = String(text == null ? '' : text);
  if (t.length > maxChars) t = t.slice(0, Math.max(1, maxChars - 1)) + '…';
  return t;
}

function maxCharsFor(w) { return Math.floor((w - 8) / 5); }

/**
 * Generate the scan report PDF buffer.
 * @param {Object} opts
 * @param {Array}  opts.scans       Array of scan records (newest first)
 * @param {Array}  opts.users       Array of user summary objects: { name, admin, today, total, last }
 * @param {string} opts.generatedAt ISO timestamp
 * @param {string} [opts.filterUser] Optional user name filter
 * @returns {Promise<Buffer>}
 */
export function generateReportPdf({ scans, users, generatedAt, filterUser }) {
  return new Promise((resolve, reject) => {
    // bufferPages: true lets us go back and stamp footers at the end.
    const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margins: M, bufferPages: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let y = M.top;

    // ========================== HEADER ==========================
    // Dark band
    doc.rect(0, 0, PAGE_W, 80).fill('#0a0908');
    // Wordmark
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#e9e0cb')
      .text('Technobirds ', M.left, 22, { continued: true });
    doc.font('Helvetica-Oblique').fillColor('#c1563a').text('Assignments');
    // Subtitle
    doc.font('Helvetica').fontSize(10).fillColor('#a89f8c')
      .text('DocCheck AI — Scan Report', M.left, 50);

    // Right-aligned generated date
    const genDate = new Date(generatedAt).toLocaleString('en-GB', {
      timeZone: 'Asia/Karachi', dateStyle: 'long', timeStyle: 'short',
    });
    doc.font('Helvetica').fontSize(9).fillColor('#6e675a')
      .text(`Generated: ${genDate} (PKT)`, M.left, 64, { width: CONTENT_W, align: 'right' });

    y = 100;

    if (filterUser) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#c1563a')
        .text(`User filter: ${filterUser}`, M.left, y);
      y += 22;
    }

    // ========================== SUMMARY ==========================
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#0a0908')
      .text('Summary', M.left, y);
    y += 22;

    const scanCount = scans.length;
    const completed = scans.filter(s => s.status === 'done').length;
    const failed = scans.filter(s => s.status === 'failed').length;
    const running = scans.filter(s => s.status === 'running').length;

    // Stats row with boxes
    const statBoxes = [
      { label: 'Total scans', value: scanCount, color: '#0a0908' },
      { label: 'Completed',   value: completed, color: '#3a7d44' },
      { label: 'Failed',      value: failed, color: '#c1563a' },
    ];
    if (running > 0) statBoxes.push({ label: 'In progress', value: running, color: '#a89f8c' });

    const boxW = 110, boxH = 38, gap = 12;
    let bx = M.left;
    statBoxes.forEach(b => {
      doc.roundedRect(bx, y, boxW, boxH, 6).lineWidth(1).strokeColor('#d4cab2').fillColor('#fbf7e8').fillAndStroke();
      doc.font('Helvetica').fontSize(8).fillColor('#6e675a')
        .text(b.label.toUpperCase(), bx + 10, y + 8, { width: boxW - 20 });
      doc.font('Helvetica-Bold').fontSize(18).fillColor(b.color)
        .text(String(b.value), bx + 10, y + 18, { width: boxW - 20 });
      bx += boxW + gap;
    });
    y += boxH + 18;

    // ========================== PER-USER BREAKDOWN ==========================
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0a0908')
      .text('Scans per user', M.left, y);
    y += 18;

    const perUser = (users || []).map(u => ({
      name: u.name,
      admin: u.admin,
      count: scans.filter(s => s.user === u.name).length,
      completed: scans.filter(s => s.user === u.name && s.status === 'done').length,
    }));

    doc.font('Helvetica').fontSize(9).fillColor('#333');
    const colW = 200;
    let cx = M.left;
    perUser.forEach((p, i) => {
      if (i > 0 && i % 2 === 0) {
        cx = M.left;
        y += 14;
      } else if (i > 0) {
        cx = M.left + colW + 20;
      }
      const tag = p.admin ? ' (admin)' : ` — ${p.completed} done`;
      doc.text(`• ${p.name}: ${p.count}${tag}`, cx, y, { width: colW });
    });
    y += 26;

    // Horizontal divider
    doc.moveTo(M.left, y).lineTo(PAGE_W - M.right, y).strokeColor('#d4cab2').lineWidth(1).stroke();
    y += 14;

    // ========================== TABLE HEADER ==========================
    drawTableHeader(doc, y);
    y += 22;

    // ========================== TABLE ROWS ==========================
    if (scans.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(11).fillColor('#888')
        .text('No scans to display.', M.left, y + 10);
    } else {
      scans.forEach((s, i) => {
        if (y > PAGE_H - 70) {
          doc.addPage();
          y = M.top;
          drawTableHeader(doc, y);
          y += 22;
        }
        drawRow(doc, s, i + 1, y);
        // Subtle separator line
        doc.moveTo(M.left, y + 13).lineTo(PAGE_W - M.right, y + 13)
          .strokeColor('#eeece2').lineWidth(0.5).stroke();
        y += 15;
      });
    }

    // ========================== FOOTER STAMPING ==========================
    // All pages are now buffered (thanks to bufferPages: true). Stamp the
    // "Page X of Y" footer on each one BEFORE calling doc.end(), so the
    // added text gets emitted to the data stream.
    const range = doc.bufferedPageRange();
    const totalPages = range.start + range.count;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Temporarily remove bottom margin so text() writes into it
      // (otherwise pdfkit tries to auto-addPage when text crosses margin).
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#999')
        .text(`Page ${i + 1} of ${totalPages} · Technobirds Assignments · DocCheck AI`,
          M.left, PAGE_H - 25, { width: CONTENT_W, align: 'center', lineBreak: false });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}

function drawTableHeader(doc, y) {
  // Dark background bar
  doc.rect(M.left, y - 4, CONTENT_W, 18).fill('#0a0908');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#e9e0cb');
  COLS.forEach((c, i) => {
    const x = colX(i);
    const opts = { width: c.w - 6, align: c.align };
    if (c.align === 'right') {
      doc.text(c.label, x, y, opts);
    } else {
      doc.text(c.label, x + 4, y, opts);
    }
  });
}

function drawRow(doc, s, no, y) {
  const when = new Date(s.t).toLocaleString('en-GB', {
    timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short',
  });

  const cells = [
    { col: 0, text: String(no) },
    { col: 1, text: when },
    { col: 2, text: s.user || '' },
    { col: 3, text: s.file || '' },
    { col: 4, text: s.score != null ? s.score + '%' : '—' },
    { col: 5, text: s.words != null ? String(s.words) : '—' },
    { col: 6, text: s.status || '' },
  ];

  doc.font('Helvetica').fontSize(9).fillColor('#222');
  cells.forEach(({ col, text }) => {
    const c = COLS[col];
    const x = colX(col);
    const t = truncate(text, maxCharsFor(c.w));
    const opts = { width: c.w - 6, align: c.align };
    if (c.align === 'right') {
      doc.text(t, x, y, opts);
    } else {
      doc.text(t, x + 4, y, opts);
    }
  });
}

