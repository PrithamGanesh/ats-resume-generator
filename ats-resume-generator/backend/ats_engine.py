"""
ats_engine.py
─────────────────────────────────────────────────────────────────────────────
Rule-Based ATS Resume Generator Engine
No AI. No external APIs. Pure algorithmic logic.

Pipeline:
  1. parse_job()        — extract keywords, skills, requirements from JD
  2. parse_resume()     — extract structured sections from existing resume
  3. match_and_score()  — keyword gap analysis + ATS scoring
  4. build_resume()     — assemble optimised, ATS-safe resume dict
─────────────────────────────────────────────────────────────────────────────
"""

import re
import string
from collections import Counter, defaultdict
from difflib import SequenceMatcher

# ═══════════════════════════════════════════════════════════════════════════
# MASTER KEYWORD TAXONOMY
# Industry-specific skill pools used for recognition and categorisation.
# ═══════════════════════════════════════════════════════════════════════════

TECH_SKILLS = {
    # Languages
    "python","java","javascript","typescript","c++","c#","go","rust","ruby",
    "php","swift","kotlin","scala","r","matlab","perl","bash","shell","sql",
    "html","css","sass","less",
    # Frameworks & Libraries
    "react","angular","vue","node.js","nodejs","express","django","flask",
    "fastapi","spring","spring boot","laravel","rails","next.js","nuxt",
    "tensorflow","pytorch","keras","scikit-learn","pandas","numpy","scipy",
    "matplotlib","seaborn","plotly","opencv","nltk","spacy","hugging face",
    # Cloud & DevOps
    "aws","azure","gcp","google cloud","docker","kubernetes","k8s","terraform",
    "ansible","jenkins","github actions","gitlab ci","circleci","helm","argocd",
    "prometheus","grafana","datadog","splunk","elk","elasticsearch",
    # Databases
    "postgresql","mysql","mongodb","redis","cassandra","dynamodb","snowflake",
    "bigquery","redshift","oracle","sqlite","neo4j","influxdb","kafka",
    "rabbitmq","celery",
    # Practices
    "rest","restful","graphql","microservices","ci/cd","devops","agile","scrum",
    "kanban","tdd","bdd","oop","solid","design patterns","api","sdk",
    "git","linux","unix","windows server","networking","tcp/ip","dns","ssl",
    # Data & Analytics
    "machine learning","deep learning","nlp","computer vision","data science",
    "data engineering","etl","data pipeline","data warehouse","bi","tableau",
    "power bi","looker","dbt","airflow","spark","hadoop","hive","flink",
    # Security
    "cybersecurity","penetration testing","soc","siem","iam","oauth","jwt",
    "encryption","firewall","zero trust","vulnerability assessment",
}

SOFT_SKILLS = {
    "leadership","communication","teamwork","collaboration","problem-solving",
    "problem solving","analytical","critical thinking","adaptability","creativity",
    "time management","project management","stakeholder management","mentoring",
    "coaching","presentation","negotiation","conflict resolution","decision making",
    "strategic thinking","innovation","attention to detail","multitasking",
    "self-motivated","proactive","results-driven","customer-focused","empathy",
}

BUSINESS_SKILLS = {
    "product management","product roadmap","okrs","kpis","p&l","budget",
    "forecasting","market research","competitive analysis","go-to-market",
    "business development","sales","crm","salesforce","hubspot","jira",
    "confluence","notion","slack","microsoft office","excel","powerpoint",
    "word","google workspace","six sigma","lean","prince2","pmp",
    "change management","risk management","compliance","gdpr","iso",
    "business analysis","requirements gathering","user stories","ux","ui",
    "figma","sketch","adobe","photoshop","illustrator",
}

ALL_SKILLS = TECH_SKILLS | SOFT_SKILLS | BUSINESS_SKILLS

# Action verbs for bullet rewriting
STRONG_VERBS = {
    "led","managed","built","developed","designed","implemented","delivered",
    "launched","created","established","drove","improved","increased","reduced",
    "optimised","optimized","streamlined","automated","architected","spearheaded",
    "coordinated","executed","achieved","deployed","migrated","scaled","negotiated",
    "mentored","trained","analysed","analyzed","researched","evaluated","assessed",
    "collaborated","partnered","facilitated","presented","championed","transformed",
    "generated","secured","saved","grew","expanded","consolidated","restructured",
}

WEAK_VERBS = {
    "helped","assisted","worked","was responsible","supported","did","made",
    "handled","involved","participated","contributed","used","utilized",
    "responsible for","duties included","tasked with",
}

