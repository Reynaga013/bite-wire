#!/usr/bin/env python3
"""
impact_scorer.py
Puntúa cada noticia por "impacto" (qué tan grande/relevante es la noticia,
no si es buena o mala noticia) y detecta si describe una posible
oportunidad de negocio. Enfoque tipo léxico ponderado, igual que el
sentiment.py de Whale & Wire pero para una dimensión distinta (magnitud,
no polaridad) — no requiere API keys ni llamadas a un LLM en cada corrida.
"""
import re

# ---------- Impacto (magnitud/relevancia de la noticia) ----------
# Frases con peso; se suman las coincidencias (case-insensitive, sobre
# título + resumen). Rango de referencia aprox. 0-10 tras normalizar.
IMPACT_LEXICON = {
    # lanzamientos / productos — muy visibles, alto impacto inmediato
    "launches": 2.0, "unveils": 2.2, "announces": 1.3, "debuts": 2.0,
    "releases": 1.5, "rolls out": 1.5, "now available": 1.2,
    "state-of-the-art": 2.5, "outperforms": 2.0, "beats": 1.3,
    "breakthrough": 3.0, "first-ever": 2.5, "first company to": 2.3,
    # financiamiento / negocio — señales fuertes de magnitud
    "raises $": 2.8, "funding round": 2.3, "series a": 2.0, "series b": 2.2,
    "series c": 2.4, "valued at": 2.5, "valuation": 1.8, "acquires": 2.6,
    "acquisition": 2.2, "ipo": 2.8, "merger": 2.3, "billion": 2.0, "million": 1.0,
    # regulación / legal — impacto sistémico
    "regulation": 2.0, "lawsuit": 2.2, "sues": 2.0, "sued": 1.8, "ban": 2.3,
    "antitrust": 2.5, "investigation": 1.8, "settlement": 1.7,
    # negocio / mercado
    "layoffs": 2.3, "job cuts": 2.0, "partnership": 1.3, "earnings": 1.5,
    "revenue": 1.2, "market share": 1.5, "shuts down": 2.4, "bankruptcy": 3.0,
    # escala / superlativos genéricos que suelen acompañar noticias grandes
    "record": 1.3, "unprecedented": 2.0, "historic": 1.8, "largest": 1.6,
    "warns": 1.2, "backlash": 1.5, "controversy": 1.4,
}

# ---------- Oportunidad de negocio ----------
# Señales de que la noticia describe algo que un lector podría aprovechar:
# una herramienta nueva usable, un hueco de mercado, financiamiento
# disponible, acceso más barato/abierto, un programa al que aplicar, etc.
OPPORTUNITY_LEXICON = {
    "open source": 2.5, "open-source": 2.5, "free tier": 2.2, "free access": 2.0,
    "api now available": 2.6, "public api": 2.0, "waitlist": 1.5,
    "beta access": 1.6, "early access": 1.6, "no-code": 2.0, "low-code": 1.6,
    "developers can now": 2.2, "plugin": 1.3, "integration": 1.2,
    "accelerator": 2.3, "grant program": 2.4, "fund for startups": 2.5,
    "incubator": 2.0, "price drop": 2.0, "cheaper": 1.6, "affordable": 1.5,
    "democratiz": 2.2, "underserved": 2.3, "gap in the market": 3.0,
    "untapped": 2.5, "small business": 1.6, "sme": 1.4,
    "marketplace": 1.4, "template": 1.0, "toolkit": 1.3, "sdk": 1.3,
    "self-serve": 1.5, "freemium": 1.6, "raises $": 1.2,  # financiamiento en el nicho = oportunidad de ecosistema
}

# Frases que, aunque compartan alguna palabra con el léxico de oportunidad,
# casi siempre señalan lo contrario (cierre de acceso, no apertura) — restan.
OPPORTUNITY_NEGATORS = {
    "shuts down": -3.0, "discontinu": -2.5, "deprecat": -2.0, "waitlist closed": -2.0,
    "no longer available": -2.5, "price increase": -1.8, "paywall": -1.5,
}

_WORD_BOUNDARY_CACHE = {}


def _count_hits(text, lexicon):
    text_l = text.lower()
    score = 0.0
    hits = []
    for phrase, weight in lexicon.items():
        if phrase in _WORD_BOUNDARY_CACHE:
            pattern = _WORD_BOUNDARY_CACHE[phrase]
        else:
            pattern = re.compile(re.escape(phrase))
            _WORD_BOUNDARY_CACHE[phrase] = pattern
        n = len(pattern.findall(text_l))
        if n:
            score += weight * n
            hits.append(phrase)
    return score, hits


