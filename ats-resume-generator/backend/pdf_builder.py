"""
pdf_builder.py
Builds an ATS-safe, single-column PDF using ReportLab.
No tables, no columns, no images — pure text flow.
"""

import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable
)

DARK  = HexColor("#1a1a2e")
GOLD  = HexColor("#c49a1a")
GRAY  = HexColor("#444444")
LGRAY = HexColor("#888888")
PAGE_W, PAGE_H = A4
LM = RM = 18 * mm
TM = BM = 14 * mm


def build_pdf(data: dict, doc_type: str = "resume") -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=LM, rightMargin=RM,
        topMargin=TM, bottomMargin=BM,
        title=f"{data.get('name','Resume')} — ATS {'CV' if doc_type=='cv' else 'Resume'}",
        author="ATS Resume Generator",
    )
    styles = _styles()
    story  = _build_story(data, styles, doc_type)
    doc.build(story)
    buf.seek(0)
    return buf


def _styles():
    def S(name, **kw):
        return ParagraphStyle(name, **kw)
    return {
        "name":     S("Name",    fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=DARK, spaceAfter=2),
        "contact":  S("Contact", fontName="Helvetica",      fontSize=9,  leading=12, textColor=GRAY, spaceAfter=5),
        "section":  S("Section", fontName="Helvetica-Bold", fontSize=8.5, leading=10, textColor=DARK,
                       spaceBefore=10, spaceAfter=3, tracking=1.5),
        "body":     S("Body",    fontName="Helvetica",      fontSize=10, leading=14, textColor=DARK,
                       spaceAfter=4, alignment=TA_JUSTIFY),
        "company":  S("Company", fontName="Helvetica-Bold", fontSize=11, leading=13, textColor=DARK,
                       spaceBefore=8, spaceAfter=1),
        "role":     S("Role",    fontName="Helvetica-Oblique", fontSize=9.5, leading=12, textColor=GRAY, spaceAfter=3),
        "bullet":   S("Bullet",  fontName="Helvetica",      fontSize=9.5, leading=13, textColor=HexColor("#222222"),
                       leftIndent=10, spaceAfter=2),
        "skills":   S("Skills",  fontName="Helvetica",      fontSize=9.5, leading=13, textColor=DARK, spaceAfter=3),
        "edu_deg":  S("EduDeg",  fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=DARK,
                       spaceBefore=6, spaceAfter=1),
        "edu_sub":  S("EduSub",  fontName="Helvetica",      fontSize=9,   leading=12, textColor=LGRAY, spaceAfter=4),
        "small":    S("Small",   fontName="Helvetica",      fontSize=9,   leading=11, textColor=LGRAY, spaceAfter=2),
    }


def _hr():
    return HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=4, spaceBefore=2)


def _section(title, styles):
    return [Paragraph(title.upper(), styles["section"]), _hr()]


def _build_story(data, styles, doc_type):
    story = []

    # Name
    story.append(Paragraph(data.get("name", "Your Name"), styles["name"]))

    # Contact
    contact = data.get("contactLine", "")
    if contact:
        story.append(Paragraph(contact, styles["contact"]))
        story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=6))

    # Summary
    if data.get("summary"):
        story.extend(_section("Professional Summary", styles))
        story.append(Paragraph(data["summary"], styles["body"]))

    # Core Competencies
    comps = data.get("coreCompetencies", [])
    if comps:
        story.extend(_section("Core Competencies", styles))
        for i in range(0, len(comps), 3):
            row = "    •    ".join(comps[i:i+3])
            story.append(Paragraph(row, styles["skills"]))

    # Experience
    experience = data.get("experience", [])
    if experience:
        story.extend(_section("Professional Experience", styles))
        for exp in experience:
            company = exp.get("company", "")
            title   = exp.get("title", "")
            loc     = exp.get("location", "")
            dates   = exp.get("dates", "")
            bullets = exp.get("bullets", [])

            co_line = f'<b>{_esc(company)}</b>&nbsp;&nbsp;&nbsp;&nbsp;<font size="8.5" color="#888888">{_esc(dates)}</font>'
            story.append(Paragraph(co_line, styles["company"]))

            role_line = _esc(title)
            if loc:
                role_line += f'  —  <font color="#999999">{_esc(loc)}</font>'
            story.append(Paragraph(role_line, styles["role"]))

            for b in bullets:
                story.append(Paragraph(f"▸  {_esc(b)}", styles["bullet"]))

    # Education
    education = data.get("education", [])
    if education:
        story.extend(_section("Education", styles))
        for ed in education:
            degree = ed.get("degree", "")
            field  = ed.get("field", "")
            label  = f"{degree}{' in ' + field if field else ''}"
            story.append(Paragraph(f"<b>{_esc(label)}</b>", styles["edu_deg"]))
            parts = [ed.get("institution",""), ed.get("year","")]
            if ed.get("gpa"):    parts.append(f"GPA: {ed['gpa']}")
            if ed.get("honors"): parts.append(ed["honors"])
            story.append(Paragraph("  |  ".join(p for p in parts if p), styles["edu_sub"]))

    # Certifications
    certs = [c for c in data.get("certifications", []) if c]
    if certs:
        story.extend(_section("Certifications", styles))
        for c in certs:
            story.append(Paragraph(f"▸  {_esc(c)}", styles["bullet"]))

    # Projects (CV only)
    projects = data.get("projects", [])
    if doc_type == "cv" and projects:
        story.extend(_section("Key Projects", styles))
        for proj in projects:
            story.append(Paragraph(f"<b>{_esc(proj.get('name',''))}</b>", styles["company"]))
            for b in proj.get("bullets", []):
                story.append(Paragraph(f"▸  {_esc(b)}", styles["bullet"]))

    # Additional Skills
    add_skills = data.get("additionalSkills", [])
    if add_skills:
        story.extend(_section("Additional Skills", styles))
        story.append(Paragraph("  •  ".join(add_skills), styles["skills"]))

    return story


def _esc(s: str) -> str:
    return (str(s or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;"))
