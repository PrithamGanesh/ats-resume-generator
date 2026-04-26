import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const dir = './uploads';
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upload_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed.'));
  }
});

router.post('/', upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { path: filePath, originalname } = req.file;
  const ext = path.extname(originalname).toLowerCase();

  try {
    let text = '';

    if (ext === '.txt') {
      text = await fs.readFile(filePath, 'utf-8');

    } else if (ext === '.pdf') {
      text = await extractPdfText(filePath);

    } else if (ext === '.docx') {
      text = await extractDocxText(filePath);

    } else if (ext === '.doc') {
      text = '[DOC format detected. Please convert to DOCX or paste your resume text manually for best results.]';
    }

    // Cleanup uploaded file
    await fs.unlink(filePath).catch(() => {});

    if (!text || text.trim().length < 20 || isParserFallback(text)) {
      return res.status(422).json({
        error: 'Could not extract readable text from this file. Please paste your resume text directly instead.'
      });
    }

    res.json({ text: text.trim(), filename: originalname });

  } catch (err) {
    await fs.unlink(filePath).catch(() => {});
    console.error('File parse error:', err);
    res.status(500).json({ error: 'Failed to parse file: ' + err.message });
  }
});

async function extractPdfText(filePath) {
  // Dynamic import to handle ESM pdf.js
  try {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    GlobalWorkerOptions.workerSrc = '';
    const data = new Uint8Array(await fs.readFile(filePath));
    const doc = await getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages.join('\n\n');
  } catch {
    // Fallback: read raw bytes and extract ASCII text
    const buf = await fs.readFile(filePath);
    const raw = buf.toString('latin1');
    const matches = raw.match(/\(([^\)]{2,200})\)/g) || [];
    const text = matches.map(m => m.slice(1, -1)).join(' ');
    return text.length > 100 ? text : '[Could not parse PDF — please paste your resume text.]';
  }
}

async function extractDocxText(filePath) {
  try {
    const { default: JSZip } = await import('jszip');
    if (!JSZip) return '[DOCX parsing unavailable — please paste your resume text.]';
    const buf = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml').async('string');
    // Strip XML tags and decode entities
    const text = xml
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<w:p[ >][^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x[0-9A-Fa-f]+;/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text;
  } catch (err) {
    return `[DOCX parse error: ${err.message}. Please paste your resume text instead.]`;
  }
}

function isParserFallback(text) {
  return /^\[(DOC format detected|Could not parse PDF|DOCX parsing unavailable|DOCX parse error)/.test(text.trim());
}

export default router;
