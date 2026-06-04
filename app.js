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

  // ---- star rendering ----
  // value: 0..10 in 0.5 steps (or null). Returns an element.
  function buildStars(value, opts) {
    opts = opts || {};
    var cls = "stars" + (opts.mini ? " mini-stars" : "") + (opts.editable ? " editable" : "");
    var wrap = el("div", cls);
    var v = value || 0;
    for (var i = 1; i <= 10; i++) {
      var star = el("span", "star");
      var bg = el("span", "bg");
      bg.textContent = "★";
      var fg = el("span", "fg");
      fg.textContent = "★";
      var pct = Math.max(0, Math.min(1, v - (i - 1))) * 100;
      fg.style.width = pct + "%";
      star.appendChild(bg);
      star.appendChild(fg);
      if (opts.editable) {
        star.appendChild(makeHit("left", i - 0.5, opts.onSet));
        star.appendChild(makeHit("right", i, opts.onSet));
      }
      wrap.appendChild(star);
    }
    return wrap;
  }
  function makeHit(side, val, onSet) {
    var b = el("button", "hit " + side);
    b.type = "button";
    b.setAttribute("aria-label", "Rate " + val);
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      onSet(val);
    });
    return b;
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

  // ---- episode card ----
  function episodeCard(ep, rankNumber) {
    var card = el("div", "card");
    card.dataset.n = ep.n;

    var head = el("div", "card-head");

    var img = el("img", "thumb");
    img.src = ep.still;
    img.alt = ep.title + " still";
    img.loading = "lazy";
    head.appendChild(img);

    var meta = el("div", "card-meta");
    var epno = el("div", "epno");
    if (rankNumber) {
      var rb = el("span", "rank-badge");
      rb.textContent = "#" + rankNumber;
      epno.appendChild(rb);
    }
    epno.appendChild(document.createTextNode("Episode " + ep.n));
    meta.appendChild(epno);

    var h3 = el("h3");
    h3.textContent = ep.title;
    meta.appendChild(h3);

    var aired = el("div", "aired");
    aired.textContent = ep.aired;
    meta.appendChild(aired);

    var v = verdict(ep.n);
    var vEl = el("div", "verdict");
    if (v !== null) {
      var vn = el("span", "v-num");
      vn.textContent = fmt(v);
      vEl.appendChild(vn);
      vEl.appendChild(document.createTextNode("shared verdict"));
    } else {
      vEl.className = "verdict pending";
      vEl.textContent = needText(ep.n);
    }
    meta.appendChild(vEl);

    // mini summary of each rating
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

    // detail
    var detail = el("div", "detail");
    detail.appendChild(sectionP("Synopsis", ep.synopsis));
    detail.appendChild(sectionList("Subplots", ep.subplots));
    detail.appendChild(sectionList("Fan-favorite moments", ep.moments));

    var rate = el("div", "rate-block");
    RATERS.forEach(function (r) {
      rate.appendChild(raterRow(ep, r, card));
    });
    detail.appendChild(rate);
    card.appendChild(detail);

    head.addEventListener("click", function () {
      card.classList.toggle("open");
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

  function raterRow(ep, r, card) {
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
    function rerenderStars() {
      clear(starsWrap);
      starsWrap.appendChild(
        buildStars(getRating(ep.n, r.key), {
          editable: true,
          onSet: function (v) {
            // tapping the current value again clears it
            if (getRating(ep.n, r.key) === v) v = null;
            setRating(ep.n, r.key, v);
            val.innerHTML = v === null ? "<span class='slash'>not rated</span>" : fmt(v) + "<span class='slash'> / 10</span>";
            rerenderStars();
            refreshProgress();
            // if both now rated (or unrated), the card may move panels — re-render whole view
            renderView({ keepOpen: ep.n });
          },
        })
      );
    }
    rerenderStars();
    row.appendChild(starsWrap);

    var clearBtn = el("button", "clearbtn");
    clearBtn.type = "button";
    clearBtn.textContent = "clear";
    clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setRating(ep.n, r.key, null);
      renderView({ keepOpen: ep.n });
      refreshProgress();
    });
    row.appendChild(clearBtn);
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

    // Unranked panel
    app.appendChild(panelTitle("Unranked", unranked.length));
    if (unranked.length === 0) {
      app.appendChild(emptyNote("Every episode has a shared verdict. Check the Ranking tab! 🎉"));
    } else {
      unranked.forEach(function (ep) {
        var c = episodeCard(ep, null);
        if (keepOpen === ep.n) c.classList.add("open");
        app.appendChild(c);
      });
    }

    // Ranked panel (ordered)
    app.appendChild(panelTitle("Ranked", ranked.length));
    if (ranked.length === 0) {
      app.appendChild(emptyNote("Rate an episode with both stars to lock in a shared verdict — it'll drop in here, in order."));
    } else {
      ranked.forEach(function (ep, i) {
        var c = episodeCard(ep, i + 1);
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
    ranked.forEach(function (ep, i) {
      var li = el("li", "rank-item" + (i === 0 ? " podium-1" : ""));
      var place = el("div", "place");
      place.textContent = i + 1;
      li.appendChild(place);

      var img = el("img", "rthumb");
      img.src = ep.still;
      img.alt = "";
      img.loading = "lazy";
      li.appendChild(img);

      var mid = el("div");
      var t = el("div", "rtitle");
      t.textContent = ep.title;
      var sub = el("div", "rsub");
      sub.textContent =
        "Ep " + ep.n + " · Clark " + fmt(getRating(ep.n, "clark")) + " · Angie " + fmt(getRating(ep.n, "angie"));
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

  function renderView(opts) {
    opts = opts || {};
    if (view === "episodes") renderEpisodes(opts.keepOpen);
    else renderRanking();
    refreshProgress();
  }

  function refreshProgress() {
    var done = EPS.filter(function (e) { return bothRated(e.n); }).length;
    var p = document.getElementById("progress");
    if (done === EPS.length) {
      p.textContent = "★ All " + EPS.length + " episodes ranked — nicely done!";
    } else {
      p.textContent = done + " of " + EPS.length + " episodes have a shared verdict";
    }
  }

  // ---- tabs ----
  function initTabs() {
    var tabs = document.querySelectorAll(".tab");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.remove("is-active"); });
        t.classList.add("is-active");
        view = t.dataset.view;
        window.scrollTo(0, 0);
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
        renderView();
      }
    });
  }

  // ---- offline indicator ----
  function initOfflineChip() {
    var chip = document.getElementById("offline-chip");
    if (!("serviceWorker" in navigator)) {
      chip.textContent = "local only";
      chip.classList.add("ready");
      return;
    }
    navigator.serviceWorker.ready
      .then(function () {
        chip.textContent = "✓ offline ready";
        chip.classList.add("ready");
      })
      .catch(function () {
        chip.textContent = "local only";
        chip.classList.add("ready");
      });
    // If already controlled (return visit), show ready immediately.
    if (navigator.serviceWorker.controller) {
      chip.textContent = "✓ offline ready";
      chip.classList.add("ready");
    }
  }

  // ---- boot ----
  initTabs();
  initReset();
  initOfflineChip();
  renderView();
})();
