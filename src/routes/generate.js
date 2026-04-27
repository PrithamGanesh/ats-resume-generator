import { Router } from 'express';
import { buildDocx } from '../lib/docxBuilder.js';
import { buildPdf } from '../lib/pdfBuilder.js';

const router = Router();

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have',
  'in', 'into', 'is', 'it', 'of', 'on', 'or', 'our', 'that', 'the', 'their',
  'this', 'to', 'with', 'you', 'your', 'will'
]);

const SECTION_ALIASES = new Map([
  ['summary', 'summary'],
  ['professional summary', 'summary'],
  ['profile', 'summary'],
  ['skills', 'skills'],
  ['technical skills', 'skills'],
  ['core competencies', 'skills'],
  ['experience', 'experience'],
  ['professional experience', 'experience'],
  ['work experience', 'experience'],
  ['employment history', 'experience'],
  ['projects', 'experience'],
  ['achievements', 'experience'],
  ['education', 'education'],
  ['certifications', 'certifications'],
  ['certification', 'certifications']
]);

router.post('/', async (req, res) => {
  const {
    jobRole = '',
    jobDescription = '',
    responsibilities = '',
    existingResume = '',
    candidateName = '',
    docType = 'resume',
    outputFormat = 'pdf',
  } = req.body;

  if (!jobRole.trim() || !jobDescription.trim()) {
    return res.status(400).json({ error: 'jobRole and jobDescription are required.' });
  }
  if (!existingResume.trim() || existingResume.trim().length < 30) {
    return res.status(400).json({ error: 'Please provide your existing resume content.' });
  }

  try {
    const parsed = buildRuleBasedResume({
      jobRole: jobRole.trim(),
      jobDescription: jobDescription.trim(),
      responsibilities: responsibilities.trim(),
      existingResume: existingResume.trim(),
      candidateName: candidateName.trim(),
      docType,
    });

    let fileBuffer;
    let mimeType;
    let filename;
    const safeName = (parsed.name || candidateName || 'resume')
      .replace(/[^a-z0-9_-]+/gi, '_')
      .replace(/^_+|_+$/g, '') || 'resume';

    if (outputFormat === 'docx') {
      fileBuffer = await buildDocx(parsed, docType);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `${safeName}_ATS_${docType === 'cv' ? 'CV' : 'Resume'}.docx`;
    } else {
      fileBuffer = await buildPdf(parsed, docType);
      mimeType = 'application/pdf';
      filename = `${safeName}_ATS_${docType === 'cv' ? 'CV' : 'Resume'}.pdf`;
    }

    res.json({
      resume: parsed,
      file: {
        data: Buffer.from(fileBuffer).toString('base64'),
        mimeType,
        filename,
      },
    });
  } catch (err) {
    console.error('Rule-based generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate document.' });
  }
});

function buildRuleBasedResume({
  jobRole,
  jobDescription,
  responsibilities,
  existingResume,
  candidateName,
  docType,
}) {
  const source = parseResume(existingResume);
  const keywords = extractKeywords([jobRole, jobDescription, responsibilities].join(' '), 18);
  const sourceKeywords = extractKeywords(existingResume, 18);
  const keywordsMatched = keywords
    .filter(keyword => existingResume.toLowerCase().includes(keyword.toLowerCase()))
    .slice(0, 10);
  const selectedKeywords = unique([...keywordsMatched, ...keywords]).slice(0, 12);

  const experienceLines = selectRelevantLines(
    [
      ...source.sections.experience,
      ...source.sections.summary,
      ...source.sections.other,
    ],
    keywords,
    docType === 'cv' ? 10 : 6,
  );

  const coreCompetencies = unique([
    ...splitSkillLines(source.sections.skills),
    ...selectedKeywords,
    ...sourceKeywords.slice(0, 5),
  ]).slice(0, 12);

  const totalKeywords = Math.max(keywords.length, 1);
  const coverage = keywordsMatched.length / totalKeywords;
  const atsScore = Math.min(96, Math.max(58, Math.round(58 + coverage * 34 + Math.min(coreCompetencies.length, 8))));

  return {
    atsScore,
    name: candidateName || source.name,
    contactLine: source.contactLine,
    summary: buildSummary(jobRole, selectedKeywords, source.years),
    coreCompetencies,
    experience: [
      {
        company: 'Relevant Experience',
        title: jobRole,
        location: '',
        dates: '',
        bullets: experienceLines.length
          ? experienceLines
          : ['Aligned existing resume content to the target role using job-description keywords and ATS-safe formatting.'],
      },
    ],
    education: buildEducation(source.sections.education),
    certifications: source.sections.certifications.slice(0, docType === 'cv' ? 10 : 5),
    additionalSkills: unique(sourceKeywords.filter(keyword => !coreCompetencies.includes(keyword))).slice(0, 12),
    keywordsMatched,
    improvements: [
      `Matched ${keywordsMatched.length} target keywords from the job description.`,
      'Reorganized content into standard ATS-readable sections.',
      'Generated a single-column PDF/DOCX structure without tables, images, or text boxes.',
    ],
  };
}

