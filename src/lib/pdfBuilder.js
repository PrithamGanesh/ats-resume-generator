import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const GOLD = rgb(0.91, 0.72, 0.29);
const DARK = rgb(0.10, 0.10, 0.18);
const GRAY = rgb(0.40, 0.40, 0.40);
const LIGHT = rgb(0.55, 0.55, 0.55);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const LINE_W = PAGE_W - MARGIN * 2;

/**
 * Build an ATS-safe PDF resume using pdf-lib.
 * Single column, standard fonts, no images, no complex layout.
 */
export async function buildPdf(data, docType = 'resume') {
  const {
    name = 'Your Name',
    contactLine = '',
    summary = '',
    coreCompetencies = [],
    experience = [],
    education = [],
    certifications = [],
    additionalSkills = [],
  } = data;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${name} — ${docType === 'cv' ? 'Curriculum Vitae' : 'Resume'}`);
  pdfDoc.setCreator('ATS Resume Generator');

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontObl = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // State
  let pages = [];
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pages.push(page);
  let y = PAGE_H - MARGIN;

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    y = PAGE_H - MARGIN;
  }

  function checkY(needed = 40) {
    if (y - needed < MARGIN + 20) newPage();
  }

  function drawText(text, x, fontSize, font, color = DARK, maxWidth = LINE_W) {
    if (!text) return;
    // Word-wrap
    const words = String(text).split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    for (const l of lines) {
      checkY(fontSize + 4);
      page.drawText(l, { x, y, size: fontSize, font, color });
      y -= fontSize + 4;
    }
    return lines.length;
  }

  function drawLine(color = GOLD, thickness = 0.8) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness,
      color,
    });
    y -= thickness + 2;
  }

  function sectionHeading(title) {
    checkY(30);
    y -= 10;
    page.drawText(title.toUpperCase(), { x: MARGIN, y, size: 9, font: fontBold, color: DARK, characterSpacing: 1.2 });
    y -= 5;
    drawLine(GOLD, 1);
    y -= 4;
  }

  // ── Name ──────────────────────────────────────────────
  drawText(name, MARGIN, 24, fontBold, DARK);
  y -= 2;

  // ── Contact ───────────────────────────────────────────
  if (contactLine) {
    drawText(contactLine, MARGIN, 9, fontReg, GRAY);
    y -= 2;
    drawLine(GOLD, 1.5);
    y -= 4;
  }

  // ── Summary ───────────────────────────────────────────
  if (summary) {
    sectionHeading('Professional Summary');
    drawText(summary, MARGIN, 10, fontReg, DARK);
    y -= 4;
  }

  // ── Core Competencies ─────────────────────────────────
  if (coreCompetencies.length) {
    sectionHeading('Core Competencies');
    for (let i = 0; i < coreCompetencies.length; i += 3) {
      const row = coreCompetencies.slice(i, i + 3).join('    •    ');
      checkY(14);
      page.drawText(row, { x: MARGIN, y, size: 9.5, font: fontReg, color: DARK });
      y -= 14;
    }
    y -= 4;
  }

  // ── Experience ────────────────────────────────────────
  if (experience.length) {
    sectionHeading('Professional Experience');
    for (const exp of experience) {
      checkY(50);
      y -= 6;

      // Company + dates
      const companyText = exp.company || '';
      const datesText = exp.dates || '';
      page.drawText(companyText, { x: MARGIN, y, size: 11, font: fontBold, color: DARK });
      if (datesText) {
        const datesW = fontReg.widthOfTextAtSize(datesText, 9);
        page.drawText(datesText, { x: PAGE_W - MARGIN - datesW, y, size: 9, font: fontReg, color: LIGHT });
      }
      y -= 14;

      // Title + location
      if (exp.title) {
        const locText = exp.location ? `  —  ${exp.location}` : '';
        page.drawText(exp.title, { x: MARGIN, y, size: 9.5, font: fontObl, color: GRAY });
        if (locText) {
          const titleW = fontObl.widthOfTextAtSize(exp.title, 9.5);
          page.drawText(locText, { x: MARGIN + titleW, y, size: 9, font: fontReg, color: LIGHT });
        }
        y -= 14;
      }

      // Bullets
      for (const b of (exp.bullets || [])) {
        checkY(14);
        page.drawText('•', { x: MARGIN + 4, y, size: 9.5, font: fontBold, color: GOLD });
        drawText(b, MARGIN + 14, 9.5, fontReg, DARK, LINE_W - 14);
        y -= 2;
      }
      y -= 4;
    }
  }

  // ── Education ─────────────────────────────────────────
  if (education.length) {
    sectionHeading('Education');
    for (const ed of education) {
      checkY(30);
      y -= 4;
      const degLine = `${ed.degree || ''}${ed.field ? ` in ${ed.field}` : ''}`;
      page.drawText(degLine, { x: MARGIN, y, size: 10.5, font: fontBold, color: DARK });
      y -= 14;
      const subLine = [ed.institution, ed.year, ed.gpa ? `GPA: ${ed.gpa}` : '', ed.honors].filter(Boolean).join('  |  ');
      drawText(subLine, MARGIN, 9, fontReg, GRAY);
      y -= 4;
    }
  }

  // ── Certifications ────────────────────────────────────
  if (certifications.length) {
    sectionHeading('Certifications');
    for (const cert of certifications) {
      checkY(14);
      page.drawText('•', { x: MARGIN + 4, y, size: 9.5, font: fontBold, color: GOLD });
      drawText(cert, MARGIN + 14, 9.5, fontReg, DARK, LINE_W - 14);
      y -= 2;
    }
  }

  // ── Additional Skills ─────────────────────────────────
  if (additionalSkills.length) {
    sectionHeading('Additional Skills');
    drawText(additionalSkills.join('  •  '), MARGIN, 9.5, fontReg, DARK);
  }

  // ── Page Numbers ──────────────────────────────────────
  if (pages.length > 1) {
    pages.forEach((pg, i) => {
      pg.drawText(`${name}  |  Page ${i + 1} of ${pages.length}`, {
        x: MARGIN,
        y: MARGIN - 16,
        size: 8,
        font: fontReg,
        color: LIGHT,
      });
    });
  }

  return await pdfDoc.save();
}
