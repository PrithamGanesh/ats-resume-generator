const sectionAliases = {
  summary: "Professional Summary",
  profile: "Professional Summary",
  "professional summary": "Professional Summary",
  objective: "Professional Summary",
  experience: "Professional Experience",
  "work experience": "Professional Experience",
  employment: "Professional Experience",
  "employment history": "Professional Experience",
  education: "Education",
  skills: "Technical Skills",
  "technical skills": "Technical Skills",
  "core skills": "Technical Skills",
  projects: "Projects",
  certifications: "Certifications",
  achievements: "Achievements",
  publications: "Publications",
};

const stopwords = new Set([
  "a",
  "about",
  "across",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "build",
  "by",
  "for",
  "from",
  "have",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "them",
  "this",
  "to",
  "using",
  "with",
  "you",
  "your",
]);

function createTailoredDocument({
  jobRole,
  jobDescription,
  jobResponsibilities,
  sourceText,
  documentType,
}) {
  const parsedSource = parseSourceDocument(sourceText);
  const keywords = deriveKeywords(jobRole, jobDescription, jobResponsibilities, sourceText);

  const summary = buildSummary(jobRole, keywords, sourceText);
  const competencies = buildCompetencies(parsedSource, keywords);
  const experienceLines = buildExperienceLines(parsedSource, keywords, documentType);

  const sections = [
    { title: "Professional Summary", kind: "paragraphs", lines: [summary] },
    { title: "Core Competencies", kind: "bullets", lines: competencies },
    { title: "Professional Experience", kind: "bullets", lines: experienceLines },
  ];

  for (const title of [
    "Projects",
    "Education",
    "Certifications",
    "Publications",
    "Achievements",
  ]) {
    const lines = parsedSource.sections[title] || [];
    const cleaned = lines.filter((line) => line.trim());
    if (
      cleaned.length &&
      (documentType === "cv" || title === "Education" || title === "Certifications")
    ) {
      sections.push({ title, kind: "bullets", lines: cleaned.slice(0, 14) });
    }
  }

  const compiledText = [
    parsedSource.name,
    summary,
    competencies.join(" "),
    experienceLines.join(" "),
  ].join("\n");
  const topKeywords = keywords.slice(0, 12);
  const matchedKeywords = topKeywords.filter((word) =>
    compiledText.toLowerCase().includes(word.toLowerCase()),
  );
  const coverage = matchedKeywords.length / Math.max(1, topKeywords.length);
  const atsScore = Math.min(
    98,
    Math.max(62, Math.floor(62 + coverage * 30 + Math.min(summary.length / 18, 6))),
  );

  return {
    document: {
      name: parsedSource.name,
      headline: jobRole.trim(),
      contact_line: parsedSource.contactLine,
      document_type: documentType,
      sections,
    },
    analysis: {
      ats_score: atsScore,
      keywords: topKeywords,
      matched_keywords: matchedKeywords,
      source_sections_detected: Object.keys(parsedSource.sections).sort(),
    },
  };
}

function parseSourceDocument(sourceText) {
  const lines = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { name: "Candidate Name", contactLine: "", sections: {} };
  }

  const joinedText = lines.join("\n");
  const name = detectName(lines);
  const contacts = extractContacts(joinedText);
  const sections = splitIntoSections(lines);

  if (!sections["Professional Experience"]) {
    const overviewLines = lines.slice(1, 20).filter((line) => !contacts.includes(line));
    if (overviewLines.length) {
      sections["Professional Experience"] = overviewLines;
    }
  }

  if (!sections.Education) {
    const educationHits = lines.filter((line) =>
      /\b(bachelor|master|phd|b\.tech|m\.tech|mba|university|college)\b/i.test(line),
    );
    if (educationHits.length) {
      sections.Education = educationHits.slice(0, 5);
    }
  }

  return {
    name,
    contactLine: contacts.slice(0, 4).join(" | "),
    sections,
  };
}

function detectName(lines) {
  for (const line of lines.slice(0, 5)) {
    const words = line.split(/\s+/);
    if (
      words.length > 1 &&
      words.length <= 5 &&
      !/[@0-9]/.test(line) &&
      !/\b(summary|experience|skills|education|resume|curriculum)\b/i.test(line)
    ) {
      return line;
    }
  }
  return "Candidate Name";
}

function extractContacts(text) {
  const contacts = [];
  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const linkedinMatch = text.match(/(linkedin\.com\/in\/[^\s|]+)/i);
  const websiteMatch = text.match(/(https?:\/\/[^\s|]+)/i);

  for (const match of [emailMatch, phoneMatch, linkedinMatch, websiteMatch]) {
    if (match) {
      contacts.push(match[1] || match[0]);
    }
  }

  return contacts;
}

function splitIntoSections(lines) {
  const sections = { "Professional Experience": [] };
  let currentTitle = "Professional Experience";

  for (const line of lines.slice(1)) {
    const canonical = canonicalHeading(line);
    if (canonical) {
      currentTitle = canonical;
      sections[currentTitle] = sections[currentTitle] || [];
      continue;
    }

    sections[currentTitle] = sections[currentTitle] || [];
    sections[currentTitle].push(stripBullet(line));
  }

  return Object.fromEntries(
    Object.entries(sections).map(([title, content]) => [
      title,
      content.filter((line) => line.trim()),
    ]),
  );
}