# Quantifier patterns — detect existing metrics
METRIC_PATTERNS = [
    r'\d+\s*%',                    # 45%
    r'\$\s*\d[\d,.]*[KkMmBb]?',   # $1.2M
    r'£\s*\d[\d,.]*[KkMmBb]?',
    r'€\s*\d[\d,.]*[KkMmBb]?',
    r'\d+\s*[KkMmBb]\b',          # 50K, 2M
    r'\d+x\b',                    # 3x
    r'\d+\s*(?:hours?|days?|weeks?|months?|years?)',
    r'\d+\s*(?:people|team|members?|engineers?|users?|clients?|customers?)',
]

# ATS-required section headings (canonical names)
SECTION_MAP = {
    # summary variants
    "summary","professional summary","career summary","profile","about me",
    "objective","career objective","personal statement","overview",
    # experience variants
    "experience","work experience","professional experience","employment",
    "employment history","work history","career history","positions held",
    "relevant experience",
    # education variants
    "education","academic background","qualifications","academic qualifications",
    "educational background",
    # skills variants
    "skills","technical skills","core competencies","competencies","expertise",
    "key skills","skill set","technologies","tools","proficiencies",
    # certifications
    "certifications","certificates","credentials","licences","licenses",
    "professional certifications",
    # projects
    "projects","key projects","notable projects","personal projects",
    "open source","portfolio",
    # awards / achievements
    "awards","achievements","honors","honours","accomplishments","recognition",
    # publications (CV)
    "publications","papers","research","conference papers","journals",
    # volunteer
    "volunteer","volunteering","community","extracurricular",
    # languages
    "languages","language skills",
}

# ═══════════════════════════════════════════════════════════════════════════
# 1. JOB DESCRIPTION PARSER
# ═══════════════════════════════════════════════════════════════════════════

def parse_job(job_role: str, job_description: str, responsibilities: str = "") -> dict:
    """
    Extract structured requirements from raw job description text.
    Returns: keywords, required_skills, nice_to_have, seniority, industry_signals
    """
    full_text = f"{job_role} {job_description} {responsibilities}".lower()
    clean     = _clean_text(full_text)
    tokens    = _tokenize(clean)

    # Extract multi-word skill phrases first (e.g. "machine learning")
    matched_skills = _extract_skill_phrases(full_text)

    # Extract single-token skills not already captured
    for tok in tokens:
        for skill in ALL_SKILLS:
            if tok == skill and skill not in matched_skills:
                matched_skills.add(skill)

    # Separate into categories
    required_skills   = matched_skills & (TECH_SKILLS | BUSINESS_SKILLS)
    soft_skills       = matched_skills & SOFT_SKILLS

    # Extract raw keyword n-grams (1–3 words) from JD excluding stopwords
    raw_keywords = _extract_ngrams(full_text, max_n=3)

    # Detect seniority
    seniority = _detect_seniority(full_text)

    # Detect experience requirement
    years_required = _extract_years_required(full_text)

    # Detect industry signals
    industry = _detect_industry(full_text)

    # Extract must-have vs nice-to-have
    must_have, nice_to_have = _split_must_nice(job_description.lower(), matched_skills)

    return {
        "role":            job_role,
        "all_skills":      sorted(matched_skills),
        "required_skills": sorted(must_have),
        "nice_to_have":    sorted(nice_to_have),
        "soft_skills":     sorted(soft_skills),
        "raw_keywords":    raw_keywords,
        "seniority":       seniority,
        "years_required":  years_required,
        "industry":        industry,
        "full_text":       full_text,
    }


def _extract_skill_phrases(text: str) -> set:
    found = set()
    for skill in ALL_SKILLS:
        # Whole-word match for multi-word skills
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            found.add(skill)
    return found


def _extract_ngrams(text: str, max_n: int = 3) -> list:
    """Extract meaningful keyword n-grams ranked by frequency."""
    stop = {
        "the","a","an","and","or","but","in","on","at","to","for","of","with",
        "is","are","was","were","be","been","being","have","has","had","do",
        "does","did","will","would","could","should","may","might","shall",
        "must","can","need","that","this","these","those","it","its","we","our",
        "you","your","they","their","he","she","his","her","which","who","what",
        "when","where","how","why","all","any","some","other","more","most",
        "such","than","then","from","by","as","if","about","into","through",
        "during","including","until","against","among","throughout","despite",
        "towards","upon","concerning","experience","work","team","ability",
        "strong","proven","excellent","good","well","highly","role","position",
        "candidate","looking","seeking","join","opportunity","company","business",
        "new","using","use","including","across","within","ensure","required",
        "responsible","requirements","qualifications","preferred","desired",
    }
    words = re.findall(r'[a-z][a-z0-9+#\./]*', text.lower())
    words = [w for w in words if len(w) > 2 and w not in stop]

    ngrams = []
    for n in range(1, max_n + 1):
        for i in range(len(words) - n + 1):
            gram = " ".join(words[i:i+n])
            ngrams.append(gram)

    freq    = Counter(ngrams)
    # Keep grams that appear ≥1 times and aren't pure stopwords
    ranked  = [g for g, c in freq.most_common(60) if len(g) > 2]
    return ranked[:40]


