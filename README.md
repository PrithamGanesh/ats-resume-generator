# ATS Resume Generator

A self-hosted, rule-based Resume and CV generator that creates ATS-friendly documents locally. It does not use Anthropic, Claude, OpenAI, Gemini, or any other LLM/API service.

## Features

- Rule-based ATS keyword matching from the job role, job description, and responsibilities
- Local resume upload parsing for PDF, DOCX, and TXT files
- Resume and CV output modes
- Server-side PDF and DOCX generation
- ATS score based on keyword coverage
- No API key, no token cost, and no external AI calls
- Uploaded files are deleted after parsing

## Prerequisites

- Node.js v18 or higher
- npm

## Quick Start

```powershell
npm install
npm start
```

Open your browser at:

```text
http://localhost:3000
```

For development with auto-restart:

```powershell
npm run dev
```

## Usage

1. Enter the target job role.
2. Paste the job description.
3. Optionally add separate job responsibilities.
4. Upload your current resume as PDF, DOCX, or TXT, or paste the resume text directly.
5. Choose Resume or Full CV.
6. Choose PDF or DOCX.
7. Click Generate ATS-Optimized Document.
8. Review the preview and download the generated file.

## How The Rule-Based Generator Works

The generator does not rewrite content using an LLM. Instead, it uses deterministic logic in `src/routes/generate.js`:

- Extracts keywords from the target job role, job description, and responsibilities.
- Parses common resume sections such as summary, skills, experience, education, and certifications.
- Scores resume lines by keyword overlap, length, and measurable details.
- Selects the most relevant lines for the target role.
- Builds a clean single-column document structure for ATS parsing.
- Estimates an ATS score from keyword coverage.

Because this is rule-based, the output is fast and private, but it is less creative than an AI-written resume. Review the final content before applying.

## Project Structure

```text
ats-resume-generator/
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   ├── server.js
│   ├── routes/
│   │   ├── generate.js
│   │   └── upload.js
│   └── lib/
│       ├── pdfBuilder.js
│       └── docxBuilder.js
├── package.json
└── README.md
```

## Configuration

No `.env` file is required.

To use a different port, set `PORT` before starting the app:

```powershell
$env:PORT=3001
npm start
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Port 3000 is already in use | Set a different `PORT` value before running `npm start`. |
| PDF upload has garbled text | Paste the resume text directly or upload a DOCX/TXT version. |
| DOCX upload fails | Ensure dependencies are installed with `npm install`. |
| Generated content feels generic | Add more detailed job responsibilities and richer resume text. |

## License

MIT
