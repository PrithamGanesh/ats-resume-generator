"""
app.py — Flask API
Routes:
  GET  /api/health      — status check
  POST /api/upload      — parse uploaded resume file
  POST /api/generate    — run rule-based ATS engine, return JSON + file
"""

import io
import base64
import traceback

from flask import Flask, request, jsonify
from flask_cors import CORS

from ats_engine import parse_job, parse_resume, match_and_score, build_resume
from resume_parser import parse_uploaded_file
from pdf_builder import build_pdf
from docx_builder import build_docx

import re

app = Flask(__name__)
CORS(app)


# ── Health ────────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "engine": "rule-based", "version": "1.0.0"})


# ── Upload ────────────────────────────────────────────────────────────────────
@app.route("/api/upload", methods=["POST"])
def upload():
    if "resume" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["resume"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    fname = file.filename.lower()
    if not any(fname.endswith(ext) for ext in [".pdf", ".docx", ".doc", ".txt"]):
        return jsonify({"error": "Unsupported file type. Use PDF, DOCX, or TXT."}), 400

    try:
        text = parse_uploaded_file(file)
        if not text or len(text.strip()) < 20:
            return jsonify({
                "error": "Could not extract readable text. Please paste your resume manually."
            }), 422
        return jsonify({"text": text.strip(), "filename": file.filename})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Parse error: {str(e)}"}), 500


# ── Generate ──────────────────────────────────────────────────────────────────
@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.get_json(force=True)

    job_role        = (data.get("jobRole")        or "").strip()
    job_description = (data.get("jobDescription") or "").strip()
    responsibilities = (data.get("responsibilities") or "").strip()
    existing_resume = (data.get("existingResume") or "").strip()
    candidate_name  = (data.get("candidateName")  or "").strip()
    doc_type        = data.get("docType",       "resume")
    output_format   = data.get("outputFormat",  "pdf")

    if not job_role:
        return jsonify({"error": "jobRole is required"}), 400
    if not job_description:
        return jsonify({"error": "jobDescription is required"}), 400
    if not existing_resume:
        return jsonify({"error": "existingResume is required"}), 400

    try:
        # ── 1. Parse job description ──────────────────────────────────────
        job = parse_job(job_role, job_description, responsibilities)

        # ── 2. Parse existing resume ──────────────────────────────────────
        resume = parse_resume(existing_resume)

        # ── 3. Match & score ──────────────────────────────────────────────
        match = match_and_score(job, resume)

        # ── 4. Build optimised resume dict ────────────────────────────────
        result = build_resume(job, resume, match, candidate_name, doc_type)

        # ── 5. Generate file ──────────────────────────────────────────────
        safe_name = re.sub(r"\s+", "_", result.get("name", "resume"))
        doc_label = "CV" if doc_type == "cv" else "Resume"

        if output_format == "docx":
            buf      = build_docx(result, doc_type)
            mime     = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = f"{safe_name}_ATS_{doc_label}.docx"
        else:
            buf      = build_pdf(result, doc_type)
            mime     = "application/pdf"
            filename = f"{safe_name}_ATS_{doc_label}.pdf"

        encoded = base64.b64encode(buf.getvalue()).decode()

        return jsonify({
            "resume": result,
            "file":   {"data": encoded, "mimeType": mime, "filename": filename},
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Engine error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