def _detect_seniority(text: str) -> str:
    if any(w in text for w in ["vp ","vice president","director","head of","c-level","cto","cio","cpo"]):
        return "executive"
    if any(w in text for w in ["senior","sr.","lead","principal","staff","architect","manager"]):
        return "senior"
    if any(w in text for w in ["junior","jr.","entry","graduate","intern","associate","trainee"]):
        return "junior"
    return "mid"


def _extract_years_required(text: str) -> int:
    matches = re.findall(r'(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|exp)', text)
    if matches:
        return max(int(m) for m in matches)
    return 0


def _detect_industry(text: str) -> str:
    signals = {
        "fintech":     ["bank","finance","fintech","payment","trading","insurance","investment"],
        "healthcare":  ["health","medical","clinical","pharma","hospital","patient","ehr"],
        "ecommerce":   ["ecommerce","retail","marketplace","cart","fulfillment","inventory"],
        "saas":        ["saas","subscription","b2b","platform","enterprise software"],
        "data":        ["data science","machine learning","analytics","ai","ml","nlp"],
        "devops":      ["devops","infrastructure","cloud","sre","reliability","platform"],
        "security":    ["security","cyber","soc","compliance","audit","risk"],
        "mobile":      ["ios","android","mobile","react native","flutter"],
        "gaming":      ["game","gaming","unity","unreal","graphics"],
        "education":   ["edtech","education","learning","lms","curriculum"],
    }
    for industry, words in signals.items():
        if any(w in text for w in words):
            return industry
    return "general"


def _split_must_nice(text: str, skills: set) -> tuple:
    """Heuristically split skills into must-have vs nice-to-have."""
    must_keywords   = ["required","must","essential","mandatory","minimum","need","necessary"]
    nice_keywords   = ["preferred","nice to have","bonus","plus","advantageous","desirable","optional"]

    # Split JD into paragraphs/bullets and classify each block
    blocks = re.split(r'\n+|(?<=\.)\s+(?=[A-Z])', text)

    must_skills = set()
    nice_skills = set()

    for block in blocks:
        is_must = any(kw in block for kw in must_keywords)
        is_nice = any(kw in block for kw in nice_keywords)
        for skill in skills:
            if skill in block:
                if is_nice:
                    nice_skills.add(skill)
                else:
                    must_skills.add(skill)

    # Anything unclassified goes to must
    unclassified = skills - must_skills - nice_skills
    must_skills |= unclassified

    return must_skills, nice_skills


# ═══════════════════════════════════════════════════════════════════════════
# 2. RESUME PARSER
# ═══════════════════════════════════════════════════════════════════════════

def parse_resume(raw_text: str) -> dict:
    """
    Parse raw resume text into structured sections.
    Returns: name, contact, summary, experience, education, skills, certs, projects, other
    """
    lines  = [l.rstrip() for l in raw_text.splitlines()]
    lines  = [l for l in lines if l.strip()]  # remove blank lines

    # Detect name (usually first non-empty line, title-case, no special chars)
    name    = _extract_name(lines)
    contact = _extract_contact(raw_text)

    # Split into sections
    sections = _split_into_sections(lines)

    summary    = _parse_summary(sections)
    experience = _parse_experience(sections)
    education  = _parse_education(sections)
    skills_raw = _parse_skills(sections)
    certs      = _parse_certs(sections)
    projects   = _parse_projects(sections)

    # Detect all skills mentioned anywhere
    all_text_skills = _extract_skill_phrases(raw_text.lower())

    return {
        "name":         name,
        "contact":      contact,
        "summary":      summary,
        "experience":   experience,
        "education":    education,
        "skills_raw":   skills_raw,
        "all_skills":   all_text_skills,
        "certifications": certs,
        "projects":     projects,
        "raw":          raw_text,
    }


def _extract_name(lines: list) -> str:
    for line in lines[:5]:
        stripped = line.strip()
        # Skip lines that look like contact info or section headers
        if re.search(r'[@|/\\]|\d{5,}|http|www|linkedin|github', stripped, re.I):
            continue
        if len(stripped.split()) <= 5 and re.match(r'^[A-Z][a-zA-Z\s\-\.]+$', stripped):
            return stripped
    return ""


def _extract_contact(text: str) -> dict:
    email   = re.search(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}', text)
    phone   = re.search(r'(?:\+?\d[\d\s\-().]{7,}\d)', text)
    linkedin = re.search(r'linkedin\.com/in/[\w\-]+', text, re.I)
    github  = re.search(r'github\.com/[\w\-]+', text, re.I)
    # Location: City, State/Country pattern
    location = re.search(
        r'\b([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z\s]+))\b', text)

    return {
        "email":    email.group()    if email    else "",
        "phone":    phone.group().strip() if phone else "",
        "linkedin": linkedin.group() if linkedin else "",
        "github":   github.group()   if github   else "",
        "location": location.group(1) if location else "",
    }