function canonicalHeading(line) {
  const normalized = line.replace(/[:|]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  if (sectionAliases[normalized]) {
    return sectionAliases[normalized];
  }
  if (normalized.split(" ").length <= 3 && /^[a-z ]+$/.test(normalized)) {
    return sectionAliases[normalized] || null;
  }
  return null;
}

function deriveKeywords(jobRole, jobDescription, jobResponsibilities, sourceText) {
  const combined = [jobRole, jobDescription, jobResponsibilities, sourceText.slice(0, 2500)].join(
    " ",
  );
  const tokens = combined.match(/[A-Za-z][A-Za-z0-9+#./-]{2,}/g) || [];
  const counter = new Map();

  for (const token of tokens) {
    let lowered = token.toLowerCase();
    if (stopwords.has(lowered)) {
      continue;
    }
    if (lowered.endsWith("ing") && lowered.length > 6) {
      lowered = lowered.slice(0, -3);
    }
    counter.set(lowered, (counter.get(lowered) || 0) + 1);
  }

  const ranked = [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 40);
  const prioritized = [];

  for (const seed of [jobRole.toLowerCase(), "ats", "resume"]) {
    if (seed && counter.has(seed) && !prioritized.includes(seed)) {
      prioritized.push(seed);
    }
  }
  for (const word of ranked) {
    if (!prioritized.includes(word)) {
      prioritized.push(word);
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of prioritized.map(humanizeKeyword)) {
    const lowered = item.toLowerCase();
    if (!seen.has(lowered) && item.length > 2) {
      seen.add(lowered);
      deduped.push(item);
    }
  }

  return deduped.slice(0, 20);
}

function humanizeKeyword(keyword) {
  if (keyword === keyword.toUpperCase()) {
    return keyword;
  }
  if (/[/.+]/.test(keyword)) {
    return keyword;
  }
  return keyword.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSummary(jobRole, keywords, sourceText) {
  const topTerms =
    keywords.slice(0, 4).join(", ") || "business impact, delivery, collaboration, execution";
  const yearsMatch = sourceText.match(/\b(\d{1,2})\+?\s+years?\b/i);
  const experienceFragment = yearsMatch
    ? `${yearsMatch[1]}+ years of experience `
    : "hands-on experience ";

  return (
    `ATS-optimized ${jobRole} with ${experienceFragment}` +
    `delivering measurable results across ${topTerms}. ` +
    "Known for translating business requirements into clear execution, stakeholder alignment, " +
    "and keyword-rich documentation that maps directly to target role expectations."
  );
}

function buildCompetencies(parsedSource, keywords) {
  const sourceSkills = parsedSource.sections["Technical Skills"] || [];
  const extractedSkillTokens = [];

  for (const line of sourceSkills) {
    for (const fragment of line.split(/[,|/]/g)) {
      const trimmed = fragment.trim();
      if (trimmed.length > 2) {
        extractedSkillTokens.push(trimmed);
      }
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of [...extractedSkillTokens, ...keywords]) {
    const lowered = item.trim().toLowerCase();
    if (lowered && !seen.has(lowered)) {
      seen.add(lowered);
      deduped.push(item.trim());
    }
  }

  return deduped.slice(0, 12);
}

function buildExperienceLines(parsedSource, keywords, documentType) {
  let candidateLines = [];
  for (const sectionName of ["Professional Experience", "Projects", "Achievements"]) {
    candidateLines.push(...(parsedSource.sections[sectionName] || []));
  }

  if (!candidateLines.length) {
    candidateLines = [
      "Adapted source document content to align with the target role and ATS requirements.",
    ];
  }

  const scoredLines = candidateLines
    .filter((line) => line.trim().split(/\s+/).length >= 4)
    .map((line) => ({
      score: scoreLineAgainstKeywords(line, keywords),
      line: cleanupExperienceLine(line),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.line.length - a.line.length;
    });

  const maxItems = documentType === "cv" ? 10 : 7;
  const curated = scoredLines.slice(0, maxItems).map((item) => item.line);

  return curated.length ? curated : [cleanupExperienceLine(candidateLines[0])];
}

function cleanupExperienceLine(line) {
  const cleaned = stripBullet(line).replace(/\s+/g, " ").trim();
  if (cleaned && !/[.!?]$/.test(cleaned)) {
    return `${cleaned}.`;
  }
  return cleaned;
}

function stripBullet(line) {
  return line.replace(/^[\-\u2022*]+\s*/, "").trim();
}

function scoreLineAgainstKeywords(line, keywords) {
  const lowered = line.toLowerCase();
  let score = 0;
  for (const keyword of keywords.slice(0, 14)) {
    if (lowered.includes(keyword.toLowerCase())) {
      score += 3;
    }
  }
  score += Math.min(4, Math.ceil(line.split(/\s+/).length / 10));
  if (/\d/.test(line)) {
    score += 2;
  }
  return score;
}

module.exports = {
  createTailoredDocument,
};
