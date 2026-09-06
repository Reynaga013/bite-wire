// Bite & Wire — render 100% client-side a partir de window.__DATA__
// (mismo patrón que Whale & Wire: un shell HTML + JS vanilla que pinta
// las listas, sin pre-renderizar cada vista en Python).
(function () {
  "use strict";
  var D = window.__DATA__ || {};

  var TOPIC_LABELS = {
    financiamiento: "Financiamiento",
    regulacion: "Regulación",
    investigacion: "Investigación",
    negocio: "Negocio",
    producto: "Producto y lanzamientos",
  };
  var TOPIC_ORDER = ["financiamiento", "regulacion", "investigacion", "negocio", "producto"];

  function esc(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function timeAgo(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var diffMs = Date.now() - d.getTime();
    var mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return mins + " min";
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + " h";
    var days = Math.floor(hrs / 24);
    return days + " d";
  }

  function sourcesLine(item) {
    var srcs = item.sources || [];
    var extra = item.cross_source_count > srcs.length ? "" : "";
    var label = srcs.slice(0, 2).join(", ");
    if (srcs.length > 2) label += " +" + (srcs.length - 2);
    return label;
  }

  function newsRow(item, opts) {
    opts = opts || {};
    var topicLabel = TOPIC_LABELS[item.topic] || "";
    var badges = "";
    if (opts.showTopic && topicLabel) {
      badges += '<span class="badge accent">' + esc(topicLabel) + "</span>";
    }
    if (item.cross_source_count > 1) {
      badges += '<span class="badge neu">' + item.cross_source_count + " fuentes</span>";
    }
    var eng = item.engagement;
    var engLine = "";
    if (eng && (eng.points || eng.comments)) {
      engLine = '<span>▲ ' + (eng.points || 0) + " · " + (eng.comments || 0) + " coment.</span>";
    }
    return (
      '<a class="row" href="' + esc(item.link) + '" target="_blank" rel="noopener noreferrer" style="display:block;padding:12px 14px">' +
        '<div class="title">' + esc(item.title) + "</div>" +
        '<div class="meta">' +
          '<span>' + esc(sourcesLine(item)) + '</span>' +
          (item.published ? '<span>· ' + timeAgo(item.published) + '</span>' : '') +
          engLine +
          badges +
        "</div>" +
      "</a>"
    );
  }

  function renderList(elId, items, opts) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = '<div class="empty-state">Nada por aquí en este ciclo.</div>';
      return;
    }
    el.innerHTML = items.map(function (it) { return newsRow(it, opts); }).join("");
  }

  function resumenCard(entry) {
    if (!entry) return "";
    var extraBadge = entry.extra
      ? '<span class="badge gold" style="margin-left:6px;vertical-align:middle">' + esc(entry.extra) + "</span>"
      : "";
    return (
      '<a class="card" href="' + esc(entry.link) + '" target="_blank" rel="noopener noreferrer" ' +
        'style="display:block;margin-bottom:10px;text-decoration:none;color:inherit">' +
        '<div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--accent)">' +
          esc(entry.kicker || "") + extraBadge +
        "</div>" +
        '<div class="title" style="font-size:15px;font-weight:600;line-height:1.35;color:var(--ink);margin-top:5px">' +
          esc(entry.title) +
        "</div>" +
        '<div class="meta" style="font-size:12px;color:var(--ink-soft);margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
          "<span>" + esc(sourcesLine(entry)) + "</span>" +
          (entry.published ? "<span>· " + timeAgo(entry.published) + "</span>" : "") +
        "</div>" +
      "</a>"
    );
  }

  function renderResumen() {
    var el = document.getElementById("resumen-cards");
    if (!el) return;
    var r = D.resumen || {};
    var order = ["importante", "nuevo", "mas_caro", "deberias_saber"];
    var html = order.map(function (k) { return resumenCard(r[k]); }).join("");
    if (!html) {
      el.innerHTML = '<div class="empty-state">Sin resumen disponible en este ciclo.</div>';
      return;
    }
    el.innerHTML = html;
  }

  function renderHoy() {
    var stats = D.stats || {};
    var topImpact = D.top_impact || [];
    var heroValue = document.getElementById("hero-value");
    var heroSub = document.getElementById("hero-sub");
    if (heroValue) {
      heroValue.textContent = topImpact.length ? (topImpact.length + " noticias clave") : "Sin novedades";
    }
    if (heroSub) {
      var topics = stats.topics || {};
      var topTopic = Object.keys(topics).sort(function (a, b) { return (topics[b] || 0) - (topics[a] || 0); })[0];
      heroSub.textContent = "De " + (stats.total_items || 0) + " noticias analizadas · " + (stats.sources || 0) + " fuentes";
    }
    var setStat = function (id, val) { var e = document.getElementById(id); if (e) e.textContent = val; };
    setStat("stat-total", stats.total_items || 0);
    setStat("stat-sources", stats.sources || 0);
    setStat("stat-opportunities", stats.opportunities || 0);
    setStat("stat-topimpact", topImpact.length || 0);

    renderList("impact-list", topImpact, { showTopic: true });
  }

  var currentTopicFilter = "todas";

  function renderNoticias() {
    var chipRow = document.getElementById("news-chip-row");
    if (chipRow && !chipRow.dataset.built) {
      var chips = ['<button class="chip active" data-topic="todas">Todas</button>'];
      TOPIC_ORDER.forEach(function (t) {
        chips.push('<button class="chip" data-topic="' + t + '">' + esc(TOPIC_LABELS[t]) + "</button>");
      });
      chipRow.innerHTML = chips.join("");
      chipRow.dataset.built = "1";
      chipRow.addEventListener("click", function (e) {
        var btn = e.target.closest(".chip");
        if (!btn) return;
        currentTopicFilter = btn.dataset.topic;
        Array.prototype.forEach.call(chipRow.querySelectorAll(".chip"), function (c) {
          c.classList.toggle("active", c === btn);
        });
        renderNoticiasList();
      });
    }
    renderNoticiasList();
  }

  function renderNoticiasList() {
    var all = D.all_items || [];
    var filtered = currentTopicFilter === "todas" ? all : all.filter(function (it) { return it.topic === currentTopicFilter; });
    renderList("news-list", filtered, { showTopic: currentTopicFilter === "todas" });
  }

  function renderOportunidades() {
    renderList("opportunities-list", D.opportunities || []);
  }

  function initTabs() {
    var buttons = document.querySelectorAll(".tab-btn");
    var screens = document.querySelectorAll(".screen");
    function activate(tab) {
      buttons.forEach(function (b) { b.classList.toggle("active", b.dataset.tab === tab); });
      screens.forEach(function (s) {
        var match = s.dataset.tab === tab;
        s.hidden = !match;
        if (match) { s.classList.remove("enter"); void s.offsetWidth; s.classList.add("enter"); }
      });
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { activate(b.dataset.tab); });
    });
    activate("hoy");
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderResumen();
    renderHoy();
    renderNoticias();
    renderOportunidades();
    initTabs();
  });
})();
