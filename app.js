/* Freaks & Geeks rater — vanilla JS, localStorage, offline-first. */
(function () {
  "use strict";

  var STORAGE_KEY = "fng_ratings_v1";
  var RATERS = [
    { key: "clark", label: "Clark" },
    { key: "angie", label: "Angie" },
  ];
  var EPS = window.EPISODES || [];
  var view = "episodes";
  var hasViewTransitions = typeof document.startViewTransition === "function";

  // ---- state ----
  function loadRatings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  var ratings = loadRatings();

  function saveRatings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
    } catch (e) {}
  }

  function getRating(n, who) {
    return ratings[n] && typeof ratings[n][who] === "number" ? ratings[n][who] : null;
  }
  function setRating(n, who, val) {
    if (!ratings[n]) ratings[n] = {};
    if (val === null) delete ratings[n][who];
    else ratings[n][who] = val;
    saveRatings();
  }
  function bothRated(n) {
    return getRating(n, "clark") !== null && getRating(n, "angie") !== null;
  }
  function verdict(n) {
    if (!bothRated(n)) return null;
    return (getRating(n, "clark") + getRating(n, "angie")) / 2;
  }
  function fmt(v) {
    if (v === null || v === undefined) return "–";
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  function haptic(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms || 8); } catch (e) {}
    }
  }

  // ---- DOM helpers ----
  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }
  function sym(name, cls) {
    var s = el("span", "material-symbols-rounded" + (cls ? " " + cls : ""));
    s.textContent = name;
    s.setAttribute("aria-hidden", "true");
    return s;
  }

  // ---- star rendering ----
  function starState(v, idx) {
    if (v >= idx) return "full";
    if (v >= idx - 0.5) return "half";
    return "empty";
  }
  function starGlyph(state) {
    if (state === "full") return { name: "star", filled: true };
    if (state === "half") return { name: "star_half", filled: true };
    return { name: "star", filled: false };
  }
  function paintStar(starEl, state) {
    var g = starGlyph(state);
    var icon = starEl.firstChild;
    if (!icon) {
      icon = el("span", "material-symbols-rounded" + (g.filled ? " filled" : ""));
      icon.setAttribute("aria-hidden", "true");
      starEl.appendChild(icon);
    } else {
      icon.className = "material-symbols-rounded" + (g.filled ? " filled" : "");
    }
    icon.textContent = g.name;
  }
  function paintStars(wrap, value) {
    var v = value == null ? 0 : value;
    var stars = wrap.querySelectorAll(".star");
    for (var i = 0; i < stars.length; i++) {
      paintStar(stars[i], starState(v, i + 1));
    }
    wrap.setAttribute("aria-valuenow", String(v));
  }

  function buildStars(value, opts) {
    opts = opts || {};
    var cls = "stars" + (opts.mini ? " mini-stars" : "") + (opts.editable ? " editable" : "");
    var wrap = el("div", cls);
    for (var i = 1; i <= 10; i++) {
      var star = el("span", "star");
      star.dataset.idx = String(i);
      wrap.appendChild(star);
    }
    paintStars(wrap, value);
    if (opts.editable) {
      wrap.setAttribute("role", "slider");
      wrap.setAttribute("aria-valuemin", "0");
      wrap.setAttribute("aria-valuemax", "10");
      wrap.setAttribute("aria-label", opts.ariaLabel || "Rating");
      wrap.setAttribute("tabindex", "0");
      attachDrag(wrap, value, opts.onSet);
    }
    return wrap;
  }

  function attachDrag(wrap, initialVal, onSet) {
    var dragging = false;
    var lastSnap = null;
    var initial = initialVal == null ? null : initialVal;

    function valueFromX(clientX) {
      var rect = wrap.getBoundingClientRect();
      // Compute against the actual stars area (ignore wrap padding edges visually).
      var x = clientX - rect.left;
      var w = rect.width;
      var raw = (x / w) * 10;
      var v = Math.round(raw * 2) / 2;
      if (v < 0) v = 0;
      if (v > 10) v = 10;
      return v;
    }
    function move(clientX) {
      var v = valueFromX(clientX);
      if (v !== lastSnap) {
        lastSnap = v;
        paintStars(wrap, v);
        haptic(7);
      }
    }
    wrap.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      lastSnap = null;
      wrap.classList.add("is-dragging");
      try { wrap.setPointerCapture(e.pointerId); } catch (e2) {}
      move(e.clientX);
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      e.stopPropagation();
      move(e.clientX);
    });
    function release(e) {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove("is-dragging");
      if (e) {
        try { wrap.releasePointerCapture(e.pointerId); } catch (e2) {}
      }
      var final = lastSnap;
      if (final === null) return;
      if (final !== initial) {
        haptic(14);
        onSet(final === 0 ? null : final);
      }
    }
    wrap.addEventListener("pointerup", function (e) {
      e.stopPropagation();
      release(e);
    });
    wrap.addEventListener("pointercancel", release);
    wrap.addEventListener("lostpointercapture", function () {
      if (dragging) { dragging = false; wrap.classList.remove("is-dragging"); }
    });

    // Keyboard support
    wrap.addEventListener("keydown", function (e) {
      var cur = parseFloat(wrap.getAttribute("aria-valuenow") || "0");
      var next = cur;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(10, cur + 0.5);
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(0, cur - 0.5);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = 10;
      else return;
      e.preventDefault();
      e.stopPropagation();
      paintStars(wrap, next);
      haptic(7);
      onSet(next === 0 ? null : next);
    });

    // Stop card-head click toggle when interacting with stars
    wrap.addEventListener("click", function (e) { e.stopPropagation(); });
  }

  // ---- episode card ----
  function episodeCard(ep, rankNumber, animDelay) {
    var card = el("div", "card");
    card.dataset.n = ep.n;
    card.style.viewTransitionName = "ep-" + ep.n;
    if (animDelay) card.style.animationDelay = animDelay + "ms";

    var head = el("div", "card-head");

    var thumbWrap = el("div", "thumb-wrap");
    var img = el("img", "thumb");
    img.src = ep.still;
    img.alt = ep.title + " still";
    img.loading = "lazy";
    thumbWrap.appendChild(img);
    var thumbEpno = el("div", "thumb-epno");
    thumbEpno.innerHTML = "Ep <b>" + ep.n + "</b>";
    thumbWrap.appendChild(thumbEpno);
    head.appendChild(thumbWrap);

    var meta = el("div", "card-meta");

    var metaTop = el("div", "meta-top");
    if (rankNumber) {
      var rb = el("span", "rank-badge");
      rb.textContent = "Rank #" + rankNumber;
      metaTop.appendChild(rb);
    }
    var aired = el("span", "aired");
    aired.textContent = ep.aired;
    metaTop.appendChild(aired);
    var chev = el("span", "chev");
    chev.appendChild(sym("expand_more"));
    metaTop.appendChild(chev);
    meta.appendChild(metaTop);

    var h3 = el("h3");
    h3.textContent = ep.title;
    meta.appendChild(h3);

    var v = verdict(ep.n);
    var vEl = el("div", "verdict");
    if (v !== null) {
      var vn = el("span", "v-num");
      vn.innerHTML = fmt(v) + "<small>/10</small>";
      vEl.appendChild(vn);
      vEl.appendChild(document.createTextNode("shared verdict"));
    } else {
      vEl.className = "verdict pending";
      vEl.appendChild(document.createTextNode(needText(ep.n)));
    }
    meta.appendChild(vEl);

    var mini = el("div", "mini-row");
    RATERS.forEach(function (r) {
      var span = el("span");
      var rv = getRating(ep.n, r.key);
      span.innerHTML = "<b>" + r.label + "</b> " + (rv === null ? "—" : fmt(rv) + "/10");
      mini.appendChild(span);
    });
    meta.appendChild(mini);

    head.appendChild(meta);
    card.appendChild(head);

    // Detail (animatable wrapper)
    var detail = el("div", "detail");
    var detailInner = el("div", "detail-inner");
    detailInner.appendChild(sectionP("Synopsis", ep.synopsis));
    detailInner.appendChild(sectionList("Subplots", ep.subplots));
    detailInner.appendChild(sectionList("Fan-favorite moments", ep.moments));

    var rate = el("div", "rate-block");
    RATERS.forEach(function (r) {
      rate.appendChild(raterRow(ep, r));
    });
    detailInner.appendChild(rate);
    detail.appendChild(detailInner);
    card.appendChild(detail);

    head.addEventListener("click", function () {
      var doToggle = function () { card.classList.toggle("open"); };
      if (hasViewTransitions) {
        try { document.startViewTransition(doToggle); } catch (e) { doToggle(); }
      } else {
        doToggle();
      }
    });

    return card;
  }

  function needText(n) {
    var c = getRating(n, "clark") !== null;
    var a = getRating(n, "angie") !== null;
    if (!c && !a) return "Needs both ratings";
    if (!c) return "Waiting on Clark";
    return "Waiting on Angie";
  }

  function sectionP(title, text) {
    var wrap = document.createDocumentFragment();
    var h = el("h4");
    h.textContent = title;
    var p = el("p", "syn");
    p.textContent = text;
    wrap.appendChild(h);
    wrap.appendChild(p);
    return wrap;
  }
  function sectionList(title, items) {
    var wrap = document.createDocumentFragment();
    var h = el("h4");
    h.textContent = title;
    var ul = el("ul");
    items.forEach(function (it) {
      var li = el("li");
      li.textContent = it;
      ul.appendChild(li);
    });
    wrap.appendChild(h);
    wrap.appendChild(ul);
    return wrap;
  }

  function raterRow(ep, r) {
    var row = el("div", "rater");
    var top = el("div", "rater-top");
    var name = el("span", "rater-name " + r.key);
    name.textContent = r.label;
    var val = el("span", "rater-val");
    var cur = getRating(ep.n, r.key);
    val.innerHTML = cur === null ? "<span class='slash'>not rated</span>" : fmt(cur) + "<span class='slash'> / 10</span>";
    top.appendChild(name);
    top.appendChild(val);
    row.appendChild(top);

    var starsWrap = el("div");
    starsWrap.appendChild(
      buildStars(getRating(ep.n, r.key), {
        editable: true,
        ariaLabel: r.label + "'s rating, 0 to 10 in half-star steps",
        onSet: function (v) {
          if (getRating(ep.n, r.key) === v) return;
          setRating(ep.n, r.key, v);
          val.innerHTML = v === null ? "<span class='slash'>not rated</span>" : fmt(v) + "<span class='slash'> / 10</span>";
          refreshProgress();
          renderView({ keepOpen: ep.n });
        },
      })
    );
    row.appendChild(starsWrap);

    var bottom = el("div", "rater-bottom");
    var hint = el("span", "rater-hint");
    hint.textContent = "drag to rate";
    bottom.appendChild(hint);

    var clearBtn = el("button", "clearbtn");
    clearBtn.type = "button";
    clearBtn.innerHTML = "";
    clearBtn.appendChild(sym("backspace"));
    clearBtn.appendChild(document.createTextNode(" clear"));
    clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (getRating(ep.n, r.key) === null) return;
      setRating(ep.n, r.key, null);
      haptic(20);
      renderView({ keepOpen: ep.n });
      refreshProgress();
    });
    bottom.appendChild(clearBtn);
    row.appendChild(bottom);
    return row;
  }

  // ---- views ----
  function renderEpisodes(keepOpen) {
    var app = document.getElementById("app");
    clear(app);

    var ranked = EPS.filter(function (e) { return bothRated(e.n); });
    var unranked = EPS.filter(function (e) { return !bothRated(e.n); });

    ranked.sort(function (a, b) {
      var d = verdict(b.n) - verdict(a.n);
      return d !== 0 ? d : a.n - b.n;
    });
    unranked.sort(function (a, b) { return a.n - b.n; });

    app.appendChild(panelTitle("Unranked", unranked.length));
    if (unranked.length === 0) {
      app.appendChild(emptyNote("Every episode has a shared verdict. Check the Ranking tab."));
    } else {
      unranked.forEach(function (ep, i) {
        var c = episodeCard(ep, null, i * 30);
        if (keepOpen === ep.n) c.classList.add("open");
        app.appendChild(c);
      });
    }

    app.appendChild(panelTitle("Ranked", ranked.length));
    if (ranked.length === 0) {
      app.appendChild(emptyNote("Rate an episode with both stars to lock in a shared verdict — it'll drop in here, in order."));
    } else {
      ranked.forEach(function (ep, i) {
        var c = episodeCard(ep, i + 1, (unranked.length + i) * 24);
        if (keepOpen === ep.n) c.classList.add("open");
        app.appendChild(c);
      });
    }
  }

  function renderRanking() {
    var app = document.getElementById("app");
    clear(app);

    var ranked = EPS.filter(function (e) { return bothRated(e.n); });
    ranked.sort(function (a, b) {
      var d = verdict(b.n) - verdict(a.n);
      return d !== 0 ? d : a.n - b.n;
    });

    if (ranked.length === 0) {
      app.appendChild(emptyNote("No shared verdicts yet. Rate episodes together on the Episodes tab and your ranked list builds here."));
      return;
    }

    var ol = el("ol", "rank-list");
    ol.setAttribute("role", "list");
    ranked.forEach(function (ep, i) {
      var place = i + 1;
      var podiumCls = place <= 3 ? " podium-" + place : "";
      var li = el("li", "rank-item" + podiumCls);
      li.style.viewTransitionName = "ep-" + ep.n;
      li.style.animationDelay = (i * 30) + "ms";

      var placeEl = el("div", "place");
      placeEl.textContent = place;
      li.appendChild(placeEl);

      var img = el("img", "rthumb");
      img.src = ep.still;
      img.alt = "";
      img.loading = "lazy";
      li.appendChild(img);

      var mid = el("div");
      var t = el("div", "rtitle");
      t.textContent = ep.title;
      var sub = el("div", "rsub");
      var sCl = getRating(ep.n, "clark");
      var sAn = getRating(ep.n, "angie");
      sub.innerHTML =
        '<span>Ep ' + ep.n + '</span>' +
        '<span class="dot"></span>' +
        '<span><span class="dot clark-dot"></span> ' + fmt(sCl) + '</span>' +
        '<span><span class="dot angie-dot"></span> ' + fmt(sAn) + '</span>';
      mid.appendChild(t);
      mid.appendChild(sub);
      li.appendChild(mid);

      var score = el("div", "rscore");
      score.innerHTML = fmt(verdict(ep.n)) + "<small>verdict</small>";
      li.appendChild(score);

      ol.appendChild(li);
    });
    app.appendChild(ol);

    var remaining = EPS.length - ranked.length;
    if (remaining > 0) {
      var note = el("p", "section-note");
      note.textContent = remaining + " episode" + (remaining === 1 ? "" : "s") + " still need both ratings before they join the ranking.";
      app.appendChild(note);
    }
  }

  function panelTitle(label, count) {
    var h = el("div", "panel-title");
    h.appendChild(document.createTextNode(label));
    var c = el("span", "count");
    c.textContent = count;
    h.appendChild(c);
    return h;
  }
  function emptyNote(text) {
    var n = el("div", "empty-note");
    n.textContent = text;
    return n;
  }

  function doRender(opts) {
    if (view === "episodes") renderEpisodes(opts.keepOpen);
    else renderRanking();
    refreshProgress();
  }

  function renderView(opts) {
    opts = opts || {};
    if (hasViewTransitions && !opts.skipTransition) {
      try {
        document.startViewTransition(function () { doRender(opts); });
        return;
      } catch (e) {}
    }
    doRender(opts);
  }

  function refreshProgress() {
    var done = EPS.filter(function (e) { return bothRated(e.n); }).length;
    var p = document.getElementById("progress");
    var fill = document.getElementById("progress-fill");
    var pct = (done / EPS.length) * 100;
    if (fill) fill.style.width = pct.toFixed(1) + "%";
    if (!p) return;
    if (done === EPS.length) {
      p.innerHTML = '<span class="done">★ All ' + EPS.length + " episodes ranked — nicely done.</span>";
    } else {
      p.innerHTML = "<b>" + done + "</b> of " + EPS.length + " episodes have a shared verdict";
    }
  }

  // ---- tabs ----
  function initTabs() {
    var tabs = document.querySelectorAll(".tab");
    var tabsRoot = document.querySelector(".tabs");
    if (tabsRoot) tabsRoot.dataset.active = view;
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        if (t.classList.contains("is-active")) return;
        tabs.forEach(function (x) {
          x.classList.remove("is-active");
          x.setAttribute("aria-selected", "false");
        });
        t.classList.add("is-active");
        t.setAttribute("aria-selected", "true");
        view = t.dataset.view;
        if (tabsRoot) tabsRoot.dataset.active = view;
        haptic(10);
        window.scrollTo({ top: 0, behavior: "smooth" });
        renderView();
      });
    });
  }

  // ---- reset ----
  function initReset() {
    document.getElementById("reset-btn").addEventListener("click", function () {
      if (confirm("Erase every rating from Clark and Angie? This can't be undone.")) {
        ratings = {};
        saveRatings();
        haptic(30);
        renderView();
      }
    });
  }

  // ---- offline indicator ----
  function initOfflineChip() {
    var chip = document.getElementById("offline-chip");
    var label = chip.querySelector(".chip-label");
    function ready(text) {
      if (label) label.textContent = text;
      else chip.textContent = text;
      chip.classList.add("ready");
    }
    if (!("serviceWorker" in navigator)) {
      ready("local only");
      return;
    }
    navigator.serviceWorker.ready
      .then(function () { ready("offline ready"); })
      .catch(function () { ready("local only"); });
    if (navigator.serviceWorker.controller) ready("offline ready");
  }

  // ---- boot ----
  initTabs();
  initReset();
  initOfflineChip();
  renderView({ skipTransition: true });
})();
