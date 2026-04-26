import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType, TabStopType, TabStopLeader,
  Header, Footer, PageNumber, Table, TableRow, TableCell, WidthType,
  convertInchesToTwip, UnderlineType
} from 'docx';

/**
 * Build an ATS-safe DOCX from parsed resume data.
 * ATS-safe means: single column, standard headings, no tables for layout,
 * no text boxes, no images, no headers/footers with critical info.
 */
export async function buildDocx(data, docType = 'resume') {
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

  const children = [];

  // ── Name ──────────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [new TextRun({ text: name, bold: true, size: 36, font: 'Calibri' })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
    })
  );

  // ── Contact Line ──────────────────────────────────────
  if (contactLine) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contactLine, size: 20, color: '444444', font: 'Calibri' })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 80 },
        border: {
          bottom: { color: 'C49A1A', size: 6, style: BorderStyle.SINGLE },
        },
      })
    );
  }

  // ── Section helper ────────────────────────────────────
  const sectionHeading = (title) =>
    new Paragraph({
      children: [
        new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: '1a1a2e', font: 'Calibri', allCaps: true }),
      ],
      spacing: { before: 240, after: 60 },
      border: {
        bottom: { color: 'E8B84B', size: 4, style: BorderStyle.SINGLE },
      },
    });

  const bullet = (text) =>
    new Paragraph({
      children: [new TextRun({ text, size: 20, font: 'Calibri', color: '1a1a2e' })],
      bullet: { level: 0 },
      spacing: { after: 40 },
    });

  const bodyPara = (text, opts = {}) =>
    new Paragraph({
      children: [new TextRun({ text, size: 20, font: 'Calibri', color: '1a1a2e', ...opts })],
      spacing: { after: 60 },
    });

  // ── Professional Summary ──────────────────────────────
  if (summary) {
    children.push(sectionHeading('Professional Summary'));
    children.push(bodyPara(summary));
  }

  // ── Core Competencies ─────────────────────────────────
  if (coreCompetencies.length) {
    children.push(sectionHeading('Core Competencies'));
    // List them 3 per line, ATS-safe (no table)
    for (let i = 0; i < coreCompetencies.length; i += 3) {
      const row = coreCompetencies.slice(i, i + 3).join('   •   ');
      children.push(bodyPara(row));
    }
  }

  // ── Professional Experience ───────────────────────────
  if (experience.length) {
    children.push(sectionHeading('Professional Experience'));
    for (const exp of experience) {
      // Company + dates on same line using tabs
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.company || '', bold: true, size: 22, font: 'Calibri' }),
            new TextRun({ text: `\t${exp.dates || ''}`, size: 20, font: 'Calibri', color: '666666' }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: convertInchesToTwip(6.5) }],
          spacing: { before: 120, after: 20 },
        })
      );
      // Title + location
      if (exp.title || exp.location) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: exp.title || '', italics: true, size: 20, font: 'Calibri', color: '333333' }),
              exp.location ? new TextRun({ text: `  —  ${exp.location}`, size: 18, font: 'Calibri', color: '888888' }) : new TextRun(''),
            ],
            spacing: { after: 60 },
          })
        );
      }
      // Bullets
      for (const b of (exp.bullets || [])) {
        children.push(bullet(b));
      }
    }
  }

  // ── Education ─────────────────────────────────────────
  if (education.length) {
    children.push(sectionHeading('Education'));
    for (const ed of education) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${ed.degree || ''}${ed.field ? ` in ${ed.field}` : ''}`, bold: true, size: 20, font: 'Calibri' }),
          ],
          spacing: { after: 20 },
        })
      );
      children.push(bodyPara(
        [ed.institution, ed.year, ed.gpa ? `GPA: ${ed.gpa}` : '', ed.honors].filter(Boolean).join('  |  '),
        { color: '555555', size: 19 }
      ));
    }
  }

  // ── Certifications ────────────────────────────────────
  if (certifications.length) {
    children.push(sectionHeading('Certifications'));
    for (const cert of certifications) {
      children.push(bullet(cert));
    }
  }

  // ── Additional Skills ─────────────────────────────────
  if (additionalSkills.length) {
    children.push(sectionHeading('Additional Skills'));
    children.push(bodyPara(additionalSkills.join('  •  ')));
  }

  // ── Build Doc ─────────────────────────────────────────
  const doc = new Document({
    creator: 'ATS Resume Generator',
    title: `${name} — ${docType === 'cv' ? 'Curriculum Vitae' : 'Resume'}`,
    description: 'ATS-Optimized document generated by ATS Resume Generator',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.75),
            right: convertInchesToTwip(0.75),
            bottom: convertInchesToTwip(0.75),
            left: convertInchesToTwip(0.75),
          },
        },
      },
      children,
    }],
  });

  return await Packer.toBuffer(doc);
}
