#!/usr/bin/env python3
"""
news_aggregator.py
Recolecta noticias de IA vía RSS y APIs públicas sin necesidad de API keys:
feeds dedicados de medios tech, Google News (consultas específicas), Hacker
News (Algolia, sin key) y arXiv (papers nuevos de cs.AI/cs.LG/cs.CL).
"""
import feedparser
import requests
import re
import time
from datetime import datetime, timezone
from urllib.parse import quote

_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text):
    return _TAG_RE.sub("", text or "").replace("&nbsp;", " ").strip()


HEADERS = {"User-Agent": "Mozilla/5.0 (ByteWireNewsBot research tool; contact: research)"}

# Feeds dedicados de medios tech con cobertura de IA (no requieren query).
DEDICATED_FEEDS = {
    "techcrunch": "https://techcrunch.com/category/artificial-intelligence/feed/",
    "theverge": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    "technologyreview": "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    "arstechnica": "https://arstechnica.com/ai/feed/",
    "venturebeat": "https://venturebeat.com/category/ai/feed/",  # a veces 429, se trata como best-effort
}

# Consultas de Google News RSS — cobertura amplia + por empresa + por tema.
GENERAL_QUERIES = {
    "general": "artificial intelligence OR AI model OR machine learning",
}

COMPANY_QUERIES = {
    "openai": "OpenAI",
    "anthropic": "Anthropic AI",
    "google_deepmind": "Google DeepMind OR Gemini AI",
    "meta_ai": "Meta AI OR Llama AI model",
    "microsoft_ai": "Microsoft AI OR Copilot AI",
    "nvidia_ai": "Nvidia AI chips OR Nvidia GPU AI",
    "xai": "xAI Grok",
    "mistral": "Mistral AI",
    "perplexity": "Perplexity AI",
    "amazon_ai": "Amazon AI OR AWS AI",
}

TOPIC_QUERIES = {
    "financiamiento": "AI startup funding OR AI acquisition OR AI raises million OR AI valuation",
    "regulacion": "AI regulation OR AI policy OR AI lawsuit OR AI law",
    "negocio": "AI layoffs OR AI partnership OR AI earnings OR AI enterprise adoption",
    "oportunidades": '"AI startup" raises OR "AI tool" launch OR AI API pricing OR open source AI model release OR AI accelerator program',
}

# arXiv — papers nuevos (Atom/RSS), sin key. No hay entradas nuevas los fines
# de semana (arXiv no publica listados sáb/dom) — se trata como normal, no error.
ARXIV_FEEDS = {
    "arxiv_cs_ai": "https://export.arxiv.org/rss/cs.AI",
    "arxiv_cs_cl": "https://export.arxiv.org/rss/cs.CL",  # NLP
}

HN_ALGOLIA_URL = "https://hn.algolia.com/api/v1/search_by_date?query={query}&tags=story&hitsPerPage=30"
HN_QUERIES = ["AI", "LLM", "GPT", "machine learning"]


def _google_news_rss(query, lang="en-US", country="US"):
    return f"https://news.google.com/rss/search?q={quote(query)}&hl={lang}&gl={country}&ceid={country}:{lang.split('-')[0]}"


def fetch_feed(url, retries=2, timeout=15):
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
            if resp.status_code == 200:
                return feedparser.parse(resp.content)
            if resp.status_code == 429 and attempt < retries:
                time.sleep(2)
                continue
        except Exception as e:
            if attempt == retries:
                print(f"  [warn] fallo al obtener {url[:90]}: {e}")
        time.sleep(1)
    return None


_PLACEHOLDER_TITLE_RE = re.compile(r"(?i)^symbol_*\b")


def _looks_like_placeholder_title(title):
    t = (title or "").strip()
    return bool(_PLACEHOLDER_TITLE_RE.match(t))


def _entry_to_item(entry, category, source_label=None):
    published = None
    if getattr(entry, "published_parsed", None):
        published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
    source = source_label
    if not source and getattr(entry, "source", None):
        source = getattr(entry.source, "title", None)
    title = entry.get("title", "").strip()
    if _looks_like_placeholder_title(title):
        return None
    return {
        "title": title,
        "link": entry.get("link", ""),
        "summary": _strip_html(entry.get("summary", ""))[:500],
        "published": published,
        "source": source or "unknown",
        "category": category,
        "engagement": None,  # se llena para HN (points/comments)
    }


