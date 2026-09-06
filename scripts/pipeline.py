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
import translator as translator_mod

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


RESUMEN_MIN_IMPACT_FOR_NUEVO = 2.0  # "lo más nuevo" ignora ruido puro sin nada de impacto


def build_resumen(items):
    """Arma el resumen ejecutivo de 4 tarjetas para la pestaña Hoy: la idea es
    que el usuario NO tenga que leer las 300+ noticias — con esto le alcanza.
    Todo se arma a partir de datos ya extraídos (impacto, fecha, montos en
    dinero, tema) con frases de plantilla en español; no traduce el titular
    original (eso requeriría un LLM en cada corrida, que se decidió no usar
    por costo) — el titular se muestra tal cual, en su idioma original, como
    referencia/fuente de la afirmación."""
    used_links = set()

    def pick(candidates):
        for it in candidates:
            if it["link"] not in used_links:
                used_links.add(it["link"])
                return it
        return None

    def entry(it, kicker, extra=None):
        if not it:
            return None
        out = _clean_item_for_output(it)
        out["kicker"] = kicker
        out["extra"] = extra
        return out

    by_impact = sorted(items, key=lambda it: it["impact_score"], reverse=True)
    by_date = sorted(
        [it for it in items if it.get("published") and it["impact_score"] >= RESUMEN_MIN_IMPACT_FOR_NUEVO],
        key=lambda it: it["published"],
        reverse=True,
    )

    money_candidates = []
    for it in items:
        # usa el texto en inglés (antes de traducir) porque el regex de montos
        # busca patrones tipo "$550 million" -- una vez traducido al español
        # el formato cambia ("550 millones de dólares") y ya no coincide.
        text_en = f"{it.get('title_en', it['title'])} {it.get('summary_en', it.get('summary',''))}"
        val, frag = scorer_mod.extract_max_money(text_en)
        if val > 0:
            money_candidates.append((val, it))
    money_candidates.sort(key=lambda x: x[0], reverse=True)

    regulacion_sorted = sorted(
        [it for it in items if it["topic"] == "regulacion"], key=lambda it: it["impact_score"], reverse=True
    )
    investigacion_sorted = sorted(
        [it for it in items if it["topic"] == "investigacion"], key=lambda it: it["impact_score"], reverse=True
    )
    opp_sorted = sorted(
        [it for it in items if it["opportunity_score"] >= OPPORTUNITY_MIN_SCORE],
        key=lambda it: it["opportunity_score"],
        reverse=True,
    )

    importante = pick(by_impact)

    nuevo = pick(by_date) or pick(by_impact)

    mas_caro = None
    caro_amount = None
    for val, it in money_candidates:
        if it["link"] not in used_links:
            mas_caro = it
            caro_amount = scorer_mod.fmt_money_es(val)
            used_links.add(it["link"])
            break

    deberias_saber = pick(regulacion_sorted) or pick(investigacion_sorted) or pick(opp_sorted) or pick(by_impact)

    return {
        "importante": entry(importante, "Lo más importante"),
        "nuevo": entry(nuevo, "Lo más nuevo"),
        "mas_caro": entry(mas_caro, "La cifra más grande de hoy", extra=caro_amount),
        "deberias_saber": entry(deberias_saber, "Algo que deberías saber"),
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

    print("== Traduciendo título y resumen al español (gratis, con cache) ==")
    items, tr_new, tr_failed, tr_cached = translator_mod.translate_items(items)
    print(f"  {tr_new} traducidos nuevos, {tr_cached} desde cache, {tr_failed} fallidos (se quedan en inglés)")

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

    resumen = build_resumen(items)

    snapshot = {
        "generated_at": _now_iso(),
        "stats": {
            "total_items": len(items),
            "sources": len(set(s for it in items for s in it.get("_hit_sources", []))),
            "opportunities": len(opportunities),
            "topics": {t: len(v) for t, v in by_topic.items()},
        },
        "resumen": resumen,
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

    print("\nResumen de hoy:")
    for key, label in [("importante", "Lo más importante"), ("nuevo", "Lo más nuevo"), ("mas_caro", "La cifra más grande"), ("deberias_saber", "Algo que deberías saber")]:
        r = resumen.get(key)
        if r:
            extra = f" [{r['extra']}]" if r.get("extra") else ""
            print(f"  {label}{extra}: {r['title'][:80]}")
        else:
            print(f"  {label}: (sin datos)")

    return snapshot


if __name__ == "__main__":
    run_pipeline()
