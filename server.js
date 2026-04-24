const path = require("path");
const express = require("express");
const multer = require("multer");

const { DocumentProcessingError, extractTextFromUpload } = require("./lib/documentUtils");
const {
  generateDocxBuffer,
  generatePdfBuffer,
  makeSafeFilename,
} = require("./lib/exporters");
const { createTailoredDocument } = require("./lib/resumeEngine");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const generatedDocuments = new Map();
const documentTtlMs = 60 * 60 * 1000;

function pruneGeneratedDocuments() {
  const cutoff = Date.now() - documentTtlMs;
  for (const [token, payload] of generatedDocuments.entries()) {
    if (payload.createdAt < cutoff) {
      generatedDocuments.delete(token);
    }
  }
}

app.use("/static", express.static(path.join(__dirname, "static")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "templates", "index.html"));
});

app.post("/api/generate", upload.single("document"), (req, res) => {
  pruneGeneratedDocuments();

  const jobRole = (req.body.job_role || "").trim();
  const jobDescription = (req.body.job_description || "").trim();
  const jobResponsibilities = (req.body.job_responsibilities || "").trim();
  const documentType = (req.body.document_type || "resume").trim().toLowerCase();

  if (!jobRole) {
    return res.status(400).json({ error: "Job role is required." });
  }
  if (!jobDescription) {
    return res.status(400).json({ error: "Job description is required." });
  }
  if (!jobResponsibilities) {
    return res.status(400).json({ error: "Job responsibilities are required." });
  }
  if (!["resume", "cv"].includes(documentType)) {
    return res.status(400).json({ error: "Document type must be resume or cv." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Please upload an existing resume or CV." });
  }

  try {
    const sourceText = extractTextFromUpload(req.file);
    const { document, analysis } = createTailoredDocument({
      jobRole,
      jobDescription,
      jobResponsibilities,
      sourceText,
      documentType,
    });

    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    generatedDocuments.set(token, {
      createdAt: Date.now(),
      document,
    });

    return res.json({
      token,
      preview: document,
      analysis,
      downloads: {
        pdf: `/download/${token}/pdf`,
        docx: `/download/${token}/docx`,
      },
    });
  } catch (error) {
    if (error instanceof DocumentProcessingError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({
      error:
        "The uploaded document could not be processed. Please try a text-based TXT, DOCX, or PDF file.",
    });
  }
});

app.get("/download/:token/:fmt", (req, res) => {
  pruneGeneratedDocuments();

  const payload = generatedDocuments.get(req.params.token);
  if (!payload) {
    return res
      .status(404)
      .json({ error: "This generated file has expired. Please regenerate it." });
  }

  const { document } = payload;
  const safeName = makeSafeFilename(document.name, document.document_type);

  if (req.params.fmt === "pdf") {
    const buffer = generatePdfBuffer(document);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    return res.send(buffer);
  }

  if (req.params.fmt === "docx") {
    const buffer = generateDocxBuffer(document);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.docx"`);
    return res.send(buffer);
  }

  return res.status(400).json({ error: "Unsupported export format requested." });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Upload size exceeds the 8 MB limit." });
  }
  return res.status(500).json({ error: "Unexpected server error." });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`ATS Resume Generator running at http://127.0.0.1:${port}`);
  });
}

module.exports = { app };
