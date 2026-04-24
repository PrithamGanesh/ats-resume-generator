const assert = require("node:assert/strict");

const { app } = require("../server");
const { extractDocx, extractTextFromUpload } = require("../lib/documentUtils");
const { generateDocxBuffer, generatePdfBuffer } = require("../lib/exporters");
const { createTailoredDocument } = require("../lib/resumeEngine");

const sourceText = `Alex Johnson
alex@example.com
+1 (555) 123-4567
linkedin.com/in/alexjohnson

SUMMARY
Data analyst with 5 years of experience driving reporting and dashboard automation.

SKILLS
SQL, Python, Tableau, Power BI, stakeholder communication, ETL

EXPERIENCE
- Built SQL dashboards for finance and operations teams, reducing manual reporting by 45 percent
- Partnered with stakeholders to translate business requirements into KPI reporting
- Automated recurring analysis with Python and data pipelines

EDUCATION
Bachelor of Science in Information Systems`;

function buildDocument(documentType = "resume") {
  return createTailoredDocument({
    jobRole: "Senior Data Analyst",
    jobDescription:
      "Seeking a data analyst with SQL, Python, dashboards, stakeholder management, and reporting expertise.",
    jobResponsibilities:
      "Own reporting, build KPI dashboards, automate analysis, and communicate insights.",
    sourceText,
    documentType,
  });
}

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("document generation contains core sections", () => {
  const { document, analysis } = buildDocument("resume");

  assert.equal(document.headline, "Senior Data Analyst");
  assert.ok(analysis.ats_score >= 62);
  assert.deepEqual(
    document.sections.slice(0, 3).map((section) => section.title),
    ["Professional Summary", "Core Competencies", "Professional Experience"],
  );
});

test("exporters return expected file signatures", () => {
  const { document } = buildDocument("cv");

  const pdf = generatePdfBuffer(document);
  const docx = generateDocxBuffer(document);

  assert.equal(pdf.subarray(0, 4).toString("latin1"), "%PDF");
  assert.equal(docx.subarray(0, 2).toString("latin1"), "PK");
});

test("docx extraction round trip works", () => {
  const { document } = buildDocument("resume");
  const recoveredText = extractDocx(generateDocxBuffer(document));

  assert.match(recoveredText, /Alex Johnson/);
  assert.match(recoveredText, /Senior Data Analyst/);
});

test("txt upload extraction works", () => {
  const text = extractTextFromUpload({
    originalname: "resume.txt",
    buffer: Buffer.from(sourceText, "utf8"),
  });

  assert.match(text, /Alex Johnson/);
  assert.match(text, /dashboard automation/);
});

test("api generate returns preview and download links", async () => {
  const server = app.listen(0);
  const address = server.address();

  try {
    const form = new FormData();
    form.append("job_role", "Senior Data Analyst");
    form.append(
      "job_description",
      "Seeking a data analyst with SQL, Python, dashboards, stakeholder management, and reporting expertise.",
    );
    form.append(
      "job_responsibilities",
      "Own reporting, build KPI dashboards, automate analysis, and communicate insights.",
    );
    form.append("document_type", "resume");
    form.append("document", new Blob([sourceText], { type: "text/plain" }), "resume.txt");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/generate`, {
      method: "POST",
      body: form,
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.ok(payload.token);
    assert.equal(payload.preview.headline, "Senior Data Analyst");
    assert.ok(payload.downloads.pdf.includes("/download/"));
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});

async function run() {
  let failed = 0;

  for (const item of tests) {
    try {
      await item.fn();
      console.log(`ok - ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${item.name}`);
      console.error(error);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run();