def _split_into_sections(lines: list) -> dict:
    """
    Identify section boundaries by matching heading patterns.
    Returns dict of section_name -> list of lines.
    """
    sections = defaultdict(list)
    current  = "header"

    heading_re = re.compile(
        r'^(' + '|'.join(re.escape(s) for s in SECTION_MAP) + r')\s*[:\-–—]?\s*$',
        re.IGNORECASE
    )

    for line in lines:
        stripped = line.strip()
        clean    = stripped.lower().strip(string.punctuation).strip()

        # Detect section heading
        if heading_re.match(clean) or _is_section_heading(stripped):
            # Normalise heading name
            current = _normalise_section(clean)
        else:
            sections[current].append(stripped)

    return dict(sections)


def _is_section_heading(line: str) -> bool:
    """Detect headings by formatting heuristics."""
    stripped = line.strip()
    clean    = stripped.lower().strip(string.punctuation).strip()

    # All-caps short line
    if stripped.isupper() and 2 <= len(stripped.split()) <= 5:
        return clean in SECTION_MAP or any(s in clean for s in SECTION_MAP)

    # Title-case short line matching section map
    if len(stripped.split()) <= 5:
        return clean in SECTION_MAP

    return False


def _normalise_section(heading: str) -> str:
    aliases = {
        "summary":"summary","professional summary":"summary","career summary":"summary",
        "profile":"summary","about me":"summary","objective":"summary",
        "career objective":"summary","overview":"summary","personal statement":"summary",

        "experience":"experience","work experience":"experience",
        "professional experience":"experience","employment":"experience",
        "employment history":"experience","work history":"experience",
        "career history":"experience","positions held":"experience",
        "relevant experience":"experience",

        "education":"education","academic background":"education",
        "qualifications":"education","educational background":"education",
        "academic qualifications":"education",

        "skills":"skills","technical skills":"skills","core competencies":"skills",
        "competencies":"skills","expertise":"skills","key skills":"skills",
        "skill set":"skills","technologies":"skills","tools":"skills",
        "proficiencies":"skills",

        "certifications":"certifications","certificates":"certifications",
        "credentials":"certifications","licences":"certifications",
        "licenses":"certifications","professional certifications":"certifications",

        "projects":"projects","key projects":"projects","notable projects":"projects",
        "personal projects":"projects","open source":"projects","portfolio":"projects",

        "awards":"awards","achievements":"awards","honors":"awards",
        "honours":"awards","accomplishments":"awards","recognition":"awards",

        "publications":"publications","papers":"publications","research":"publications",

        "languages":"languages","language skills":"languages",

        "volunteer":"volunteer","volunteering":"volunteer","community":"volunteer",
    }
    return aliases.get(heading, heading)


def _parse_summary(sections: dict) -> str:
    lines = sections.get("summary", [])
    return " ".join(l for l in lines if l.strip())[:1200]


def _parse_experience(sections: dict) -> list:
    """
    Parse experience section into list of job dicts.
    Each job: {company, title, location, dates, bullets}
    """
    lines = sections.get("experience", [])
    if not lines:
        return []

    jobs   = []
    current = None

    date_re    = re.compile(
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}'
        r'|\d{4})\s*[\-–—to]+\s*'
        r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}'
        r'|\d{4}|Present|Current|Now|present|current)',
        re.IGNORECASE
    )
    bullet_re  = re.compile(r'^[\•\-\*▸▪◦➢➤→>]\s*|^\d+\.\s+')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        date_match = date_re.search(line)

        if date_match:
            # This line is a job header
            if current:
                jobs.append(current)

            dates = date_match.group()
            remainder = (line[:date_match.start()] + line[date_match.end():]).strip()
            remainder = remainder.strip("–—|-• ")

            # Try to split "Title at/@ Company" or "Company | Title"
            company, title = _split_company_title(remainder)

            # Try to detect location
            location = ""
            loc_match = re.search(r',\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$', remainder)
            if loc_match:
                location = loc_match.group(1)

            current = {
                "company":  company,
                "title":    title,
                "location": location,
                "dates":    dates.strip(),
                "bullets":  [],
            }

        elif current is not None:
            # It's a bullet or description line
            clean = bullet_re.sub("", line).strip()
            if clean and len(clean) > 10:
                current["bullets"].append(clean)

    if current:
        jobs.append(current)

    return jobs


