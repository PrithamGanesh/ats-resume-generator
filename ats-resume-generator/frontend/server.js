'use strict';
const express = require('express');
const path    = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app         = express();
const PORT        = process.env.PORT        || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:5000';

app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  on: {
    error: (_err, _req, res) => {
      res.status(502).json({ error: 'Backend unavailable.' });
    },
  },
}));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n✅  ATS Resume Generator`);
  console.log(`    http://localhost:${PORT}\n`);
});
