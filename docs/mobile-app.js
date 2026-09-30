/* Compartido entre apps; sincronizar con sync-mobile-ui.py. Sin red ni datos personales. */
(() => {
  'use strict';
  const script = document.currentScript;
  const app = script?.dataset.app || '';
  const native = script?.dataset.startup === 'native';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (app === 'condufy') document.documentElement.classList.add('launch-native-condufy');

  if (app === 'pulso' && window.visualViewport) {
    const fitViewport = () => {
      if (window.visualViewport.scale > 1.01) return;
      document.documentElement.style.setProperty('--app-visible-height', window.visualViewport.height + 'px');
    };
    window.visualViewport.addEventListener('resize', fitViewport);
    window.addEventListener('orientationchange', fitViewport);
    fitViewport();
  }

  // Safari ignora user-scalable en algunos modos. Pan de un dedo sigue disponible.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(type => document.addEventListener(type, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  let lastTap = null;
  document.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    if (!t || e.touches.length || e.target.closest('button,a,input,textarea,select,[contenteditable],label,[role=button]') || !window.getSelection()?.isCollapsed) { lastTap = null; return; }
    const now = performance.now();
    if (lastTap && now - lastTap.time < 300 && Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y) < 24) { e.preventDefault(); lastTap = null; }
    else lastTap = { time: now, x: t.clientX, y: t.clientY };
  }, { passive: false });

  const shapes = {
    pulso: '<path d="M6 56h24l12-23 15 46 12-23h37"/>',
    radar: '<circle cx="56" cy="56" r="40"/><circle cx="56" cy="56" r="24" opacity=".4"/><path class="launch-sweep" d="M56 56 84 28"/><circle cx="72" cy="43" r="4" fill="currentColor" stroke="none"/>',
    neto: '<circle cx="56" cy="56" r="40"/><path d="M40 74V38l32 36V38"/>',
    celaje: '<rect x="22" y="27" width="68" height="63" rx="17"/><path d="M38 20v18m36-18v18M23 47h66"/><path class="launch-check" d="m40 68 11 11 22-22"/>',
    calendario: '<rect x="22" y="27" width="68" height="63" rx="17"/><path d="M38 20v18m36-18v18M23 47h66"/><path class="launch-check" d="M36 61h3m14 0h3m14 0h3M36 75h3m14 0h3"/><rect x="66" y="69" width="15" height="14" rx="4" fill="currentColor" stroke="none"/>',
    gasoya: '<path d="M27 87V34a9 9 0 0 1 9-9h23a9 9 0 0 1 9 9v53M23 87h49M37 37h20v19H37z"/><path class="launch-route" d="m69 39 12 12v25a6 6 0 0 0 12 0V47l-12-12"/>',
    luzya: '<circle cx="56" cy="56" r="21"/><g class="launch-rays"><path d="M56 11v12m0 66v12M11 56h12m66 0h12M24 24l9 9m46 46 9 9M24 88l9-9m46-46 9-9"/></g>',
    panel: '<rect class="launch-bar" x="24" y="53" width="15" height="35" rx="5" fill="currentColor" stroke="none"/><rect class="launch-bar" x="49" y="25" width="15" height="63" rx="5" fill="currentColor" stroke="none"/><rect class="launch-bar" x="74" y="40" width="15" height="48" rx="5" fill="currentColor" stroke="none"/>',
    ayudaya: '<path d="M35 84V34a12 12 0 0 1 12-12h32v62H35Zm0-33H23v33h12M48 38h17m-17 14h17m-17 14h17"/><path class="launch-spark" d="m83 22 3-10 3 10 10 3-10 3-3 10-3-10-10-3Z"/>',
    typefy: '<path d="m40 30-25 26 25 26m32-52 25 26-25 26M64 22 48 90"/>',
    investa: '<path d="M23 86V54m22 32V41m22 45V25m22 61V16M16 94h82"/>',
  };
  /* START LOGOS */
  const logos = {"pulso":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" class=\"logo-art\" aria-hidden=\"true\"><rect width=\"512\" height=\"512\" rx=\"110\" fill=\"#0c1319\" /><path d=\"M82 262h92l43-86 73 162 48-93h92\" fill=\"none\" stroke=\"#6de5b7\" stroke-width=\"28\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"launch-trace\" pathLength=\"1\" /><circle cx=\"429\" cy=\"245\" r=\"16\" fill=\"#6de5b7\" class=\"launch-node\" /></svg>","radar":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" class=\"logo-art\" aria-hidden=\"true\">\n  <rect width=\"512\" height=\"512\" rx=\"114\" fill=\"#284de0\" />\n  <circle cx=\"256\" cy=\"256\" r=\"141\" fill=\"none\" stroke=\"#fff\" stroke-width=\"25\" opacity=\".42\" class=\"launch-radar-ring\" style=\"--ring:0\" />\n  <circle cx=\"256\" cy=\"256\" r=\"87\" fill=\"none\" stroke=\"#fff\" stroke-width=\"25\" opacity=\".78\" class=\"launch-radar-ring\" style=\"--ring:1\" />\n  <path d=\"M256 256V102\" stroke=\"#fff\" stroke-width=\"27\" stroke-linecap=\"round\" class=\"launch-beam\" />\n  <circle cx=\"256\" cy=\"256\" r=\"25\" fill=\"#fff\" />\n</svg>","calendario":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" class=\"logo-art\" aria-hidden=\"true\">\n  <defs>\n    <linearGradient id=\"launch-calendario-bg\" gradientUnits=\"userSpaceOnUse\" x1=\"0\" y1=\"0\" x2=\"100\" y2=\"100\">\n      <stop offset=\"0\" stop-color=\"#3FA9FF\" />\n      <stop offset=\"0.55\" stop-color=\"#0A6CFF\" />\n      <stop offset=\"1\" stop-color=\"#0027A8\" />\n    </linearGradient>\n  </defs>\n  <rect width=\"100\" height=\"100\" fill=\"url(#launch-calendario-bg)\" />\n  <g>\n    <rect x=\"35\" y=\"17\" width=\"8\" height=\"17\" rx=\"3\" fill=\"#ffffff\" />\n    <rect x=\"57\" y=\"17\" width=\"8\" height=\"17\" rx=\"3\" fill=\"#ffffff\" />\n    <rect x=\"24\" y=\"27\" width=\"52\" height=\"52\" rx=\"10\" fill=\"#ffffff\" />\n    <rect x=\"30\" y=\"39\" width=\"40\" height=\"7\" rx=\"3.5\" fill=\"#0A6CFF\" />\n    <rect x=\"42\" y=\"54\" width=\"16\" height=\"16\" rx=\"4\" fill=\"#30D158\" class=\"launch-day\" />\n  </g>\n</svg>","luzya":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" class=\"logo-art\" aria-hidden=\"true\">\n  <defs>\n    <linearGradient id=\"launch-luzya-bg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">\n      <stop offset=\"0\" stop-color=\"#B794F6\" />\n      <stop offset=\"0.55\" stop-color=\"#8B5CF6\" />\n      <stop offset=\"1\" stop-color=\"#341068\" />\n    </linearGradient>\n    <linearGradient id=\"launch-luzya-sheen\" x1=\"0\" y1=\"0\" x2=\"0.7\" y2=\"1\">\n      <stop offset=\"0\" stop-color=\"#ffffff\" stop-opacity=\"0.55\" />\n      <stop offset=\"0.45\" stop-color=\"#ffffff\" stop-opacity=\"0.08\" />\n      <stop offset=\"1\" stop-color=\"#ffffff\" stop-opacity=\"0\" />\n    </linearGradient>\n    <linearGradient id=\"launch-luzya-spark\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">\n      <stop offset=\"0\" stop-color=\"#5EEAD4\" />\n      <stop offset=\"1\" stop-color=\"#0FBF95\" />\n    </linearGradient>\n    <filter id=\"launch-luzya-soft\" x=\"-50%\" y=\"-50%\" width=\"200%\" height=\"200%\">\n      <feDropShadow dx=\"0\" dy=\"10\" stdDeviation=\"14\" flood-color=\"#1E0A42\" flood-opacity=\"0.4\" />\n    </filter>\n  </defs>\n\n  \n  <rect x=\"0\" y=\"0\" width=\"512\" height=\"512\" fill=\"url(#launch-luzya-bg)\" />\n\n  \n  <ellipse cx=\"150\" cy=\"90\" rx=\"260\" ry=\"180\" fill=\"url(#launch-luzya-sheen)\" />\n\n  \n  <g filter=\"url(#launch-luzya-soft)\">\n    <path d=\"M 292 84              L 178 296              L 246 296              L 210 434              L 348 216              L 274 216              Z\" fill=\"#ffffff\" class=\"launch-bolt\" />\n  </g>\n\n  \n  <path d=\"M 372 372            C 372 350 402 322 402 322            C 402 322 432 350 432 372            C 432 389.5 418.5 403 402 403            C 385.5 403 372 389.5 372 372 Z\" fill=\"url(#launch-luzya-spark)\" class=\"launch-energy\" />\n  <path d=\"M 388 376 C 388 366 396 356 396 356\" stroke=\"#ffffff\" stroke-opacity=\"0.55\" stroke-width=\"7\" stroke-linecap=\"round\" fill=\"none\" />\n</svg>","whale":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" class=\"logo-art\" aria-hidden=\"true\">\n  <defs>\n    <linearGradient id=\"launch-whale-bg\" x1=\"15%\" y1=\"0%\" x2=\"85%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#2C2C2E\" />\n      <stop offset=\"100%\" stop-color=\"#000000\" />\n    </linearGradient>\n  </defs>\n\n  <rect width=\"512\" height=\"512\" fill=\"url(#launch-whale-bg)\" />\n\n  \n  <g class=\"launch-fluke\"><g transform=\"translate(70,58) scale(3.75)\">\n    <path d=\"M 50 92              C 47 78, 43 66, 40 56              C 36 44, 26 36, 12 32              C 6 30, 3 27, 3 22              C 3 18, 6 17, 10 18              C 24 21, 36 28, 43 39              C 45 43, 44 47, 44 50              C 46 52.5, 48 53.5, 50 53.5              C 52 53.5, 54 52.5, 56 50              C 56 47, 55 43, 57 39              C 64 28, 76 21, 90 18              C 94 17, 97 18, 97 22              C 97 27, 94 30, 88 32              C 74 36, 64 44, 60 56              C 57 66, 53 78, 50 92 Z\" fill=\"#F2F2F7\" />\n  </g>\n\n  \n  </g><path d=\"M 84 296            C 136 296, 148 252, 200 260            C 250 268, 262 220, 312 232            C 350 241, 362 232, 428 236\" fill=\"none\" stroke=\"#D9A24B\" stroke-width=\"18\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"launch-wire\" pathLength=\"1\" />\n  <circle cx=\"200\" cy=\"260\" r=\"11\" fill=\"#D9A24B\" class=\"launch-node\" style=\"--node:0\" />\n  <circle cx=\"312\" cy=\"232\" r=\"11\" fill=\"#D9A24B\" class=\"launch-node\" style=\"--node:1\" />\n</svg>","bite":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" class=\"logo-art\" aria-hidden=\"true\">\n  <defs>\n    <linearGradient id=\"launch-bite-bg\" x1=\"15%\" y1=\"0%\" x2=\"85%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#2C2C2E\" />\n      <stop offset=\"100%\" stop-color=\"#000000\" />\n    </linearGradient>\n  </defs>\n\n  <rect width=\"512\" height=\"512\" fill=\"url(#launch-bite-bg)\" />\n\n  \n  <g class=\"launch-chip\"><g transform=\"translate(76,64) scale(3.6)\">\n    \n    <g stroke=\"#F2F2F7\" stroke-width=\"4.5\" stroke-linecap=\"round\">\n      <line x1=\"22\" y1=\"6\" x2=\"22\" y2=\"18\" class=\"launch-pin\" style=\"--pin:0\" />\n      <line x1=\"38\" y1=\"6\" x2=\"38\" y2=\"18\" class=\"launch-pin\" style=\"--pin:1\" />\n      <line x1=\"54\" y1=\"6\" x2=\"54\" y2=\"18\" class=\"launch-pin\" style=\"--pin:2\" />\n      <line x1=\"22\" y1=\"82\" x2=\"22\" y2=\"94\" class=\"launch-pin\" style=\"--pin:3\" />\n      <line x1=\"38\" y1=\"82\" x2=\"38\" y2=\"94\" class=\"launch-pin\" style=\"--pin:4\" />\n      <line x1=\"54\" y1=\"82\" x2=\"54\" y2=\"94\" class=\"launch-pin\" style=\"--pin:5\" />\n      <line x1=\"6\" y1=\"22\" x2=\"18\" y2=\"22\" class=\"launch-pin\" style=\"--pin:6\" />\n      <line x1=\"6\" y1=\"38\" x2=\"18\" y2=\"38\" class=\"launch-pin\" style=\"--pin:7\" />\n      <line x1=\"6\" y1=\"54\" x2=\"18\" y2=\"54\" class=\"launch-pin\" style=\"--pin:8\" />\n      <line x1=\"82\" y1=\"22\" x2=\"94\" y2=\"22\" class=\"launch-pin\" style=\"--pin:9\" />\n      <line x1=\"82\" y1=\"38\" x2=\"94\" y2=\"38\" class=\"launch-pin\" style=\"--pin:10\" />\n      <line x1=\"82\" y1=\"54\" x2=\"94\" y2=\"54\" class=\"launch-pin\" style=\"--pin:11\" />\n    </g>\n    \n    <rect x=\"18\" y=\"18\" width=\"64\" height=\"64\" rx=\"10\" fill=\"#F2F2F7\" />\n    \n    <rect x=\"34\" y=\"34\" width=\"32\" height=\"32\" rx=\"5\" fill=\"#000000\" fill-opacity=\"0.82\" class=\"launch-core\" />\n  </g>\n\n  \n  </g><path d=\"M 84 300            C 136 300, 148 256, 200 264            C 250 272, 262 224, 312 236            C 350 245, 362 236, 428 240\" fill=\"none\" stroke=\"#D9A24B\" stroke-width=\"18\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"launch-wire\" pathLength=\"1\" />\n  <circle cx=\"200\" cy=\"264\" r=\"11\" fill=\"#D9A24B\" class=\"launch-node\" style=\"--node:0\" />\n  <circle cx=\"312\" cy=\"236\" r=\"11\" fill=\"#D9A24B\" class=\"launch-node\" style=\"--node:1\" />\n</svg>"};
  /* END LOGOS */
  const brands = { pulso:['pulso','#6de5b7','#0c1319'], radar:['radar','#5487f4','#121923'], celaje:['Celaje','#0a84ff','#101722'], calendario:['Calendario de Trabajo','#30d158','#131823'], gasoya:['GasoYa','#30d158','#101b17'], luzya:['LuzYa','#b794f6','#161322'], panel:['Panel de control','#ffc24b','#131318'], ayudaya:['AyudaYa','#67d4ac','#12241c'], whale:['Whale & Wire','#d9a24b','#000'], bite:['Bite & Wire','#d9a24b','#000'] };
  const imageLogos = { gasoya:'icon-192.png', celaje:'icons/icon-192.png' };
  function symbolMarkup() {
    if (logos[app]) return logos[app];
    if (imageLogos[app]) {
      const url = new URL(imageLogos[app],script.src).href;
      return `<img class="logo-art" src="${url}" width="144" height="144" alt=""><span class="launch-orbit"></span>`;
    }
    if (app === 'ayudaya') return '<div class="launch-ay-mark">A<span>Y</span></div><span class="launch-orbit"></span>';
    return `<svg viewBox="0 0 112 112" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${shapes[app]}</svg>`;
  }

  function start() {
    const root = document.documentElement;
    const unmask = () => { root.classList.remove('app-launch-pending'); delete root.dataset.launchPending; };
    if (native || app === 'neto' || reduced.matches || !brands[app]) { unmask(); return; }
    if (root.dataset.launchPending === 'expired') { unmask(); return; }
    // Navegación multipágina: no repetir la presentación en cada sección.
    try {
      const key = 'app-launch-' + app;
      const previous = Number(sessionStorage.getItem(key));
      if (previous && Date.now()-previous < 20000) { unmask(); return; }
      sessionStorage.setItem(key, String(Date.now()));
    } catch { /* También funciona sin almacenamiento. */ }
    const [name,accent,bg] = brands[app];
    const appearance = getComputedStyle(document.body);
    const pageBackground = appearance.getPropertyValue('--bg').trim() || (appearance.backgroundColor !== 'rgba(0, 0, 0, 0)' ? appearance.backgroundColor : bg);
    const splash = document.createElement('div');
    splash.className = 'app-launch launch-' + app + ' is-preparing';
    splash.setAttribute('aria-hidden','true');
    splash.style.setProperty('--launch-bg',pageBackground);
    // Usar el token de tinta; Safari puede devolver negro durante la primera pintura.
    const ink = app === 'pulso' ? '#f3f7f5' : appearance.getPropertyValue('--ink').trim() || appearance.getPropertyValue('--text-primary').trim() || appearance.color;
    splash.style.setProperty('--launch-ink',ink);
    splash.style.setProperty('--launch-accent',accent);
    // Solo nombres y SVG estáticos de esta tabla, nunca contenido de usuarios.
    splash.innerHTML = `<div class="app-launch-symbol">${symbolMarkup()}</div><div class="app-launch-name">${name}<span>.</span></div>`;
    document.body.appendChild(splash);
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      unmask();
      splash.classList.add('is-leaving');
      setTimeout(() => splash.remove(),230);
    };
    // Dos frames: pintar la portada antes de contar su duración. El trabajo de
    // inicio de la app no consume el tiempo de la animación en un móvil lento.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (removed) return;
      splash.classList.remove('is-preparing');
      setTimeout(remove,app === 'panel' ? 850 : app === 'radar' ? 2450 : 1650);
    }));
    setTimeout(remove,5000);
    reduced.addEventListener('change', e => { if (e.matches) remove(); }, { once:true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