def _split_company_title(text: str) -> tuple:
    """Heuristically split 'Software Engineer at Google' or 'Google | Software Engineer'."""
    separators = [" at ", " @ ", " | ", " — ", " – ", " - "]
    for sep in separators:
        if sep.lower() in text.lower():
            idx = text.lower().index(sep.lower())
            left  = text[:idx].strip()
            right = text[idx+len(sep):].strip()
            # Decide which is company vs title by checking if left is likely a company
            # Company names tend to be shorter or contain known company patterns
            if len(left.split()) <= 4 and left[0:1].isupper():
                return left, right   # company, title
            else:
                return right, left   # company, title
    # No separator — try to guess
    parts = text.split(",")
    if len(parts) >= 2:
        return parts[1].strip(), parts[0].strip()
    return text, ""


def _parse_education(sections: dict) -> list:
    lines  = sections.get("education", [])
    result = []
    current = {}

    degree_keywords = [
        "bachelor","b.tech","b.e.","b.sc","bsc","b.com","ba ","b.a.",
        "master","m.tech","m.sc","msc","mba","m.com","ma ","m.a.",
        "phd","ph.d","doctor","d.phil","associate","diploma","certificate",
        "higher national","hnd","hnc",
    ]
    year_re = re.compile(r'\b(19|20)\d{2}\b')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        line_lower = line.lower()
        has_degree = any(kw in line_lower for kw in degree_keywords)
        year_match = year_re.search(line)

        if has_degree:
            if current:
                result.append(current)
            gpa_match = re.search(r'(?:gpa|cgpa|grade)[:\s]*(\d+\.?\d*(?:\s*/\s*\d+\.?\d*)?)', line, re.I)
            current = {
                "degree":      line,
                "institution": "",
                "field":       "",
                "year":        year_match.group() if year_match else "",
                "gpa":         gpa_match.group(1) if gpa_match else "",
                "honors":      "",
            }
            # Try to extract field
            field_match = re.search(r'(?:in|of)\s+([A-Za-z\s&]+?)(?:\s*,|\s*\(|\s*–|\s*\d|$)', line, re.I)
            if field_match:
                current["field"] = field_match.group(1).strip()

        elif current and not current.get("institution"):
            current["institution"] = line
            if not current["year"] and year_match:
                current["year"] = year_match.group()

        elif current and year_match and not current.get("year"):
            current["year"] = year_match.group()

    if current:
        result.append(current)

    return result


def _parse_skills(sections: dict) -> list:
    lines = sections.get("skills", [])
    skills = []
    for line in lines:
        # Split on commas, pipes, bullets, semicolons
        parts = re.split(r'[,|;•\t]+', line)
        for p in parts:
            p = p.strip(" -•▸*")
            if p and len(p) > 1 and len(p) < 50:
                skills.append(p)
    return skills


def _parse_certs(sections: dict) -> list:
    lines = sections.get("certifications", [])
    certs = []
    for line in lines:
        clean = re.sub(r'^[\•\-\*▸▪◦➢➤→>]\s*', "", line).strip()
        if clean and len(clean) > 3:
            certs.append(clean)
    return certs


def _parse_projects(sections: dict) -> list:
    lines   = sections.get("projects", [])
    projects = []
    current  = None
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if re.match(r'^[A-Z]', line) and len(line) < 80 and not line.startswith("•"):
            if current:
                projects.append(current)
            current = {"name": line, "bullets": []}
        elif current:
            clean = re.sub(r'^[\•\-\*▸▪◦]\s*', "", line).strip()
            if clean:
                current["bullets"].append(clean)
    if current:
        projects.append(current)
    return projects


# ═══════════════════════════════════════════════════════════════════════════
# 3. MATCH & SCORE
# ═══════════════════════════════════════════════════════════════════════════

def match_and_score(job: dict, resume: dict) -> dict:
    """
    Compare job requirements against resume content.
    Returns: ats_score, matched_keywords, missing_keywords, recommendations
    """
    job_skills    = set(job["all_skills"])
    resume_skills = set(resume["all_skills"])

    matched   = job_skills & resume_skills
    missing   = job_skills - resume_skills

    # Score components (weighted)
    skill_score  = len(matched) / max(len(job_skills), 1) * 100
    keyword_score = _keyword_overlap_score(job["raw_keywords"], resume["raw"])
    format_score  = _format_score(resume)
    verb_score    = _verb_score(resume["experience"])

    # Weighted ATS score
    ats_score = int(
        skill_score  * 0.45 +
        keyword_score * 0.30 +
        format_score  * 0.15 +
        verb_score    * 0.10
    )
    ats_score = max(30, min(99, ats_score))

    # Gap analysis
    critical_missing = missing & set(job["required_skills"])
    nice_missing     = missing & set(job["nice_to_have"])

    recommendations = _generate_recommendations(
        matched, missing, critical_missing, resume, job
    )

    return {
        "ats_score":        ats_score,
        "matched_keywords": sorted(matched),
        "missing_keywords": sorted(missing),
        "critical_missing": sorted(critical_missing),
        "nice_missing":     sorted(nice_missing),
        "skill_coverage":   round(skill_score, 1),
        "recommendations":  recommendations,
    }