def collect_dedicated_feeds():
    items = []
    for name, url in DEDICATED_FEEDS.items():
        feed = fetch_feed(url)
        if not feed:
            continue
        for entry in feed.entries[:25]:
            item = _entry_to_item(entry, f"medio:{name}", source_label=name)
            if item:
                items.append(item)
    return items


def collect_google_queries(queries, category_prefix):
    items = []
    for key, query in queries.items():
        feed = fetch_feed(_google_news_rss(query))
        if not feed:
            continue
        for entry in feed.entries[:20]:
            item = _entry_to_item(entry, f"{category_prefix}:{key}")
            if item:
                items.append(item)
    return items


def collect_arxiv():
    items = []
    for name, url in ARXIV_FEEDS.items():
        feed = fetch_feed(url)
        if not feed:
            continue
        for entry in feed.entries[:15]:
            item = _entry_to_item(entry, "investigacion:arxiv", source_label="arXiv")
            if item:
                # arXiv trae el resumen en <description>, no <summary> limpio de HTML —
                # ya lo cubre _strip_html. El título trae "Titulo. (arXiv:XXXX.XXXXX...)" —
                # se recorta la coletilla de arXiv id para que se lea como un titular normal.
                item["title"] = re.sub(r"\s*\(arXiv:[^)]+\)\s*$", "", item["title"]).strip()
                items.append(item)
    return items


def collect_hacker_news():
    """Hacker News vía Algolia (sin key). Trae points/num_comments como señal de
    interés real de la comunidad — se usa como bonus en el scoring de impacto."""
    items = []
    for query in HN_QUERIES:
        try:
            resp = requests.get(
                HN_ALGOLIA_URL.format(query=quote(query)), headers=HEADERS, timeout=15
            )
            if resp.status_code != 200:
                continue
            hits = resp.json().get("hits", [])
        except Exception as e:
            print(f"  [warn] fallo HN Algolia ({query}): {e}")
            continue
        for hit in hits:
            title = (hit.get("title") or hit.get("story_title") or "").strip()
            if not title:
                continue
            link = hit.get("url") or hit.get("story_url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
            published = hit.get("created_at")
            items.append({
                "title": title,
                "link": link,
                "summary": "",
                "published": published,
                "source": "Hacker News",
                "category": "comunidad:hackernews",
                "engagement": {
                    "points": hit.get("points") or 0,
                    "comments": hit.get("num_comments") or 0,
                },
            })
    return items


def collect_all():
    items = []
    items += collect_dedicated_feeds()
    items += collect_google_queries(GENERAL_QUERIES, "general")
    items += collect_google_queries(COMPANY_QUERIES, "empresa")
    items += collect_google_queries(TOPIC_QUERIES, "tema")
    items += collect_arxiv()
    items += collect_hacker_news()
    return items


def dedupe(items):
    """Colapsa duplicados por título normalizado, mezclando categorías/fuentes
    cuando el mismo titular aparece por varias consultas (útil como señal de
    'cuántas fuentes/queries distintas lo cubrieron' para el scoring de impacto)."""
    seen = {}
    out = []
    for it in items:
        key = re.sub(r"[^a-z0-9]+", "", it["title"].lower())[:120]
        if not key:
            continue
        if key not in seen:
            it["_hit_categories"] = {it["category"]}
            it["_hit_sources"] = {it["source"]}
            seen[key] = it
            out.append(it)
        else:
            existing = seen[key]
            existing["_hit_categories"].add(it["category"])
            existing["_hit_sources"].add(it["source"])
            # conserva el engagement de HN si el duplicado lo trae y el original no
            if not existing.get("engagement") and it.get("engagement"):
                existing["engagement"] = it["engagement"]
    for it in out:
        it["cross_source_count"] = len(it["_hit_sources"])
        it["_hit_categories"] = sorted(it["_hit_categories"])
        it["_hit_sources"] = sorted(it["_hit_sources"])
    return out


if __name__ == "__main__":
    print("Probando agregador de noticias de IA...")
    all_items = collect_all()
    print(f"Total bruto: {len(all_items)}")
    deduped = dedupe(all_items)
    print(f"Total sin duplicados: {len(deduped)}")
    for it in sorted(deduped, key=lambda x: x["cross_source_count"], reverse=True)[:8]:
        print(f"  [{it['cross_source_count']}x] {it['title'][:90]} | {it['_hit_sources']}")
