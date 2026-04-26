import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { buildDocx } from '../lib/docxBuilder.js';
import { buildPdf } from '../lib/pdfBuilder.js';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/', async (req, res) => {
  const { jobRole, jobDescription, responsibilities, existingResume, candidateName, docType, outputFormat } = req.body;

  if (!jobRole || !jobDescription) {
    return res.status(400).json({ error: 'jobRole and jobDescription are required.' });
  }
  if (!existingResume || existingResume.trim().length < 30) {
    return res.status(400).json({ error: 'Please provide your existing resume content.' });
  }

  const prompt = buildPrompt({ jobRole, jobDescription, responsibilities, existingResume, candidateName, docType });

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content.map(b => b.text || '').join('');
    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response. Please retry.' });
    }

    // Build downloadable file
    let fileBuffer, mimeType, filename;
    const safeName = (parsed.name || candidateName || 'resume').replace(/\s+/g, '_');

    if (outputFormat === 'docx') {
      fileBuffer = await buildDocx(parsed, docType);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = `${safeName}_ATS_${docType === 'cv' ? 'CV' : 'Resume'}.docx`;
    } else {
      fileBuffer = await buildPdf(parsed, docType);
      mimeType = 'application/pdf';
      filename = `${safeName}_ATS_${docType === 'cv' ? 'CV' : 'Resume'}.pdf`;
    }

    // Send JSON data + base64 file in one response
    res.json({
      resume: parsed,
      file: {
        data: Buffer.from(fileBuffer).toString('base64'),
        mimeType,
        filename,
      }
    });

  } catch (err) {
    console.error('Anthropic API error:', err);
    const msg = err?.error?.error?.message || err.message || 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

function buildPrompt({ jobRole, jobDescription, responsibilities, existingResume, candidateName, docType }) {
  return `You are a world-class resume writer and ATS (Applicant Tracking System) optimization expert with 15+ years of experience helping candidates land interviews at top companies.

TASK: Create a highly tailored, ATS-optimized ${docType === 'cv' ? 'Curriculum Vitae (CV)' : 'Resume'} for the job application below.

═══════════════════════════════════════
CANDIDATE NAME: ${candidateName || 'Use name from existing resume'}
TARGET ROLE: ${jobRole}
═══════════════════════════════════════

JOB DESCRIPTION:
${jobDescription}

${responsibilities ? `KEY RESPONSIBILITIES:\n${responsibilities}\n` : ''}

CANDIDATE'S EXISTING RESUME/BACKGROUND:
${existingResume}

═══════════════════════════════════════
ATS OPTIMIZATION RULES (strictly follow):
1. Mirror exact keywords and phrases from the job description naturally throughout
2. Use ONLY standard section headings: PROFESSIONAL SUMMARY, CORE COMPETENCIES, PROFESSIONAL EXPERIENCE, EDUCATION, CERTIFICATIONS, ADDITIONAL SKILLS
3. Single-column layout only — no tables, columns, text boxes, or graphics
4. Every bullet point starts with a strong past/present action verb
5. Quantify ALL achievements (%, $, headcount, time saved, revenue impact)
6. Professional Summary: 2-3 punchy sentences, keyword-rich, role-specific
7. Skills section: mirror exact terminology from JD (not synonyms)
8. Keep bullets to 1-2 lines max; 4-6 bullets per role
9. Prioritize the most recent and most relevant experience
10. If ${docType === 'cv' ? 'CV' : 'Resume'}: ${docType === 'cv' ? 'include publications, research, all academic credentials, conferences — comprehensive' : 'keep to 1 page if under 5 years experience, 2 pages max otherwise'}
11. Infer and adapt real information from the candidate background — never fabricate companies or degrees
12. Calculate a realistic ATS compatibility score based on keyword coverage

RESPONSE: Return ONLY a raw JSON object — no markdown, no backticks, no explanation, no preamble.

{
  "atsScore": 94,
  "name": "Full Name",
  "contactLine": "email@example.com  |  +91 98XXX XXXXX  |  linkedin.com/in/handle  |  City, State",
  "summary": "Targeted 2-3 sentence professional summary packed with role-specific keywords...",
  "coreCompetencies": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6", "Skill 7", "Skill 8", "Skill 9", "Skill 10", "Skill 11", "Skill 12"],
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "location": "City, State",
      "dates": "Jan 2021 – Present",
      "bullets": [
        "Led cross-functional team of 12 engineers to deliver $2.4M platform migration 3 weeks ahead of schedule",
        "Increased system throughput by 47% by redesigning microservices architecture using Kubernetes and Helm",
        "Reduced operational costs by $380K annually through automation of manual QA pipeline"
      ]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Bachelor of Technology",
      "field": "Computer Science",
      "year": "2019",
      "gpa": "8.7/10",
      "honors": "Dean's List"
    }
  ],
  "certifications": ["AWS Certified Solutions Architect – Associate (2023)", "PMP Certified (2022)"],
  "additionalSkills": ["Python", "SQL", "Tableau", "JIRA", "Confluence"],
  "keywordsMatched": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "improvements": [
    "Tailored summary to emphasize leadership and cloud experience from JD",
    "Quantified all 3 roles with revenue and efficiency metrics",
    "Added 8 exact-match keywords from job description"
  ]
}`;
}

export default router;
