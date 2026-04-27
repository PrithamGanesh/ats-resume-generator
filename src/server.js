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

app.use('/api/generate', generateRoute);
app.use('/api/upload', uploadRoute);

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log('\nATS Resume Generator');
  console.log(`    Running at: http://localhost:${PORT}`);
  console.log('    Mode:       Rule-based local generation, no API key required\n');
});
