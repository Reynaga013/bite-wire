#!/usr/bin/env python3
"""
translator.py
Traduce título y resumen de cada noticia del inglés al español usando
deep-translator (scraping gratuito de Google Translate, sin API key y sin
costo — importante porque el usuario eligió explícitamente el enfoque
"sin costo" para todo Bite & Wire, y esto no cambia esa decisión).

Se guarda una cache en disco (data/translation_cache.json) por
link+campo, porque el pipeline corre cada 4 horas y muchos artículos
siguen "vivos" varios días dentro de la ventana de MAX_AGE_DAYS —
sin cache, cada corrida tendría que retraducir TODO desde cero (cientos
de llamadas cada 4 horas, para siempre), lo cual es lento y además
arriesga que Google empiece a bloquear temporalmente al runner de
GitHub Actions por exceso de requests. Con cache, en estado estable
solo se traducen los artículos genuinamente nuevos de esa corrida.

Si una traducción falla (red, bloqueo temporal, texto raro) se conserva
el texto original en inglés para ese item — nunca se rompe el pipeline
por esto, y el usuario simplemente ve ese titular en inglés esta vez.
"""
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from deep_translator import GoogleTranslator
except ImportError:  # pragma: no cover - solo si falta instalar la dependencia
    GoogleTranslator = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_PATH = os.path.join(BASE_DIR, "data", "translation_cache.json")

REQUEST_DELAY = 0.35  # segundos de cortesía antes de cada llamada -- no es una
                       # API oficial, hay que ser conservador para no parecer
                       # abuso, incluso corriendo varias en paralelo.
MAX_WORKERS = 6  # traducciones en paralelo -- suficiente para que una corrida
                 # sin nada en cache (cientos de artículos) no tarde una
                 # eternidad, sin bombardear el endpoint gratuito de golpe.
MAX_CACHE_ENTRIES = 6000  # tope para que el archivo no crezca sin límite

_available = None


def _translator_available():
    """Solo confirma que se puede construir un GoogleTranslator -- cada
    llamada real crea su propia instancia (ver _worker) porque
    GoogleTranslator.translate() muta un dict interno compartido
    (self._url_params) en cada llamada, lo cual no es seguro para varios
    hilos usando la MISMA instancia a la vez (se vio en pruebas: con una
    instancia compartida en paralelo, la mayoría de las traducciones salían
    mal por una carrera de datos ahí adentro)."""
    global _available
    if _available is None:
        if GoogleTranslator is None:
            _available = False
        else:
            try:
                GoogleTranslator(source="en", target="es")
                _available = True
            except Exception:
                _available = False
    return _available


def _new_translator():
    return GoogleTranslator(source="en", target="es")


def _load_cache():
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_cache(cache):
    if len(cache) > MAX_CACHE_ENTRIES:
        # se queda con las entradas más recientes (los dicts de Python
        # preservan el orden de inserción desde 3.7)
        cache = dict(list(cache.items())[-MAX_CACHE_ENTRIES:])
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, ensure_ascii=False)
    return cache


MAX_ATTEMPTS = 3  # el scraping gratuito falla bastante seguido bajo carga
                  # concurrente (visto en pruebas: ~35-40% de las llamadas
                  # devuelven "TranslationNotFound" al correr varias a la vez,
                  # aunque el mismo texto sí traduce bien en un segundo
                  # intento) -- reintentar unas pocas veces con una nueva
                  # instancia y una pequeña espera resuelve casi todos esos
                  # casos sin tener que bajarle mucho a la concurrencia.


def _translate_one(text):
    text = (text or "").strip()
    if not text:
        return text, True
    for attempt in range(MAX_ATTEMPTS):
        try:
            out = _new_translator().translate(text)
            if out and out.strip():
                return out.strip(), True
        except Exception:
            pass
        if attempt < MAX_ATTEMPTS - 1:
            time.sleep(0.6 * (attempt + 1))
    return text, False


def translate_items(items, fields=("title", "summary")):
    """Traduce in-place los campos indicados de cada item (dict) al español.
    Antes de sobreescribir guarda el original en inglés bajo '<campo>_en'
    (necesario, por ejemplo, para que la extracción de montos en dinero siga
    funcionando sobre el texto en inglés). Devuelve (items, traducidos_nuevos,
    fallidos, cache_hits)."""
    if not _translator_available():
        print("  [aviso] deep-translator no disponible -- se deja todo en inglés esta corrida")
        for it in items:
            for field in fields:
                it[f"{field}_en"] = it.get(field, "")
        return items, 0, 0, 0

    cache = _load_cache()
    translated_new = 0
    failed = 0
    cache_hits = 0

    # primero resuelve lo que ya está en cache (instantáneo, sin red) y junta
    # en una lista aparte solo lo que de verdad necesita traducirse.
    pending = []
    for it in items:
        key_base = it.get("link") or it.get("title", "")
        for field in fields:
            original = it.get(field, "")
            it[f"{field}_en"] = original
            if not original:
                continue
            cache_key = f"{key_base}::{field}"
            if cache_key in cache:
                it[field] = cache[cache_key]
                cache_hits += 1
                continue
            pending.append((it, field, cache_key, original))

    def _worker(task):
        it, field, cache_key, original = task
        time.sleep(REQUEST_DELAY)
        translated, ok = _translate_one(original)
        return it, field, cache_key, original, translated, ok

    if pending:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = [pool.submit(_worker, task) for task in pending]
            for fut in as_completed(futures):
                it, field, cache_key, original, translated, ok = fut.result()
                it[field] = translated
                if ok:
                    cache[cache_key] = translated
                    if translated != original:
                        translated_new += 1
                else:
                    failed += 1

    _save_cache(cache)
    return items, translated_new, failed, cache_hits


if __name__ == "__main__":
    sample = [
        {"title": "OpenAI raises $6.6 billion in new funding round", "summary": "The company said the funds will go toward compute.", "link": "https://example.com/a"},
        {"title": "Small startup launches free open-source AI toolkit", "summary": "", "link": "https://example.com/b"},
    ]
    out, new_n, fail_n, hit_n = translate_items(sample)
    for it in out:
        print(it["title"], "|", it["summary"])
    print("nuevos:", new_n, "fallidos:", fail_n, "cache:", hit_n)