def score_impact(item):
    text = f"{item.get('title','')} {item.get('summary','')}"
    base, hits = _count_hits(text, IMPACT_LEXICON)

    # bonus por cobertura cruzada (varias fuentes/queries distintas cubrieron
    # lo mismo -> señal fuerte de que es una noticia grande, no ruido de una
    # sola fuente)
    cross = item.get("cross_source_count", 1)
    cross_bonus = min(cross - 1, 4) * 1.4

    # bonus por engagement real (Hacker News points/comments), log-escalado
    # para que un post viral no aplaste todo lo demás.
    engagement_bonus = 0.0
    eng = item.get("engagement")
    if eng:
        import math
        pts = eng.get("points") or 0
        cmts = eng.get("comments") or 0
        engagement_bonus = math.log1p(pts) * 0.6 + math.log1p(cmts) * 0.4

    total = round(base + cross_bonus + engagement_bonus, 2)
    return total, hits


def score_opportunity(item):
    text = f"{item.get('title','')} {item.get('summary','')}"
    pos, hits = _count_hits(text, OPPORTUNITY_LEXICON)
    neg, neg_hits = _count_hits(text, OPPORTUNITY_NEGATORS)
    total = round(pos + neg, 2)
    return total, hits, neg_hits


CATEGORY_LABELS_ES = {
    "medio:techcrunch": "TechCrunch", "medio:theverge": "The Verge",
    "medio:technologyreview": "MIT Technology Review", "medio:arstechnica": "Ars Technica",
    "medio:venturebeat": "VentureBeat",
    "general:general": "General", "comunidad:hackernews": "Hacker News",
    "investigacion:arxiv": "Investigación (arXiv)",
    "tema:financiamiento": "Financiamiento", "tema:regulacion": "Regulación",
    "tema:negocio": "Negocio", "tema:oportunidades": "Oportunidades",
}


def classify_topic(item):
    """Devuelve una etiqueta de tema principal para agrupar en la UI,
    priorizando la señal más específica disponible."""
    cats = item.get("_hit_categories") or [item.get("category", "")]
    for c in cats:
        if c.startswith("tema:financiamiento"):
            return "financiamiento"
        if c.startswith("tema:regulacion"):
            return "regulacion"
        if c.startswith("investigacion:"):
            return "investigacion"
        if c.startswith("tema:negocio"):
            return "negocio"
    # si no vino de una query temática, se infiere del propio léxico de impacto
    text = f"{item.get('title','')} {item.get('summary','')}".lower()
    if any(k in text for k in ("raises $", "funding round", "valued at", "acquisition", "acquires", "ipo", "series a", "series b", "series c")):
        return "financiamiento"
    if any(k in text for k in ("regulation", "lawsuit", "sues", "ban", "antitrust", "investigation")):
        return "regulacion"
    if any(k in text for k in ("layoffs", "partnership", "earnings", "revenue")):
        return "negocio"
    if item.get("category", "").startswith("investigacion:"):
        return "investigacion"
    return "producto"


# ---------- Extracción de montos en dinero (para "la cifra más grande de hoy") ----------
_MONEY_RE = re.compile(
    r"\$\s?([\d][\d,.]*)\s*(billion|bn|million|m\b|thousand|k\b)?", re.IGNORECASE
)
_UNIT_MULT = {"billion": 1e9, "bn": 1e9, "million": 1e6, "m": 1e6, "thousand": 1e3, "k": 1e3}


def extract_max_money(text):
    """Devuelve (valor_en_usd, fragmento_original) del monto más grande
    mencionado en el texto, o (0, None) si no encuentra ninguno. Sirve para
    detectar "la cifra más grande del día" sin depender de un LLM."""
    best_val, best_frag = 0.0, None
    for m in _MONEY_RE.finditer(text or ""):
        num_str, unit = m.group(1), (m.group(2) or "").lower()
        try:
            num = float(num_str.replace(",", ""))
        except ValueError:
            continue
        val = num * _UNIT_MULT.get(unit, 1)
        if val > best_val:
            best_val, best_frag = val, m.group(0).strip()
    return best_val, best_frag


def fmt_money_es(value):
    """Formatea un monto en USD al estilo hispanohablante habitual
    ('mil millones' en vez de 'billion', que en español significa otra cosa)."""
    if value >= 1e9:
        n = value / 1e9
        return f"${n:.1f} mil millones".replace(".0 ", " ")
    if value >= 1e6:
        return f"${value/1e6:.0f} millones"
    if value >= 1e3:
        return f"${value/1e3:.0f} mil"
    return f"${value:.0f}"


def score_all(items):
    for it in items:
        impact, impact_hits = score_impact(it)
        opp, opp_hits, opp_neg_hits = score_opportunity(it)
        it["impact_score"] = impact
        it["impact_hits"] = impact_hits
        it["opportunity_score"] = opp
        it["opportunity_hits"] = opp_hits
        it["topic"] = classify_topic(it)
    return items


if __name__ == "__main__":
    sample = [
        {"title": "OpenAI raises $6.6 billion in Series funding at $157 billion valuation", "summary": "", "cross_source_count": 3},
        {"title": "Small startup launches free open-source AI toolkit for developers", "summary": "The SDK is available now with a generous free tier", "cross_source_count": 1},
        {"title": "Company X hires new marketing VP", "summary": "", "cross_source_count": 1},
    ]
    for s in score_all(sample):
        print(s["title"][:70], "-> impact:", s["impact_score"], "opp:", s["opportunity_score"], "topic:", s["topic"])
