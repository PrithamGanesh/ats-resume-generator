'use strict';

// ── State ──────────────────────────────────────
const S = {
  docType:     'resume',
  format:      'pdf',
  fileText:    '',
  result:      null,
  filePayload: null,
};

// ── Boot ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupCounters();
  setupUpload();
});

// ── Char counters ──────────────────────────────
function setupCounters() {
  [['jobDesc','jdHint'],['existingResume','rcHint']].forEach(([id, hid]) => {
    const el = document.getElementById(id);
    const ht = document.getElementById(hid);
    if (el && ht) el.addEventListener('input', () => {
      ht.textContent = `${el.value.length.toLocaleString()} characters`;
    });
  });
}

// ── Upload ─────────────────────────────────────
function setupUpload() {
  const zone  = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) await uploadFile(f);
  });
  input.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (f) await uploadFile(f);
  });
}

async function uploadFile(file) {
  if (file.size > 5 * 1024 * 1024) { showError('File too large. Max 5 MB.'); return; }

  const idle = document.getElementById('uploadIdle');
  const done = document.getElementById('uploadDone');
  const name = document.getElementById('uploadName');

  idle.style.opacity = '0.4';
  done.style.display = 'flex';
  name.textContent   = 'Uploading…';

  const fd = new FormData();
  fd.append('resume', file);

  try {
    const res  = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    S.fileText       = data.text || '';
    idle.style.display = 'none';
    done.style.display = 'flex';
    name.textContent   = data.filename;

    // Auto-populate textarea if empty
    const ta = document.getElementById('existingResume');
    if (!ta.value.trim() && S.fileText.length > 30) {
      ta.value = S.fileText;
      document.getElementById('rcHint').textContent =
        `${ta.value.length.toLocaleString()} characters`;
    }
  } catch (err) {
    idle.style.opacity = '1';
    done.style.display = 'none';
    showError('Upload error: ' + err.message);
  }
}

function removeFile() {
  S.fileText = '';
  const idle = document.getElementById('uploadIdle');
  idle.style.display   = '';
  idle.style.opacity   = '1';
  document.getElementById('uploadDone').style.display = 'none';
  document.getElementById('fileInput').value = '';
}

// ── Toggles ────────────────────────────────────
function setToggle(key, value, btn) {
  S[key] = value;
  const gid = key === 'docType' ? 'docTypeToggle' : 'fmtToggle';
  document.querySelectorAll(`#${gid} .tbtn`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Generate ───────────────────────────────────
async function generate() {
  const jobRole  = document.getElementById('jobRole').value.trim();
  const jobDesc  = document.getElementById('jobDesc').value.trim();
  const jobResp  = document.getElementById('jobResp').value.trim();
  const existing = document.getElementById('existingResume').value.trim();
  const name     = document.getElementById('candidateName').value.trim();

  hideError();
  if (!jobRole)                { showError('Please enter the target job role.'); return; }
  if (!jobDesc)                { showError('Please paste the job description.'); return; }
  if (!existing && !S.fileText){ showError('Please paste your resume text or upload a file.'); return; }

  const btn = document.getElementById('genBtn');
  btn.disabled = true;
  showProgress(true);
  document.getElementById('outputResult').style.display = 'none';
  document.getElementById('outputEmpty').style.display  = 'none';

  // Progress steps (rule-based is fast, so steps are quick)
  const steps = [
    [15, 'Extracting keywords from job description...'],
    [32, 'Parsing resume sections and structure...'],
    [52, 'Running keyword gap analysis...'],
    [70, 'Strengthening bullet points...'],
    [85, 'Assembling ATS-safe document...'],
    [95, 'Generating your file...'],
  ];
  let si = 0;
  const timer = setInterval(() => {
    if (si < steps.length) { setProgress(steps[si][0], steps[si][1]); si++; }
  }, 400);

  try {
    const res  = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobRole,
        jobDescription:   jobDesc,
        responsibilities: jobResp,
        existingResume:   existing || S.fileText,
        candidateName:    name,
        docType:          S.docType,
        outputFormat:     S.format,
      }),
    });

    clearInterval(timer);
    setProgress(100, 'Done!');
    await delay(300);

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');

    S.result      = data.resume;
    S.filePayload = data.file;
    renderResult(data.resume);

  } catch (err) {
    clearInterval(timer);
    showProgress(false);
    document.getElementById('outputEmpty').style.display = '';
    showError('Error: ' + err.message);
  }

  btn.disabled = false;
}

// ── Render ─────────────────────────────────────
function renderResult(d) {
  showProgress(false);

  // Animate score ring
  const score = d.atsScore || 0;
  animateScore(score);

  // Score sub-label
  const sub = score >= 85 ? 'Excellent — highly ATS compatible'
            : score >= 70 ? 'Good — likely to pass most ATS filters'
            : score >= 55 ? 'Fair — consider adding missing keywords'
            : 'Needs work — add more matching keywords';
  document.getElementById('scoreSub').textContent = sub;

  // Keyword panels
  const matched = document.getElementById('kwMatched');
  const missing = document.getElementById('kwMissing');
  matched.innerHTML = (d.keywordsMatched || [])
    .map(k => `<span class="kw-tag matched-tag">${esc(k)}</span>`).join('');
  missing.innerHTML = (d.keywordsMissing || [])
    .map(k => `<span class="kw-tag missing-tag">${esc(k)}</span>`).join('');

  // Improvements
  const imp = document.getElementById('improvements');
  imp.innerHTML = (d.improvements || []).map(i => {
    const isWarn = i.toLowerCase().includes('not found') || i.toLowerCase().includes('consider');
    return `<div class="imp-item${isWarn ? ' warn' : ''}">${esc(i)}</div>`;
  }).join('');

  // Preview
  document.getElementById('resumePreview').innerHTML = buildPreview(d);

  document.getElementById('outputEmpty').style.display  = 'none';
  document.getElementById('outputResult').style.display = '';
}

