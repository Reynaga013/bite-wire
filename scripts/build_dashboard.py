#!/usr/bin/env python3
"""
build_dashboard.py
Genera el dashboard HTML autocontenido de Bite & Wire a partir de
data/latest.json. Mismo patrón que Whale & Wire (shell + JS vanilla +
window.__DATA__), con las lecciones aprendidas ya incorporadas:
meta viewport SIEMPRE presente (su ausencia causó un bug real de zoom-out
al 40% en Whale & Wire), hairline en tarjetas para profundidad en modo
oscuro, glow con background real.
"""
import json
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
LATEST_PATH = os.path.join(BASE_DIR, "data", "latest.json")
OUTPUT_PATH = os.path.join(BASE_DIR, "docs", "index.html")
CSS_PATH = os.path.join(SCRIPTS_DIR, "dashboard_style.css")
JS_PATH = os.path.join(SCRIPTS_DIR, "dashboard_app.js")

ICONS = {
    "hoy": '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    "noticias": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    "oportunidades": '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
}
TAB_LABELS = {"hoy": "Hoy", "noticias": "Noticias", "oportunidades": "Oportunidades"}
TAB_ORDER = ["hoy", "noticias", "oportunidades"]


def svg(name):
    return (
        f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
        f'stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>'
    )


def build_tabbar():
    btns = []
    for i, tab in enumerate(TAB_ORDER):
        active = "active" if i == 0 else ""
        btns.append(f'<button class="tab-btn {active}" data-tab="{tab}">{svg(tab)}<span>{TAB_LABELS[tab]}</span></button>')
    return "".join(btns)


def prep_data(raw):
    data = json.loads(json.dumps(raw))
    for it in data.get("all_items", []):
        if "summary" in it:
            it["summary"] = it["summary"][:220]
    return data


def build_dashboard():
    with open(LATEST_PATH, "r") as f:
        raw = json.load(f)
    with open(CSS_PATH, "r") as f:
        css = f.read()
    with open(JS_PATH, "r") as f:
        js = f.read()

    data = prep_data(raw)
    generated_at = data.get("generated_at", "")
    try:
        dt = datetime.fromisoformat(generated_at)
        generated_str = dt.strftime("%d %b, %H:%M UTC")
    except ValueError:
        generated_str = generated_at

    data_json = json.dumps(data, default=str, separators=(",", ":"))
    data_json = data_json.replace("</", "<\\/")

    tabbar_html = build_tabbar()
    stats = data.get("stats", {})

    html_out = f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Bite &amp; Wire</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Bite &amp; Wire">
<meta name="theme-color" content="#000000">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap">
<style>
{css}
</style>

<div id="app">
  <header id="app-header">
    <div class="row">
      <h1>Bite &amp; Wire</h1>
      <span class="updated">{generated_str}</span>
    </div>
    <div class="subtitle">Noticias de IA · Impacto · Oportunidades de negocio</div>
  </header>

  <main>
    <section class="screen" data-tab="hoy" hidden>
      <div class="hero">
        <div class="glow"></div>
        <div class="label">Radar de IA</div>
        <div class="value serif" id="hero-value">—</div>
        <div class="sub" id="hero-sub">Cargando…</div>
      </div>
      <div class="stat-row">
        <div class="stat-chip"><div class="n tabular" id="stat-total">–</div><div class="l">Noticias</div></div>
        <div class="stat-chip"><div class="n tabular" id="stat-sources">–</div><div class="l">Fuentes</div></div>
        <div class="stat-chip"><div class="n tabular" id="stat-opportunities">–</div><div class="l">Oportunidades</div></div>
        <div class="stat-chip"><div class="n tabular" id="stat-topimpact">–</div><div class="l">Alto impacto</div></div>
      </div>
      <div class="section-title">Resumen de hoy</div>
      <div id="resumen-cards"></div>
      <p style="font-size:11.5px;color:var(--ink-soft);line-height:1.4;margin:6px 4px 0">Los titulares se muestran en su idioma original (no se traducen) — la frase en español de arriba de cada uno resume por qué se eligió, extraída de los datos, no del contenido completo del artículo.</p>
      <div class="section-title">Lo más impactante</div>
      <div class="list" id="impact-list"></div>
      <div class="disclaimer" style="margin-top:18px"><span class="ic">ⓘ</span><div><b>Curado automáticamente.</b> El "impacto" se calcula por palabras clave, cuántas fuentes cubren la misma noticia y (cuando aplica) el interés real en Hacker News — no es un juicio editorial humano.</div></div>
    </section>

    <section class="screen" data-tab="noticias" hidden>
      <div class="section-title" style="margin-top:4px">Filtrar por tema</div>
      <div class="chip-row" id="news-chip-row"></div>
      <div class="list" id="news-list"></div>
    </section>

    <section class="screen" data-tab="oportunidades" hidden>
      <p style="font-size:12.5px;color:var(--ink-soft);line-height:1.4;margin:4px 4px 14px">Noticias que suelen señalar una posibilidad concreta de negocio: herramientas nuevas de acceso abierto o gratuito, programas de financiamiento/aceleración, huecos de mercado, precios más accesibles. Es informativo — no es una recomendación de inversión ni una garantía de que la oportunidad sea real o viable.</p>
      <div class="list" id="opportunities-list"></div>
    </section>
  </main>

  <nav id="tabbar">{tabbar_html}</nav>

  <footer class="legal">Bite &amp; Wire · fuentes: Google News, TechCrunch, The Verge, MIT Technology Review, Ars Technica, VentureBeat, Hacker News, arXiv</footer>
</div>

<script>
window.__DATA__ = {data_json};
</script>
<script>
{js}
</script>
"""

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        f.write(html_out)

    print(f"Dashboard generado en {OUTPUT_PATH} ({len(html_out)/1024:.0f} KB)")
    return OUTPUT_PATH


if __name__ == "__main__":
    build_dashboard()
