/* ─────────────────────────────────────────────────
   ATS Resume Generator — Frontend App Logic
───────────────────────────────────────────────── */

'use strict';

// ── State ──────────────────────────────────────
let state = {
  docType: 'resume',
  outputFormat: 'pdf',
  fileText: '',
  generatedData: null,
  filePayload: null, // { data, mimeType, filename }
};

// ── Init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupCharCounters();
  setupUploadZone();
});

function setupCharCounters() {
  const jd = document.getElementById('jobDesc');
  const rc = document.getElementById('existingResume');
  jd?.addEventListener('input', () => {
    document.getElementById('jdCount').textContent = `${jd.value.length.toLocaleString()} characters`;
  });
  rc?.addEventListener('input', () => {
    document.getElementById('resumeCount').textContent = `${rc.value.length.toLocaleString()} characters`;
  });
}

function setupUploadZone() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) await handleFileUpload(file);
  });

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await handleFileUpload(file);
  });
}

async function handleFileUpload(file) {
  if (file.size > 5 * 1024 * 1024) {
    showError('File too large. Maximum size is 5 MB.');
    return;
  }

  const content = document.getElementById('uploadContent');
  const success = document.getElementById('uploadSuccess');
  const fileName = document.getElementById('uploadFileName');

  // Show loading state
  content.style.opacity = '0.4';
  fileName.textContent = `Uploading ${file.name}...`;
  success.style.display = 'flex';

  const formData = new FormData();
  formData.append('resume', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Upload failed');

    state.fileText = data.text || '';
    content.style.display = 'none';
    success.style.display = 'flex';
    document.getElementById('uploadFileName').textContent = data.filename;
    content.style.opacity = '1';

    // Auto-fill the textarea if it's empty
    const ta = document.getElementById('existingResume');
    if (!ta.value.trim() && state.fileText.length > 20 && !state.fileText.includes('[')) {
      ta.value = state.fileText;
      document.getElementById('resumeCount').textContent = `${ta.value.length.toLocaleString()} characters`;
    }

  } catch (err) {
    content.style.display = '';
    content.style.opacity = '1';
    success.style.display = 'none';
    showError('Upload failed: ' + err.message);
  }
}

function removeFile() {
  state.fileText = '';
  document.getElementById('uploadContent').style.display = '';
  document.getElementById('uploadSuccess').style.display = 'none';
  document.getElementById('fileInput').value = '';
}