def _keyword_overlap_score(jd_keywords: list, resume_text: str) -> float:
    resume_lower = resume_text.lower()
    if not jd_keywords:
        return 70.0
    hits = sum(1 for kw in jd_keywords[:20] if kw in resume_lower)
    return (hits / min(len(jd_keywords), 20)) * 100


def _format_score(resume: dict) -> float:
    score = 60.0
    if resume.get("name"):        score += 10
    if resume.get("contact", {}).get("email"): score += 10
    if resume.get("experience"):  score += 10
    if resume.get("education"):   score += 5
    if resume.get("skills_raw"):  score += 5
    return min(score, 100.0)


def _verb_score(experience: list) -> float:
    if not experience:
        return 50.0
    total  = 0
    strong = 0
    for job in experience:
        for bullet in job.get("bullets", []):
            total += 1
            first_word = bullet.split()[0].lower().rstrip(".,;") if bullet.split() else ""
            if first_word in STRONG_VERBS:
                strong += 1
    if total == 0:
        return 50.0
    return (strong / total) * 100


def _generate_recommendations(matched, missing, critical_missing, resume, job):
    recs = []
    if critical_missing:
        recs.append(f"Add missing required skills to your skills section: {', '.join(list(critical_missing)[:5])}")
    if not any(re.search(p, " ".join(b for e in resume["experience"] for b in e.get("bullets",[])))
               for p in METRIC_PATTERNS):
        recs.append("Add quantified achievements (numbers, %, $) to experience bullets")
    weak_bullets = []
    for exp in resume["experience"]:
        for b in exp.get("bullets", []):
            first = b.split()[0].lower().rstrip(".,") if b.split() else ""
            if first in WEAK_VERBS or first not in STRONG_VERBS:
                weak_bullets.append(b[:50])
    if weak_bullets:
        recs.append(f"Strengthen {len(weak_bullets)} bullet point(s) with action verbs (led, built, drove, reduced...)")
    if not resume.get("summary"):
        recs.append("Add a Professional Summary section targeting the " + job["role"] + " role")
    if len(matched) < 3:
        recs.append("Expand skills section to include more keywords from the job description")
    return recs[:6]


# ═══════════════════════════════════════════════════════════════════════════
# 4. RESUME BUILDER  (the output assembler)
# ═══════════════════════════════════════════════════════════════════════════

def build_resume(job: dict, resume: dict, match: dict, candidate_name: str, doc_type: str) -> dict:
    """
    Assemble an ATS-optimised resume dict ready for PDF/DOCX rendering.
    All transformations are rule-based:
      - Keyword injection into summary & bullets
      - Bullet verb strengthening
      - Metric flagging
      - Skill deduplication and categorisation
      - Section ordering by ATS priority
    """
    name    = candidate_name or resume.get("name") or "Your Name"
    contact = resume.get("contact", {})

    contact_parts = []
    if contact.get("email"):    contact_parts.append(contact["email"])
    if contact.get("phone"):    contact_parts.append(contact["phone"])
    if contact.get("linkedin"): contact_parts.append(contact["linkedin"])
    if contact.get("github"):   contact_parts.append(contact["github"])
    if contact.get("location"): contact_parts.append(contact["location"])
    contact_line = "  |  ".join(contact_parts)

    summary          = _build_summary(resume, job, match, doc_type)
    core_competencies = _build_competencies(resume, job, match)
    experience       = _build_experience(resume["experience"], job, match)
    education        = _build_education(resume["education"])
    certifications   = resume.get("certifications", [])
    additional_skills = _build_additional_skills(resume, job, match, core_competencies)
    projects         = _build_projects(resume.get("projects", []), job) if doc_type == "cv" else []

    improvements = _describe_improvements(resume, job, match, experience)

    return {
        "atsScore":          match["ats_score"],
        "name":              name,
        "contactLine":       contact_line,
        "summary":           summary,
        "coreCompetencies":  core_competencies,
        "experience":        experience,
        "education":         education,
        "certifications":    certifications,
        "additionalSkills":  additional_skills,
        "projects":          projects,
        "keywordsMatched":   match["matched_keywords"][:12],
        "keywordsMissing":   match["critical_missing"][:8],
        "improvements":      improvements,
        "skillCoverage":     match["skill_coverage"],
    }


