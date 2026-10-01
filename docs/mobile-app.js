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

/* UI EXPERIENCE */
/* Feedback visual: sin peticiones de red, almacenamiento ni cambios en los datos. */
(() => {
 'use strict';
 const script=document.currentScript,app=script?.dataset.app;
 if(!app)return;
 const root=document.documentElement;root.dataset.uiApp=app;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const layouts={
  pulso:{surface:'.lead,.signal-note,.watchlist,.history-card,.settings-panel,.idea-card,.story,.login',lift:'.signal-note,.story',row:'.stock,.mover,.search-result',tabs:'.tabs,.range-options,.news-switch,.news-languages,.ticker-filter',nav:'.mobile-tabs',sheet:'dialog,.modal'},
  radar:{surface:'.featured,.topic-tile,.growth-detail,.install-panel',lift:'.topic-tile',row:'.story:not(.featured),.setting-row',tabs:'.quick-topics,.growth-filters,.language-choice',nav:'.bottom-nav,.desktop-rail',sheet:'dialog'},
  panel:{surface:'.tarjeta,.caja-login',lift:'.fichas .tarjeta',row:'tbody tr',tabs:'.segmentado,.suite-nav',nav:'.suite-nav',sheet:'dialog'},
  celaje:{surface:'.card,.detail-panel,.focus-panel,.agenda-preview,.appointment',lift:'.feature-bento .detail-panel,.card',row:'.service',tabs:'.slots,.tabs,.ios-tabs',nav:'.nav,.ios-app-nav',sheet:'dialog,.sheet'},
  ayudaya:{surface:'.card,.stat,.how-card,.opportunity-window',lift:'.how-card',row:'tbody tr,.result-item',tabs:'.tabs',nav:'.workspace-nav',sheet:'dialog'},
  gasoya:{surface:'.card,.panel',lift:'.card',row:'',tabs:'.segmented,.chip-row',nav:'.tabbar-inner',sheet:'dialog'},
  luzya:{surface:'.hero,.summary-card,.glass',lift:'.summary-card',row:'',tabs:'.segmented',nav:'.tabbar-inner',sheet:'dialog'},
  calendario:{surface:'.cal-card,.day-card,.auth-card',lift:'',row:'.client-row',tabs:'.month-nav',nav:'',sheet:'.sheet'},
  condufy:{surface:'.daily,.review-card,.shop-item,.track-card,.confirm-card,.login-head',lift:'.review-card,.track-card',row:'.friend-row,.leaderboard-row,.node',tabs:'.auth-tabs',nav:'.nav',sheet:'.sheet,.modal'},
  whale:{surface:'.hero,.list,.stat-chip',lift:'.stat-chip',row:'.news-row,.list-row,.radar-row',tabs:'.segmented,.chip-row',nav:'#tabbar',sheet:'.sheet'},
  bite:{surface:'.hero,.list,.stat-chip',lift:'.stat-chip',row:'.news-row,.list-row,.impact-row',tabs:'.chip-row',nav:'#tabbar',sheet:'.sheet'},
  neto:{surface:'.mc-card,.mc-balance-card,.mc-budget-card,.mc-fixed-card,.mc-detail-chart-card,.mc-auth-card',lift:'.mc-budget-card,.mc-fixed-card',row:'.mc-tx-row,.mc-analysis-row',tabs:'.mc-segmented,.mc-filter-bar,.mc-detail-range-track',nav:'.mc-tabbar',sheet:'.mc-modal'}
 };
 const layout=layouts[app];if(!layout)return;
 const marked=new WeakSet();let reveal;
 if('IntersectionObserver' in window&&!reduced.matches)reveal=new IntersectionObserver(entries=>{
  let index=0;
  for(const entry of entries)if(entry.isIntersecting){
   const el=entry.target;reveal.unobserve(el);
   // Las tarjetas que ya tienen una entrada propia la conservan.
   if(getComputedStyle(el).animationName==='none'&&!el.hasAttribute('data-reveal')){
    el.style.setProperty('--ui-delay',Math.min(index++,3)*45+'ms');el.classList.add('ui-arrive');
    el.addEventListener('animationend',()=>{el.classList.remove('ui-arrive');el.style.removeProperty('--ui-delay')},{once:true});
   }
  }
 },{threshold:.025});
 function mark(container){
  if(!(container instanceof Element))return;
  for(const [kind,selector] of Object.entries(layout)){
   if(!selector)continue;
   const nodes=[...(container.matches(selector)?[container]:[]),...container.querySelectorAll(selector)];
   for(const el of nodes){
    const key=kind==='surface'?'surface':kind;el.classList.add('ui-'+key);
    if(kind==='surface'&&!marked.has(el)){marked.add(el);reveal?.observe(el)}
   }
  }
  if(app==='condufy')for(const el of [...(container.matches('.node.clickable,.daily,.review-card')?[container]:[]),...container.querySelectorAll('.node.clickable,.daily,.review-card')]){
   if(el.matches('button,a,[role=button]'))continue;
   el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label',el.querySelector('.n-label,.t,.review-t')?.textContent||el.textContent.trim());
   el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();el.click()}});
  }
 }
 function init(){
  mark(document.body);
  const pending=new Set();let frame=0;
  new MutationObserver(records=>{
   for(const record of records)for(const node of record.addedNodes)if(node instanceof Element)pending.add(node);
   if(pending.size&&!frame)frame=requestAnimationFrame(()=>{frame=0;for(const node of pending)if(node.isConnected)mark(node);pending.clear()});
  }).observe(document.body,{childList:true,subtree:true});
  const pressed=new Set();
  function release(){for(const el of pressed)el.classList.remove('ui-press');pressed.clear()}
  document.addEventListener('pointerdown',event=>{
   if(event.button!==0||reduced.matches)return;
   const el=event.target.closest('button,a,summary,[role=button]');
   if(!el||el.matches(':disabled')||el.closest('.app-launch,#splash'))return;
   release();el.classList.add('ui-press');pressed.add(el);
  },{passive:true});
  document.addEventListener('pointerup',release,{passive:true});document.addEventListener('pointercancel',release,{passive:true});window.addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release()});
  reduced.addEventListener('change',event=>{if(event.matches){release();reveal?.disconnect();document.querySelectorAll('.ui-arrive').forEach(el=>el.classList.remove('ui-arrive'))}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
