"""
resume_parser.py
Extracts plain text from uploaded resume files (PDF, DOCX, TXT).
"""

import io


def parse_uploaded_file(file_storage) -> str:
    filename = file_storage.filename.lower()
    data     = file_storage.read()

    if filename.endswith(".txt"):
        return _parse_txt(data)
    elif filename.endswith(".pdf"):
        return _parse_pdf(data)
    elif filename.endswith(".docx"):
        return _parse_docx(data)
    elif filename.endswith(".doc"):
        return "[DOC format detected. Please convert to DOCX or paste your resume text manually.]"
    else:
        raise ValueError(f"Unsupported file type: {filename}")


def _parse_txt(data: bytes) -> str:
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _parse_pdf(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    pages  = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def _parse_docx(data: bytes) -> str:
    from docx import Document
    doc   = Document(io.BytesIO(data))
    lines = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(lines)