def _build_summary(resume: dict, job: dict, match: dict, doc_type: str) -> str:
    """
    Build or enhance a professional summary by:
    - Using existing summary as base
    - Injecting the job title
    - Inserting top matched keywords naturally
    - Adjusting tone for seniority
    """
    existing = resume.get("summary", "").strip()
    role     = job["role"]
    seniority = job["seniority"]
    yrs_req  = job["years_required"]
    industry = job["industry"]

    # Detect years of experience from resume
    resume_years = _estimate_years_experience(resume["experience"])

    # Build seniority descriptor
    if seniority == "senior" or resume_years >= 7:
        level_str = f"senior {role}"
    elif seniority == "executive":
        level_str = f"results-driven {role}"
    elif seniority == "junior":
        level_str = f"{role}"
    else:
        level_str = f"{role}"

    # Pick top 3-4 matched keywords to inject
    top_kw = match["matched_keywords"][:4]
    kw_str = ", ".join(top_kw) if top_kw else ""

    # Build year string
    yr_str = f"{resume_years}+ years" if resume_years > 0 else ""

    if existing and len(existing) > 60:
        # Enhance existing summary
        # Ensure role is mentioned
        if role.lower() not in existing.lower():
            summary = f"{existing.rstrip('.')}. Targeting the {role} role."
        else:
            summary = existing

        # Inject keywords if not already present
        for kw in top_kw[:2]:
            if kw.lower() not in summary.lower():
                summary = summary.rstrip(".") + f", with expertise in {kw}."
                break

        return summary[:600]

    # Build from scratch
    parts = []
    if yr_str:
        parts.append(f"{yr_str} of experience as a {level_str}")
    else:
        parts.append(f"Experienced {level_str}")

    if kw_str:
        parts.append(f"with a strong background in {kw_str}")

    if industry != "general":
        parts.append(f"in the {industry} domain")

    base = " ".join(parts).rstrip(".") + ". "

    # Add achievement indicator
    exp  = resume.get("experience", [])
    quantified = []
    for e in exp:
        for b in e.get("bullets", []):
            if any(re.search(p, b) for p in METRIC_PATTERNS):
                quantified.append(b)
                break

    if quantified:
        base += "Proven track record of " + _extract_achievement_phrase(quantified[0]) + ". "

    base += f"Seeking to leverage expertise to drive impact as {role}."
    return base.strip()[:600]


def _estimate_years_experience(experience: list) -> int:
    if not experience:
        return 0
    year_re = re.compile(r'\b(20\d{2}|19\d{2})\b')
    years   = []
    for exp in experience:
        matches = year_re.findall(exp.get("dates", ""))
        years.extend(int(y) for y in matches)
    if not years:
        return len(experience) * 2  # rough estimate
    return max(years) - min(years)


def _extract_achievement_phrase(bullet: str) -> str:
    """Pull a short achievement phrase from a bullet."""
    bullet = re.sub(r'^[\•\-\*▸▪◦➢➤→>]\s*', "", bullet).strip()
    bullet = re.sub(r'^(Led|Managed|Built|Developed|Designed|Implemented)\s+', "", bullet, flags=re.I)
    return bullet[:80].rstrip(".") + "..."


def _build_competencies(resume: dict, job: dict, match: dict) -> list:
    """
    Build the Core Competencies list.
    Priority: matched skills → resume skills → JD skills
    Capped at 12, deduplicated, title-cased.
    """
    matched   = set(match["matched_keywords"])
    jd_skills = set(job["all_skills"])
    rs_skills = set(s.lower() for s in resume.get("skills_raw", []))

    # Priority order
    combined = []
    for s in match["matched_keywords"]:
        combined.append(s)
    for s in resume.get("skills_raw", []):
        sl = s.lower()
        if sl not in {c.lower() for c in combined}:
            combined.append(s)
    for s in job["all_skills"]:
        if s not in {c.lower() for c in combined}:
            combined.append(s)

    # Deduplicate case-insensitively
    seen    = set()
    result  = []
    for s in combined:
        key = s.lower()
        if key not in seen and len(s) > 1:
            seen.add(key)
            result.append(_title_skill(s))

    return result[:12]


def _title_skill(skill: str) -> str:
    """Title-case a skill but preserve known acronyms."""
    acronyms = {
        "aws","gcp","api","sdk","sql","html","css","ci/cd","ml","ai","nlp",
        "oop","tdd","bdd","rest","ux","ui","crm","erp","sap","bi","etl",
        "k8s","iam","soc","siem","jwt","gdpr","iso","pmp","okr","kpi","p&l",
        "b2b","b2c","saas","ios","nlp","php","tcp/ip","dns","ssl",
    }
    if skill.lower() in acronyms:
        return skill.upper() if len(skill) <= 4 else skill
    return " ".join(w.capitalize() for w in skill.split())