function parseResume(text) {
  const lines = text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const sections = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    other: [],
  };
  let current = 'other';

  for (const line of lines) {
    const heading = normalizeHeading(line);
    if (heading) {
      current = heading;
      continue;
    }
    sections[current].push(stripBullet(line));
  }

  const contactParts = [
    text.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0],
    text.match(/\+?\d[\d\s().-]{7,}\d/)?.[0],
    text.match(/linkedin\.com\/in\/[^\s|]+/i)?.[0],
    text.match(/https?:\/\/[^\s|]+/i)?.[0],
  ].filter(Boolean);

  return {
    name: detectName(lines),
    contactLine: contactParts.join('  |  '),
    sections,
    years: text.match(/\b(\d{1,2})\+?\s+years?\b/i)?.[1],
  };
}

function normalizeHeading(line) {
  const normalized = line.replace(/[:|]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.length > 40) return null;
  return SECTION_ALIASES.get(normalized) || null;
}

function detectName(lines) {
  for (const line of lines.slice(0, 5)) {
    const words = line.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 5 &&
      !/[@0-9]/.test(line) &&
      !/\b(resume|curriculum|summary|skills|experience|education)\b/i.test(line)
    ) {
      return line;
    }
  }
  return 'Your Name';
}

function extractKeywords(text, limit) {
  const counts = new Map();
  const phrases = text.match(/[A-Za-z][A-Za-z0-9+#./-]{2,}/g) || [];

  for (const rawToken of phrases) {
    let token = rawToken.toLowerCase();
    if (STOPWORDS.has(token)) continue;
    if (token.endsWith('ing') && token.length > 6) token = token.slice(0, -3);
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => titleCaseKeyword(word))
    .slice(0, limit);
}

function selectRelevantLines(lines, keywords, limit) {
  return lines
    .filter(line => line.split(/\s+/).length >= 5)
    .map(line => ({
      line: ensureActionBullet(line),
      score: scoreLine(line, keywords),
    }))
    .sort((a, b) => b.score - a.score || b.line.length - a.line.length)
    .map(item => item.line)
    .slice(0, limit);
}

function scoreLine(line, keywords) {
  const lowered = line.toLowerCase();
  let score = Math.min(4, Math.ceil(line.split(/\s+/).length / 10));
  if (/\d/.test(line)) score += 2;
  for (const keyword of keywords.slice(0, 12)) {
    if (lowered.includes(keyword.toLowerCase())) score += 3;
  }
  return score;
}

function ensureActionBullet(line) {
  const cleaned = stripBullet(line).replace(/\s+/g, ' ').trim();
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function splitSkillLines(lines) {
  return lines.flatMap(line =>
    line.split(/[,|;/]/)
      .map(skill => skill.trim())
      .filter(skill => skill.length > 2)
  );
}

function buildEducation(lines) {
  if (!lines.length) return [];
  return lines.slice(0, 4).map(line => ({
    institution: line,
    degree: 'Education',
    field: '',
    year: line.match(/\b(19|20)\d{2}\b/)?.[0] || '',
    gpa: '',
    honors: '',
  }));
}

function buildSummary(jobRole, keywords, years) {
  const keywordText = keywords.slice(0, 5).join(', ') || 'role-specific execution, collaboration, and measurable delivery';
  const experienceText = years ? `${years}+ years of experience` : 'hands-on experience';
  return `ATS-optimized ${jobRole} with ${experienceText} aligned to ${keywordText}. Brings targeted background, clean documentation, and role-relevant achievements organized for recruiter readability and applicant tracking systems.`;
}

function stripBullet(line) {
  return line.replace(/^[\-\u2022*]+\s*/, '').trim();
}

function titleCaseKeyword(word) {
  if (/[+#./-]/.test(word)) return word;
  return word.replace(/\b\w/g, char => char.toUpperCase());
}

function unique(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const normalized = String(item || '').trim();
    const key = normalized.toLowerCase();
    if (normalized && !seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
  }
  return result;
}

export default router;
