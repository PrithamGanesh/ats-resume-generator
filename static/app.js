const form = document.getElementById("generator-form");
const statusEl = document.getElementById("form-status");
const generateButton = document.getElementById("generate-button");
const emptyState = document.getElementById("empty-state");
const resultState = document.getElementById("result-state");
const atsScore = document.getElementById("ats-score");
const keywordList = document.getElementById("keyword-list");
const preview = document.getElementById("document-preview");
const downloadPdf = document.getElementById("download-pdf");
const downloadDocx = document.getElementById("download-docx");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Generating tailored document...";
  statusEl.classList.remove("error");
  generateButton.disabled = true;

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: new FormData(form),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to generate document.");
    }

    renderResults(payload);
    statusEl.textContent = "Preview updated. Download the PDF or DOCX when ready.";
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.classList.add("error");
  } finally {
    generateButton.disabled = false;
  }
});

function renderResults(payload) {
  emptyState.classList.add("hidden");
  resultState.classList.remove("hidden");

  atsScore.textContent = payload.analysis.ats_score;
  keywordList.innerHTML = "";
  payload.analysis.keywords.forEach((keyword) => {
    const chip = document.createElement("span");
    chip.className = "keyword-chip";
    chip.textContent = keyword;
    keywordList.appendChild(chip);
  });

  downloadPdf.href = payload.downloads.pdf;
  downloadDocx.href = payload.downloads.docx;

  preview.innerHTML = "";

  const name = document.createElement("h3");
  name.className = "preview-name";
  name.textContent = payload.preview.name;

  const headline = document.createElement("p");
  headline.className = "preview-headline";
  headline.textContent = payload.preview.headline;

  const contact = document.createElement("p");
  contact.className = "preview-contact";
  contact.textContent = payload.preview.contact_line || "Contact details extracted from source document";

  preview.append(name, headline, contact);

  payload.preview.sections.forEach((section) => {
    const wrapper = document.createElement("section");
    wrapper.className = "preview-section";

    const title = document.createElement("h3");
    title.textContent = section.title;
    wrapper.appendChild(title);

    if (section.kind === "bullets") {
      const list = document.createElement("ul");
      section.lines.forEach((line) => {
        const item = document.createElement("li");
        item.textContent = line;
        list.appendChild(item);
      });
      wrapper.appendChild(list);
    } else {
      section.lines.forEach((line) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        wrapper.appendChild(paragraph);
      });
    }

    preview.appendChild(wrapper);
  });
}
