#!/usr/bin/env python3
"""
pipeline.py
Orquestador de Bite & Wire: recolecta noticias de IA, las puntúa por
impacto y por oportunidad de negocio, arma las vistas del dashboard y
guarda data/latest.json + histórico.
"""
import json
import os
from datetime import datetime, timezone

import news_aggregator as news_mod
import impact_scorer as scorer_mod

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
HISTORY_DIR = os.path.join(DATA_DIR, "history")
LATEST_PATH = os.path.join(DATA_DIR, "latest.json")

MAX_ALL_ITEMS = 300
MAX_AGE_DAYS = 14  # Google News a veces devuelve posts viejos (vistos casos de +1
                   # año) para queries amplias — se descartan antes de puntuar/rankear
                   # para que no aparezcan como si fueran de hoy en ninguna sección.
TOP_IMPACT_N = 24
TOP_OPPORTUNITIES_N = 16
OPPORTUNITY_MIN_SCORE = 1.5  # por debajo de esto no se considera una oportunidad real
MAX_PER_TOPIC = 20

TOPIC_LABELS_ES = {
    "financiamiento": "Financiamiento",
    "regulacion": "Regulación",
    "investigacion": "Investigación",
    "negocio": "Negocio",
    "producto": "Producto y lanzamientos",
}


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _filter_stale(items):
    """Descarta items cuya fecha de publicación (cuando existe y es parseable)
    es más vieja que MAX_AGE_DAYS. Items sin fecha o con fecha inválida se
    conservan (no hay forma de juzgarlos, y en la práctica casi todas las
    fuentes usadas sí traen fecha)."""
    now = datetime.now(timezone.utc)
    kept = []
    discarded = 0
    for it in items:
        pub = it.get("published")
        if not pub:
            kept.append(it)
            continue
        try:
            dt = datetime.fromisoformat(pub)
        except (ValueError, TypeError):
            kept.append(it)
            continue
        if (now - dt).days > MAX_AGE_DAYS:
            discarded += 1
            continue
        kept.append(it)
    return kept, discarded


def _clean_item_for_output(it):
    return {
        "title": it["title"],
        "link": it["link"],
        "summary": it.get("summary", ""),
        "published": it.get("published"),
        "sources": it.get("_hit_sources", [it.get("source", "unknown")]),
        "cross_source_count": it.get("cross_source_count", 1),
        "topic": it.get("topic"),
        "impact_score": it.get("impact_score", 0),
        "opportunity_score": it.get("opportunity_score", 0),
        "engagement": it.get("engagement"),
    }


def run_pipeline():
    print("== Recolectando noticias de IA ==")
    raw_items = news_mod.collect_all()
    print(f"  {len(raw_items)} items en bruto de {len(set(i['source'] for i in raw_items))} fuentes")

    items = news_mod.dedupe(raw_items)
    print(f"  {len(items)} items únicos tras deduplicar")

    items, discarded_stale = _filter_stale(items)
    if discarded_stale:
        print(f"  {discarded_stale} items descartados por ser más viejos que {MAX_AGE_DAYS} días (visto: Google News a veces devuelve posts viejos para queries amplias)")

    print("== Puntuando impacto y oportunidades ==")
    items = scorer_mod.score_all(items)

    # ordena por fecha de publicación desc cuando existe, si no al final
    def _pub_key(it):
        return it.get("published") or ""
    items_by_date = sorted(items, key=_pub_key, reverse=True)[:MAX_ALL_ITEMS]

    top_impact = sorted(items, key=lambda it: it["impact_score"], reverse=True)[:TOP_IMPACT_N]

    opportunities = [it for it in items if it["opportunity_score"] >= OPPORTUNITY_MIN_SCORE]
    opportunities = sorted(opportunities, key=lambda it: it["opportunity_score"], reverse=True)[:TOP_OPPORTUNITIES_N]

    by_topic = {}
    for topic in TOPIC_LABELS_ES:
        topic_items = [it for it in items if it["topic"] == topic]
        topic_items = sorted(topic_items, key=lambda it: it["impact_score"], reverse=True)[:MAX_PER_TOPIC]
        by_topic[topic] = [_clean_item_for_output(it) for it in topic_items]

    alerts = []
    for it in top_impact[:6]:
        alerts.append(f"{it['title']} ({', '.join(it.get('_hit_sources', [])[:2])})")

    snapshot = {
        "generated_at": _now_iso(),
        "stats": {
            "total_items": len(items),
            "sources": len(set(s for it in items for s in it.get("_hit_sources", []))),
            "opportunities": len(opportunities),
            "topics": {t: len(v) for t, v in by_topic.items()},
        },
        "alerts": alerts,
        "top_impact": [_clean_item_for_output(it) for it in top_impact],
        "opportunities": [_clean_item_for_output(it) for it in opportunities],
        "by_topic": by_topic,
        "all_items": [_clean_item_for_output(it) for it in items_by_date],
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(HISTORY_DIR, exist_ok=True)
    with open(LATEST_PATH, "w") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    hist_path = os.path.join(HISTORY_DIR, f"{stamp}.json")
    with open(hist_path, "w") as f:
        json.dump(snapshot, f, ensure_ascii=False)

    print("\n== RESUMEN ==")
    print(f"Items totales: {len(items)}")
    print(f"Oportunidades detectadas: {len(opportunities)}")
    for t, n in snapshot["stats"]["topics"].items():
        print(f"  {TOPIC_LABELS_ES[t]}: {n}")
    print("\nTop impacto:")
    for it in top_impact[:6]:
        print(f"  [{it['impact_score']}] {it['title'][:85]}")
    print("\nTop oportunidades:")
    for it in opportunities[:6]:
        print(f"  [{it['opportunity_score']}] {it['title'][:85]}")

    return snapshot


if __name__ == "__main__":
    run_pipeline()