function animateScore(target) {
  const numEl = document.getElementById('scoreNum');
  const arc   = document.getElementById('scoreArc');
  let current = 0;
  const step  = Math.ceil(target / 40);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    numEl.textContent = current;
    // stroke-dashoffset: 100 = empty, 0 = full
    arc.style.strokeDashoffset = 100 - current;
    if (current >= target) clearInterval(timer);
  }, 25);
}

function buildPreview(d) {
  const h = [];
  h.push(`<div class="rp-name">${esc(d.name || 'Your Name')}</div>`);
  if (d.contactLine)
    h.push(`<div class="rp-contact">${esc(d.contactLine)}</div>`);

  if (d.summary) {
    h.push(`<div class="rp-sec">Professional Summary</div>`);
    h.push(`<p class="rp-body">${esc(d.summary)}</p>`);
  }

  if ((d.coreCompetencies || []).length) {
    h.push(`<div class="rp-sec">Core Competencies</div>`);
    h.push(`<div class="rp-comps">${
      d.coreCompetencies.map(c => `<span class="rp-comp">${esc(c)}</span>`).join('')
    }</div>`);
  }

  if ((d.experience || []).length) {
    h.push(`<div class="rp-sec">Professional Experience</div>`);
    for (const e of d.experience) {
      h.push(`<div class="rp-exp">
        <div class="rp-co-row">
          <span class="rp-co">${esc(e.company)}</span>
          <span class="rp-dt">${esc(e.dates)}</span>
        </div>
        <div class="rp-ttl">${esc(e.title)}${e.location ? ` — ${esc(e.location)}` : ''}</div>
        <ul class="rp-buls">${(e.bullets||[]).map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      </div>`);
    }
  }

  if ((d.projects || []).length) {
    h.push(`<div class="rp-sec">Key Projects</div>`);
    for (const p of d.projects) {
      h.push(`<div class="rp-exp">
        <div class="rp-co">${esc(p.name)}</div>
        <ul class="rp-buls">${(p.bullets||[]).map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      </div>`);
    }
  }

  if ((d.education || []).length) {
    h.push(`<div class="rp-sec">Education</div>`);
    for (const e of d.education) {
      const sub = [e.institution, e.year, e.gpa?`GPA: ${e.gpa}`:'', e.honors]
        .filter(Boolean).join('  |  ');
      h.push(`<div class="rp-edu">
        <div class="rp-deg">${esc(e.degree)}${e.field?` in ${esc(e.field)}`:''}</div>
        <div class="rp-inst">${esc(sub)}</div>
      </div>`);
    }
  }

  if ((d.certifications||[]).filter(Boolean).length) {
    h.push(`<div class="rp-sec">Certifications</div>`);
    h.push(`<ul class="rp-buls">${
      d.certifications.map(c=>`<li>${esc(c)}</li>`).join('')
    }</ul>`);
  }

  if ((d.additionalSkills||[]).length) {
    h.push(`<div class="rp-sec">Additional Skills</div>`);
    h.push(`<p class="rp-body">${d.additionalSkills.map(esc).join('  •  ')}</p>`);
  }

  return h.join('');
}

// ── Download ───────────────────────────────────
function downloadFile() {
  if (!S.filePayload) return;
  const { data, mimeType, filename } = S.filePayload;
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const blob  = new Blob([bytes], { type: mimeType });
  const url   = URL.createObjectURL(blob);
  const a     = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ── Copy ───────────────────────────────────────
async function copyText() {
  const d = S.result;
  if (!d) return;
  const lines = [
    d.name || '', d.contactLine || '', '',
    'PROFESSIONAL SUMMARY', '─'.repeat(40), d.summary || '', '',
  ];
  if ((d.coreCompetencies||[]).length)
    lines.push('CORE COMPETENCIES','─'.repeat(40), d.coreCompetencies.join('  •  '),'');
  if ((d.experience||[]).length) {
    lines.push('PROFESSIONAL EXPERIENCE','─'.repeat(40));
    d.experience.forEach(e => {
      lines.push(`${e.company}  |  ${e.title}  |  ${e.dates}`);
      (e.bullets||[]).forEach(b => lines.push(`  • ${b}`));
      lines.push('');
    });
  }
  if ((d.education||[]).length) {
    lines.push('EDUCATION','─'.repeat(40));
    d.education.forEach(e =>
      lines.push(`${e.degree}${e.field?' in '+e.field:''} — ${e.institution} (${e.year})`)
    );
    lines.push('');
  }
  if ((d.certifications||[]).filter(Boolean).length)
    lines.push('CERTIFICATIONS','─'.repeat(40), ...d.certifications.map(c=>`• ${c}`),'');

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    const btn = document.querySelector('.btn-act:not(.primary)');
    const orig = btn.innerHTML;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    btn.style.color = 'var(--success)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2200);
  } catch { alert('Copy failed — please select text manually.'); }
}

// ── Helpers ────────────────────────────────────
function showProgress(show) {
  document.getElementById('progressArea').style.display = show ? '' : 'none';
}
function setProgress(pct, label) {
  document.getElementById('progressFill').style.width = pct + '%';
  const lbl = document.getElementById('progressText');
  if (lbl) lbl.textContent = label;
}
function showError(msg) {
  const b = document.getElementById('errorBar');
  b.textContent  = msg;
  b.style.display = '';
}
function hideError() {
  document.getElementById('errorBar').style.display = 'none';
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