// ── Toggle Buttons ─────────────────────────────
function setToggle(key, value, btn) {
  state[key === 'docType' ? 'docType' : 'outputFormat'] = value;
  const groupId = key === 'docType' ? 'docTypeToggle' : 'formatToggle';
  document.querySelectorAll(`#${groupId} .toggle-btn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Generate ───────────────────────────────────
async function generate() {
  const jobRole = document.getElementById('jobRole').value.trim();
  const jobDesc = document.getElementById('jobDesc').value.trim();
  const jobResp = document.getElementById('jobResp').value.trim();
  const existingResume = document.getElementById('existingResume').value.trim();
  const candidateName = document.getElementById('candidateName').value.trim();

  // Validation
  hideError();
  if (!jobRole) { showError('Please enter the target job role.'); return; }
  if (!jobDesc) { showError('Please paste the job description.'); return; }
  if (!existingResume && !state.fileText) {
    showError('Please provide your existing resume — paste it or upload a file.');
    return;
  }

  const resumeContent = existingResume || state.fileText;

  // UI: loading
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  showProgress(true);
  document.getElementById('resultView').style.display = 'none';
  document.getElementById('outputPlaceholder').style.display = 'none';

  const steps = [
    [12, 'Analyzing job description...'],
    [28, 'Extracting ATS keywords and requirements...'],
    [48, 'Tailoring your experience to the role...'],
    [68, 'Quantifying achievements and optimizing bullets...'],
    [84, 'Building ATS-safe document structure...'],
    [94, 'Generating your download file...'],
  ];

  let stepIdx = 0;
  const timer = setInterval(() => {
    if (stepIdx < steps.length) {
      setProgress(steps[stepIdx][0], steps[stepIdx][1]);
      stepIdx++;
    }
  }, 1100);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobRole,
        jobDescription: jobDesc,
        responsibilities: jobResp,
        existingResume: resumeContent,
        candidateName,
        docType: state.docType,
        outputFormat: state.outputFormat,
      }),
    });

    clearInterval(timer);
    setProgress(100, 'Done!');

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');

    state.generatedData = data.resume;
    state.filePayload = data.file;

    renderResult(data.resume);

  } catch (err) {
    clearInterval(timer);
    showProgress(false);
    document.getElementById('outputPlaceholder').style.display = '';
    showError('Generation failed: ' + err.message);
  }

  btn.disabled = false;
}

// ── Render Result ──────────────────────────────
function renderResult(d) {
  showProgress(false);

  // Meta
  document.getElementById('atsScoreBadge').textContent = `ATS Score: ${d.atsScore || 90}%`;
  document.getElementById('resultTitleText').textContent =
    state.docType === 'cv' ? 'ATS-Optimized CV' : 'ATS-Optimized Resume';

  // Keywords
  const ks = document.getElementById('keywordsStrip');
  ks.innerHTML = (d.keywordsMatched || []).map(k =>
    `<span class="keyword-tag">${esc(k)}</span>`
  ).join('');

  // Improvements
  const is = document.getElementById('improvementsStrip');
  is.innerHTML = (d.improvements || []).map(imp =>
    `<div class="improvement-item">${esc(imp)}</div>`
  ).join('');

  // Resume preview
  document.getElementById('resumePreview').innerHTML = buildPreviewHtml(d);

  document.getElementById('outputPlaceholder').style.display = 'none';
  document.getElementById('resultView').style.display = '';
}

function buildPreviewHtml(d) {
  const skills = d.coreCompetencies || [];
  const html = [];

  html.push(`<div class="rp-name">${esc(d.name || 'Your Name')}</div>`);
  if (d.contactLine) html.push(`<div class="rp-contact">${esc(d.contactLine)}</div>`);

  if (d.summary) {
    html.push(`<div class="rp-section">Professional Summary</div>`);
    html.push(`<p class="rp-body">${esc(d.summary)}</p>`);
  }

  if (skills.length) {
    html.push(`<div class="rp-section">Core Competencies</div>`);
    html.push(`<div class="rp-competencies">${skills.map(s => `<span class="rp-comp-tag">${esc(s)}</span>`).join('')}</div>`);
  }

  if ((d.experience || []).length) {
    html.push(`<div class="rp-section">Professional Experience</div>`);
    for (const exp of d.experience) {
      html.push(`<div class="rp-exp-block">
        <div class="rp-exp-header">
          <span class="rp-company">${esc(exp.company)}</span>
          <span class="rp-dates">${esc(exp.dates)}</span>
        </div>
        <div class="rp-title">${esc(exp.title)}${exp.location ? ` — ${esc(exp.location)}` : ''}</div>
        <ul class="rp-bullets">${(exp.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
      </div>`);
    }
  }

  if ((d.education || []).length) {
    html.push(`<div class="rp-section">Education</div>`);
    for (const ed of d.education) {
      const sub = [ed.institution, ed.year, ed.gpa ? `GPA: ${ed.gpa}` : '', ed.honors].filter(Boolean).join('  |  ');
      html.push(`<div class="rp-edu-block">
        <div class="rp-degree">${esc(ed.degree)}${ed.field ? ` in ${esc(ed.field)}` : ''}</div>
        <div class="rp-inst">${esc(sub)}</div>
      </div>`);
    }
  }

  if ((d.certifications || []).length) {
    html.push(`<div class="rp-section">Certifications</div>`);
    html.push(`<ul class="rp-bullets">${d.certifications.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`);
  }

  if ((d.additionalSkills || []).length) {
    html.push(`<div class="rp-section">Additional Skills</div>`);
    html.push(`<p class="rp-body">${d.additionalSkills.map(esc).join('  •  ')}</p>`);
  }

  return html.join('');
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Download ───────────────────────────────────
function downloadFile() {
  if (!state.filePayload) return;
  const { data, mimeType, filename } = state.filePayload;
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Copy Text ──────────────────────────────────
async function copyText() {
  const d = state.generatedData;
  if (!d) return;

  const lines = [];
  lines.push(d.name || '');
  lines.push(d.contactLine || '');
  lines.push('');
  lines.push('PROFESSIONAL SUMMARY');
  lines.push('─'.repeat(40));
  lines.push(d.summary || '');
  lines.push('');
  if ((d.coreCompetencies || []).length) {
    lines.push('CORE COMPETENCIES');
    lines.push('─'.repeat(40));
    lines.push(d.coreCompetencies.join('  •  '));
    lines.push('');
  }
  if ((d.experience || []).length) {
    lines.push('PROFESSIONAL EXPERIENCE');
    lines.push('─'.repeat(40));
    for (const exp of d.experience) {
      lines.push(`${exp.company}  |  ${exp.title}  |  ${exp.dates}`);
      if (exp.location) lines.push(exp.location);
      (exp.bullets || []).forEach(b => lines.push(`  • ${b}`));
      lines.push('');
    }
  }
  if ((d.education || []).length) {
    lines.push('EDUCATION');
    lines.push('─'.repeat(40));
    for (const ed of d.education) {
      lines.push(`${ed.degree}${ed.field ? ' in ' + ed.field : ''}`);
      lines.push([ed.institution, ed.year, ed.gpa ? `GPA: ${ed.gpa}` : ''].filter(Boolean).join('  |  '));
      lines.push('');
    }
  }
  if ((d.certifications || []).length) {
    lines.push('CERTIFICATIONS');
    lines.push('─'.repeat(40));
    d.certifications.forEach(c => lines.push(`• ${c}`));
  }

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    const btn = document.querySelector('.action-btn:not(.primary)');
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    btn.style.color = 'var(--success)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
  } catch {
    alert('Copy failed — please select and copy the preview manually.');
  }
}

// ── Progress UI ────────────────────────────────
function showProgress(show) {
  document.getElementById('progressWrap').style.display = show ? '' : 'none';
}

function setProgress(pct, label) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = label;
}

// ── Error UI ───────────────────────────────────
function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.style.display = '';
}

function hideError() {
  document.getElementById('errorBox').style.display = 'none';
}
