# ATS Resume Generator — Rule-Based Edition

**100% free. Unlimited. No AI. No API keys. No internet required after setup.**

Pure algorithmic resume optimisation using keyword matching, gap analysis, and rule-based restructuring. Runs entirely on your machine with Docker.

---

## How It Works

```
Job Description + Your Resume
         │
         ▼
┌─────────────────────────────┐
│  1. Keyword Extraction      │  Scans 500+ industry skills from JD
│  2. Resume Parser           │  Detects sections, experience, skills
│  3. Gap Analysis & Scoring  │  Keyword match rate + verb strength
│  4. Resume Builder          │  Restructures with ATS rules applied
│  5. File Generation         │  Outputs PDF or DOCX instantly
└─────────────────────────────┘
         │
         ▼
  ATS-Safe PDF / DOCX
```

**No model downloads. No API calls. Generates in under 2 seconds.**

---

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- That's it.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/ats-resume-generator.git
cd ats-resume-generator

# 2. Build and start
docker compose up --build

# 3. Open
# http://localhost:3000
```

To stop:
```bash
docker compose down
```

---

## Project Structure

```
ats-resume-generator/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py              # Flask API (health, upload, generate)
│   ├── ats_engine.py       # Core rule-based engine (all logic lives here)
│   ├── resume_parser.py    # File upload text extractor (PDF/DOCX/TXT)
│   ├── pdf_builder.py      # ReportLab PDF generator
│   └── docx_builder.py     # python-docx DOCX generator
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── server.js           # Express static server + API proxy
    └── public/
        ├── index.html
        ├── style.css
        └── app.js
```

---

## ATS Engine Rules Applied

| Rule | Description |
|------|-------------|
| Keyword extraction | 500+ skills across tech, business, soft skills taxonomy |
| Section detection | Recognises 30+ section heading variants |
| Verb strengthening | Replaces 15 weak verbs with strong action alternatives |
| Gap analysis | Splits missing skills into critical vs nice-to-have |
| ATS score | Weighted: 45% skill coverage + 30% keyword overlap + 15% format + 10% verb strength |
| Single-column output | No tables, no columns, no images — maximum parser compatibility |
| Competency ranking | Prioritises matched skills → resume skills → JD skills |

---

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Rule-Based ATS Resume Generator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ats-resume-generator.git
git push -u origin main
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 3000 in use | Change `"3000:3000"` → `"3001:3000"` in `docker-compose.yml` |
| Port 5000 in use | Change `"5000:5000"` → `"5001:5000"` and update `BACKEND_URL` |
| PDF looks wrong | Try DOCX format instead |
| Resume sections not detected | Ensure headings like "Experience", "Education", "Skills" are on their own line |
| Skills not matching | Paste a longer, more detailed job description |

---

## Cost

**$0.00** — no API, no model, no subscription, no limits.
