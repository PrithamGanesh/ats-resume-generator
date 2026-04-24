# ATS Resume and CV Generator

Node.js web application that accepts:

- Job Role
- Job Description
- Job Responsibilities
- Existing resume or CV upload (`.txt`, `.docx`, `.pdf`)

It generates a tailored ATS-friendly resume or CV preview and provides downloads in:

- PDF
- DOCX

## Run locally

```powershell
npm install
npm start
```

Then open `http://127.0.0.1:3000`.

## Test

```powershell
npm test
```

## Notes

- PDF parsing is best-effort and works best with text-based PDFs.
- DOCX parsing and export are handled locally in Node.js.
- Generated files are stored in memory temporarily for download.
