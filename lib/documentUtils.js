const zlib = require("zlib");
const AdmZip = require("adm-zip");

class DocumentProcessingError extends Error {}

const supportedExtensions = new Set([".txt", ".docx", ".pdf"]);

function extractTextFromUpload(file) {
  const originalName = file.originalname || "";
  const extension = originalName.includes(".")
    ? originalName.slice(originalName.lastIndexOf(".")).toLowerCase()
    : "";

  if (!supportedExtensions.has(extension)) {
    throw new DocumentProcessingError(
      "Unsupported file type. Please upload a TXT, DOCX, or PDF document.",
    );
  }
  if (!file.buffer || file.buffer.length === 0) {
    throw new DocumentProcessingError("The uploaded file is empty.");
  }

  let text = "";
  if (extension === ".txt") {
    text = extractTxt(file.buffer);
  } else if (extension === ".docx") {
    text = extractDocx(file.buffer);
  } else {
    text = extractPdf(file.buffer);
  }

  text = normalizeText(text);
  if (text.length < 80) {
    throw new DocumentProcessingError(
      "Not enough text could be extracted from the uploaded file. Please upload a text-based resume or CV.",
    );
  }

  return text;
}

function extractTxt(buffer) {
  const utf8 = buffer.toString("utf8");
  return utf8.includes("\uFFFD") ? buffer.toString("latin1") : utf8;
}

function extractDocx(buffer) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (_error) {
    throw new DocumentProcessingError("The DOCX file appears to be invalid.");
  }

  const members = zip
    .getEntries()
    .map((entry) => entry.entryName)
    .filter(
      (name) =>
        name.startsWith("word/") &&
        ["/document.xml", "/header1.xml", "/header2.xml", "/footer1.xml"].some((suffix) =>
          name.endsWith(suffix),
        ),
    );

  return members
    .sort()
    .map((member) => {
      const entry = zip.getEntry(member);
      return entry ? readDocxXml(entry.getData().toString("utf8")) : "";
    })
    .filter(Boolean)
    .join("\n");
}

function readDocxXml(xml) {
  const paragraphs = [...xml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((match) => {
    let paragraph = match[0];
    paragraph = paragraph.replace(/<w:tab\/>/g, "\t");
    paragraph = paragraph.replace(/<w:br\/>/g, "\n");
    paragraph = paragraph.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g, (_full, text) =>
      decodeXml(text),
    );
    paragraph = paragraph.replace(/<[^>]+>/g, "");
    return normalizeText(paragraph);
  });

  return paragraphs.filter(Boolean).join("\n");
}

function extractPdf(buffer) {
  const content = buffer.toString("latin1");
  const streams = [...content.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  const extractedSegments = [];

  for (const match of streams) {
    const rawStream = Buffer.from(match[1], "latin1");
    const candidates = [rawStream];
    try {
      candidates.push(zlib.inflateSync(rawStream));
    } catch (_error) {
      // Some PDF streams are not deflated. The raw stream may still contain text.
    }

    for (const candidate of candidates) {
      const text = extractPdfStrings(candidate.toString("latin1"));
      if (text) {
        extractedSegments.push(text);
      }
    }
  }

  if (!extractedSegments.length) {
    throw new DocumentProcessingError(
      "This PDF looks image-based or protected. Please upload a text-based PDF, TXT, or DOCX file.",
    );
  }

  return extractedSegments.join("\n");
}

function extractPdfStrings(content) {
  const segments = [];

  for (const match of content.matchAll(/\((.*?)(?<!\\)\)\s*Tj/gs)) {
    segments.push(decodePdfString(match[1]));
  }
  for (const match of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
    segments.push(decodePdfHex(match[1]));
  }
  for (const arrayMatch of content.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    for (const stringMatch of arrayMatch[1].matchAll(/\((.*?)(?<!\\)\)|<([0-9A-Fa-f]+)>/gs)) {
      if (stringMatch[1] !== undefined) {
        segments.push(decodePdfString(stringMatch[1]));
      } else if (stringMatch[2]) {
        segments.push(decodePdfHex(stringMatch[2]));
      }
    }
  }

  return normalizeText(segments.map((piece) => piece.trim()).filter(Boolean).join(" "));
}

function decodePdfHex(value) {
  let hex = value;
  if (hex.length % 2 !== 0) {
    hex += "0";
  }
  try {
    return Buffer.from(hex, "hex").toString("latin1");
  } catch (_error) {
    return "";
  }
}

function decodePdfString(value) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      output += char;
      continue;
    }

    index += 1;
    if (index >= value.length) {
      break;
    }

    const esc = value[index];
    const mapping = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "\\": "\\",
      "(": "(",
      ")": ")",
    };
    if (mapping[esc]) {
      output += mapping[esc];
      continue;
    }

    if (/[0-7]/.test(esc)) {
      let octal = esc;
      for (let offset = 0; offset < 2; offset += 1) {
        if (index + 1 < value.length && /[0-7]/.test(value[index + 1])) {
          index += 1;
          octal += value[index];
        } else {
          break;
        }
      }
      output += String.fromCharCode(Number.parseInt(octal, 8));
      continue;
    }

    output += esc;
  }
  return output;
}

function normalizeText(value) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

module.exports = {
  DocumentProcessingError,
  extractDocx,
  extractTextFromUpload,
};
