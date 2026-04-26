# ATS Resume Generator

A self-hosted, AI-powered Resume & CV generator that creates tailored, ATS-optimized documents using your own Anthropic (Claude) API key. No subscription. No usage limits beyond what Anthropic charges per token.

---

## Features

- **ATS Keyword Optimization** — mirrors exact phrases from the job description
- **PDF + DOCX Output** — server-side generation using `pdf-lib` and `docx`
- **File Upload** — parses existing PDF, DOCX, or TXT resumes
- **Resume vs Full CV** — two modes with different content depth
- **ATS Score** — estimates keyword coverage percentage
- **Improvements Report** — shows what the AI changed and why
- **Zero data retention** — files are deleted after parsing, nothing is stored

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- An [Anthropic API key](https://console.anthropic.com)
- Git (for pushing to GitHub)

---

## Quick Start

### 1. Clone / open in VS Code

```bash
git clone https://github.com/YOUR_USERNAME/ats-resume-generator.git
cd ats-resume-generator
code .
```

Or if you downloaded the zip, just open the folder in VS Code.

### 2. Install dependencies

```bash
npm install
```

### 3. Set your API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder:

```
ANTHROPIC_API_KEY=sk-ant-your-real-key-here
```

> Your key never leaves your machine. It is only used server-side.

### 4. Run the app

```bash
npm run dev
```

Open your browser at **http://localhost:3000**

---

## Usage

1. Enter the **target job role** (e.g. "Senior Software Engineer")
2. Paste the **full job description** — the longer, the better
3. Optionally add **key responsibilities** if they are separate from the JD
4. **Upload your existing resume** (PDF/DOCX/TXT) OR paste the text directly
5. Choose **Resume** or **Full CV** and your preferred output format (**PDF** or **DOCX**)
6. Click **Generate ATS-Optimized Document**
7. Review the preview, then click **Download** to save your file

---

## Deploy to GitHub

```bash
# Inside the project folder
git init
git add .
git commit -m "Initial commit: ATS Resume Generator"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ats-resume-generator.git
git push -u origin main
```

> **IMPORTANT**: `.env` is in `.gitignore` — your API key will NOT be pushed to GitHub. Never remove `.env` from `.gitignore`.

---

## Project Structure

```
ats-resume-generator/
├── public/
│   ├── index.html        # Single-page frontend
│   ├── style.css         # All styles
│   └── app.js            # Frontend logic
├── src/
│   ├── server.js         # Express server entry point
│   ├── routes/
│   │   ├── generate.js   # POST /api/generate → calls Claude API
│   │   └── upload.js     # POST /api/upload  → parses uploaded file
│   └── lib/
│       ├── pdfBuilder.js  # Builds ATS-safe PDF using pdf-lib
│       └── docxBuilder.js # Builds ATS-safe DOCX using docx npm package
├── .env.example           # Template — copy to .env and fill in your key
├── .env                   # Your secrets — never committed to git
├── .gitignore
└── package.json
```

---

## Customization

### Change the AI model
In `src/routes/generate.js`, update the `model` field:
```js
model: 'claude-opus-4-5',   // Most capable
model: 'claude-sonnet-4-6', // Faster, slightly cheaper
```

### Adjust the prompt
The full prompt is in `buildPrompt()` inside `src/routes/generate.js`. You can tweak the ATS rules, section names, or output JSON shape.

### Change port
In `.env`:
```
PORT=8080
```

---

## API Cost Estimate

Using `claude-opus-4-5` (~4K tokens in + ~4K tokens out per generation):
- Cost per resume: **~$0.06–$0.10 USD**
- 100 resumes: **~$6–10 USD**

Using `claude-sonnet-4-6`:
- Cost per resume: **~$0.01–$0.02 USD**

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ANTHROPIC_API_KEY missing` | Check your `.env` file exists and has the key |
| PDF shows garbled text | Try pasting the text directly instead of uploading |
| `npm install` fails | Ensure Node.js 18+ is installed: `node --version` |
| Port 3000 in use | Set `PORT=3001` in `.env` |
| DOCX opens with errors | Open in LibreOffice or Google Docs if MS Word has issues |

---

## License

MIT — use freely, modify as you wish.
