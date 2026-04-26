import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import generateRoute from './routes/generate.js';
import uploadRoute from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/generate', generateRoute);
app.use('/api/upload', uploadRoute);

// Fallback to index.html for SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log('\n🚀  ATS Resume Generator');
  console.log(`    Running at: http://localhost:${PORT}`);
  console.log(`    API Key:    ${process.env.ANTHROPIC_API_KEY ? '✓ loaded' : '✗ MISSING — set ANTHROPIC_API_KEY in .env'}\n`);
});
