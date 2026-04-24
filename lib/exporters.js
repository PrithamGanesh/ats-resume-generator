const AdmZip = require("adm-zip");

function makeSafeFilename(name, documentType) {
  const base = `${name || "candidate"}_${documentType}`;
  const cleaned = base.trim().replace(/[^A-Za-z0-9._-]+/g, "_");
  return cleaned.replace(/^[._]+|[._]+$/g, "") || "candidate_document";
}

function generateDocxBuffer(document) {
  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from(contentTypesXml(), "utf8"));
  zip.addFile("_rels/.rels", Buffer.from(rootRelsXml(), "utf8"));
  zip.addFile("docProps/app.xml", Buffer.from(appXml(), "utf8"));
  zip.addFile("docProps/core.xml", Buffer.from(coreXml(document), "utf8"));
  zip.addFile("word/document.xml", Buffer.from(documentXml(document), "utf8"));
  zip.addFile("word/styles.xml", Buffer.from(stylesXml(), "utf8"));
  zip.addFile("word/_rels/document.xml.rels", Buffer.from(documentRelsXml(), "utf8"));
  return zip.toBuffer();
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ATS Resume Generator</Application>
</Properties>`;
}

function coreXml(document) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(`${document.name} ${document.document_type.toUpperCase()}`)}</dc:title>
  <dc:creator>ATS Resume Generator</dc:creator>
  <cp:lastModifiedBy>ATS Resume Generator</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

function documentXml(document) {
  const bodyParts = [
    paragraphXml(document.name, "Title"),
    paragraphXml(document.headline, "Heading1"),
  ];

  if (document.contact_line) {
    bodyParts.push(paragraphXml(document.contact_line));
  }

  for (const section of document.sections) {
    bodyParts.push(paragraphXml(section.title, "Heading1"));
    for (const line of section.lines) {
      bodyParts.push(paragraphXml(section.kind === "bullets" ? `- ${line}` : line));
    }
  }

  bodyParts.push('<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
 xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
 xmlns:wne="http://schemas.microsoft.com/office/2006/wordml"
 xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
 mc:Ignorable="w14 wp14">
  <w:body>${bodyParts.join("")}</w:body>
</w:document>`;
}

function paragraphXml(text, style) {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function generatePdfBuffer(document) {
  const pages = buildPdfPages(document);
  const fontRegular = 3;
  const fontBold = 4;
  const pagesObject = 2;
  const objects = {
    1: Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    [fontRegular]: Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1"),
    [fontBold]: Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
      "latin1",
    ),
  };

  let nextObject = 5;
  const pageObjectIds = [];

  for (const pageCommands of pages) {
    const contentId = nextObject;
    const pageId = nextObject + 1;
    nextObject += 2;

    const stream = Buffer.from(`BT\n${pageCommands.join("\n")}\nET`, "latin1");
    objects[contentId] = Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
      stream,
      Buffer.from("\nendstream", "latin1"),
    ]);
    objects[pageId] = Buffer.from(
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`,
      "latin1",
    );
    pageObjectIds.push(pageId);
  }

  objects[pagesObject] = Buffer.from(
    `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds
      .map((pageId) => `${pageId} 0 R`)
      .join(" ")}] >>`,
    "latin1",
  );

  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];

  for (let objectId = 1; objectId < nextObject; objectId += 1) {
    offsets[objectId] = Buffer.concat(chunks).length;
    chunks.push(Buffer.from(`${objectId} 0 obj\n`, "latin1"));
    chunks.push(objects[objectId]);
    chunks.push(Buffer.from("\nendobj\n", "latin1"));
  }

  const body = Buffer.concat(chunks);
  const xrefOffset = body.length;
  const xrefLines = [`xref\n0 ${nextObject}\n`, "0000000000 65535 f \n"];
  for (let objectId = 1; objectId < nextObject; objectId += 1) {
    xrefLines.push(`${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`);
  }
  xrefLines.push(`trailer\n<< /Size ${nextObject} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return Buffer.concat([body, Buffer.from(xrefLines.join(""), "latin1")]);
}

function buildPdfPages(document) {
  const pages = [[]];
  let currentY = 750;

  function addLine(text, font = "F1", size = 10, gap = 14) {
    if (currentY < 60) {
      pages.push([]);
      currentY = 750;
    }
    pages[pages.length - 1].push(
      `/${font} ${size} Tf 1 0 0 1 50 ${currentY} Tm (${escapePdf(text)}) Tj`,
    );
    currentY -= gap;
  }

  addLine(document.name, "F2", 18, 24);
  addLine(document.headline, "F2", 11, 18);
  if (document.contact_line) {
    for (const line of wrapText(document.contact_line, 85)) {
      addLine(line);
    }
  }
  currentY -= 4;

  for (const section of document.sections) {
    addLine(section.title, "F2", 12, 18);
    for (const line of section.lines) {
      const prefix = section.kind === "bullets" ? "- " : "";
      for (const wrapped of wrapText(`${prefix}${line}`, section.kind === "paragraphs" ? 84 : 80)) {
        addLine(wrapped);
      }
    }
    currentY -= 6;
  }

  return pages;
}

function wrapText(text, width) {
  if (!text) {
    return [""];
  }

  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [text];
}

function escapePdf(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

module.exports = {
  generateDocxBuffer,
  generatePdfBuffer,
  makeSafeFilename,
};