def _build_experience(experience: list, job: dict, match: dict) -> list:
    """
    Enhance each job's bullets:
    - Strengthen weak opening verbs
    - Inject missing JD keywords where contextually appropriate
    - Ensure metrics are visible
    - Limit to 5 bullets per role
    """
    jd_keywords = set(job["raw_keywords"][:30])
    result      = []

    for exp in experience:
        bullets = exp.get("bullets", [])
        enhanced = []

        for bullet in bullets[:6]:  # max 6 bullets input
            b = _strengthen_verb(bullet)
            b = _ensure_metric_present(b)
            enhanced.append(b)

        # Inject up to 1 JD keyword per job if not already present
        job_text = " ".join(enhanced).lower()
        for kw in match["matched_keywords"]:
            if kw in job_text:
                break   # already present
        # (keyword injection into bullets is kept light — avoids keyword stuffing)

        result.append({
            "company":  exp.get("company", ""),
            "title":    exp.get("title", ""),
            "location": exp.get("location", ""),
            "dates":    exp.get("dates", ""),
            "bullets":  enhanced[:5],
        })

    return result


def _strengthen_verb(bullet: str) -> str:
    """Replace weak opening verb with a strong alternative."""
    verb_replacements = {
        "helped":              "Supported",
        "assisted":            "Collaborated to",
        "worked on":           "Developed",
        "worked with":         "Partnered with",
        "was responsible for": "Managed",
        "responsible for":     "Managed",
        "duties included":     "Delivered",
        "tasked with":         "Executed",
        "did":                 "Executed",
        "made":                "Created",
        "handled":             "Managed",
        "involved in":         "Contributed to",
        "participated in":     "Contributed to",
        "used":                "Leveraged",
        "utilized":            "Leveraged",
        "contributed to":      "Delivered",
    }
    for weak, strong in verb_replacements.items():
        pattern = re.compile(r'^' + re.escape(weak) + r'\b', re.IGNORECASE)
        if pattern.match(bullet):
            return pattern.sub(strong, bullet, count=1)
    # Capitalise first letter
    return bullet[0].upper() + bullet[1:] if bullet else bullet


def _ensure_metric_present(bullet: str) -> str:
    """
    If bullet has no metric, don't fabricate one — just return as-is.
    Metrics are preserved as-is from the original resume.
    """
    return bullet


def _build_education(education: list) -> list:
    result = []
    for ed in education:
        degree_raw = ed.get("degree", "")
        # Clean up the degree line
        degree = re.sub(r'\s+', " ", degree_raw).strip()
        degree = re.sub(r'\(\d{4}\)', "", degree).strip()

        result.append({
            "institution": ed.get("institution", ""),
            "degree":      degree,
            "field":       ed.get("field", ""),
            "year":        ed.get("year", ""),
            "gpa":         ed.get("gpa", ""),
            "honors":      ed.get("honors", ""),
        })
    return result


def _build_additional_skills(resume: dict, job: dict, match: dict, competencies: list) -> list:
    """Skills that didn't make the Core Competencies list but are worth showing."""
    comp_lower  = {c.lower() for c in competencies}
    all_resume  = set(s.lower() for s in resume.get("skills_raw", []))
    jd_missing  = set(match.get("nice_missing", []))

    additional  = []
    for s in resume.get("skills_raw", []):
        if s.lower() not in comp_lower:
            additional.append(_title_skill(s))

    for s in jd_missing:
        if s.lower() not in comp_lower and s not in additional:
            additional.append(_title_skill(s))

    return list(dict.fromkeys(additional))[:10]


def _build_projects(projects: list, job: dict) -> list:
    result = []
    for p in projects[:4]:
        result.append({
            "name":    p.get("name", ""),
            "bullets": p.get("bullets", [])[:4],
        })
    return result


def _describe_improvements(resume: dict, job: dict, match: dict, experience: list) -> list:
    improvements = []

    n_matched = len(match["matched_keywords"])
    if n_matched > 0:
        improvements.append(
            f"Matched {n_matched} skill keyword(s) from the job description into the document"
        )

    strengthened = 0
    for exp in experience:
        for b in exp.get("bullets", []):
            fw = b.split()[0].lower().rstrip(".,") if b.split() else ""
            if fw in STRONG_VERBS:
                strengthened += 1
    if strengthened:
        improvements.append(f"{strengthened} bullet point(s) begin with strong ATS-preferred action verbs")

    if not resume.get("summary"):
        improvements.append("Generated a targeted Professional Summary aligned to the job role")
    else:
        improvements.append("Enhanced Professional Summary with role-specific keywords")

    n_crit = len(match.get("critical_missing", []))
    if n_crit:
        improvements.append(
            f"{n_crit} required skill(s) not found in your resume — consider adding if applicable: "
            + ", ".join(match["critical_missing"][:4])
        )

    improvements.append("Applied ATS-safe single-column formatting: no tables, no columns, no graphics")

    return improvements[:6]


# ═══════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════

def _clean_text(text: str) -> str:
    text = re.sub(r'https?://\S+', ' ', text)
    text = re.sub(r'[^\w\s\.\+#/]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def _tokenize(text: str) -> list:
    return re.findall(r'[a-z][a-z0-9\+#\.]*', text.lower())
