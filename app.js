/* Freaks & Geeks rater — vanilla JS, localStorage, offline-first. */
(function () {
  "use strict";

  var STORAGE_KEY = "fng_ratings_v1";
  var RATERS = [
    { key: "clark", label: "Clark" },
    { key: "angie", label: "Angie" },
  ];
  var EPS = window.EPISODES || [];
  var EP_BY_N = {};
  EPS.forEach(function (e) { EP_BY_N[e.n] = e; });
  var view = "episodes";
  var mode = "list"; // "list" | "detail"
  var detailN = null;
  var pendingHeroN = null; // ep number to tag in next list render so it morphs from the hero
  var scrollMemo = 0;
  var hasViewTransitions = typeof document.startViewTransition === "function";

  function clearHeroTags() {
    document.querySelectorAll(".hero-src").forEach(function (e) {
      e.classList.remove("hero-src");
      e.style.viewTransitionName = "";
    });
  }
  function tagHero(elem) {
    clearHeroTags();
    if (!elem) return;
    elem.classList.add("hero-src");
    elem.style.viewTransitionName = "ep-hero";
  }
  function findThumbForEp(epN) {
    return document.querySelector('.card[data-n="' + epN + '"] .thumb-wrap')
        || document.querySelector('.rank-item[data-n="' + epN + '"] .rthumb');
  }

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

  // ---- stills helpers ----
  function getStills(ep) {
    if (Array.isArray(ep.stills) && ep.stills.length) return ep.stills.slice();
    return ep.still ? [ep.still] : [];
  }

  // ---- episode card (list row, no inline expansion) ----
  function episodeCard(ep, rankNumber, animDelay) {
    var stills = getStills(ep);
    var card = el("button", "card");
    card.type = "button";
    card.dataset.n = ep.n;
    card.setAttribute("aria-label", "Open episode " + ep.n + " — " + ep.title);
    if (animDelay) card.style.animationDelay = animDelay + "ms";

    var head = el("div", "card-head");

    var thumbWrap = el("div", "thumb-wrap");
    if (pendingHeroN === ep.n) {
      thumbWrap.classList.add("hero-src");
      thumbWrap.style.viewTransitionName = "ep-hero";
    }
    var img = el("img", "thumb");
    img.src = stills[0] || "";
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
    chev.appendChild(sym("chevron_right"));
    metaTop.appendChild(chev);
    meta.appendChild(metaTop);

    var h3 = el("h3");
    h3.textContent = ep.title;
    meta.appendChild(h3);

    var v = verdict(ep.n);
    var cRated = getRating(ep.n, "clark") !== null;
    var aRated = getRating(ep.n, "angie") !== null;
    if (v !== null) {
      var vEl = el("div", "verdict");
      var vn = el("span", "v-num");
      vn.innerHTML = fmt(v) + "<small>/10</small>";
      vEl.appendChild(vn);
      vEl.appendChild(document.createTextNode("shared verdict"));
      meta.appendChild(vEl);
    } else if (cRated || aRated) {
      var pEl = el("div", "verdict pending");
      pEl.appendChild(document.createTextNode(needText(ep.n)));
      meta.appendChild(pEl);
    }

    var mini = el("div", "mini-row");
    RATERS.forEach(function (r) {
      var span = el("span");
      var rv = getRating(ep.n, r.key);
      var b = el("b");
      b.textContent = r.label;
      span.appendChild(b);
      if (rv === null) {
        var icon = sym("star", "ms-empty");
        span.appendChild(icon);
      } else {
        span.appendChild(document.createTextNode(fmt(rv) + "/10"));
      }
      mini.appendChild(span);
    });
    meta.appendChild(mini);

    head.appendChild(meta);
    card.appendChild(head);

    card.addEventListener("click", function () {
      enterDetail(ep.n);
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
          renderView();
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

  // ---- gallery ----
  function galleryEl(ep, stills) {
    var wrap = el("div", "gallery");
    var hero = el("button", "gallery-hero");
    hero.type = "button";
    hero.setAttribute("aria-label", "Open " + ep.title + " still fullscreen");
    var heroImg = el("img");
    heroImg.src = stills[0];
    heroImg.alt = ep.title + " still";
    heroImg.loading = "lazy";
    hero.appendChild(heroImg);
    var hint = el("span", "zoom-hint");
    hint.appendChild(sym("zoom_in"));
    hint.appendChild(document.createTextNode(stills.length > 1 ? stills.length + " stills" : "Tap to expand"));
    hero.appendChild(hint);

    var currentIdx = 0;
    var thumbsRow = null;
    if (stills.length > 1) {
      thumbsRow = el("div", "gallery-thumbs");
      stills.forEach(function (src, i) {
        var t = el("button", "gallery-thumb" + (i === 0 ? " is-active" : ""));
        t.type = "button";
        t.setAttribute("aria-label", "Still " + (i + 1));
        var ti = el("img");
        ti.src = src;
        ti.alt = "";
        ti.loading = "lazy";
        t.appendChild(ti);
        t.addEventListener("click", function (e) {
          e.stopPropagation();
          currentIdx = i;
          heroImg.src = src;
          thumbsRow.querySelectorAll(".gallery-thumb").forEach(function (x) { x.classList.remove("is-active"); });
          t.classList.add("is-active");
        });
        thumbsRow.appendChild(t);
      });
    }

    hero.addEventListener("click", function (e) {
      e.stopPropagation();
      openLightbox(stills, currentIdx, ep);
    });

    wrap.appendChild(hero);
    if (thumbsRow) wrap.appendChild(thumbsRow);
    return wrap;
  }

  // ---- lightbox ----
  var lightbox = {
    root: null,
    img: null,
    caption: null,
    state: null,
    init: function () {
      var root = document.getElementById("lightbox");
      if (!root) return;
      this.root = root;
      this.img = root.querySelector(".lightbox-img");
      this.caption = root.querySelector(".lightbox-caption");
      var self = this;
      root.addEventListener("click", function (e) {
        if (e.target === root) self.close();
      });
      root.querySelector(".lightbox-close").addEventListener("click", function () { self.close(); });
      root.querySelector(".lightbox-nav.prev").addEventListener("click", function () { self.step(-1); });
      root.querySelector(".lightbox-nav.next").addEventListener("click", function () { self.step(1); });
      document.addEventListener("keydown", function (e) {
        if (!self.state) return;
        if (e.key === "Escape") self.close();
        else if (e.key === "ArrowLeft") self.step(-1);
        else if (e.key === "ArrowRight") self.step(1);
      });
    },
    open: function (stills, idx, ep) {
      if (!this.root) return;
      this.state = { stills: stills, idx: idx, ep: ep };
      this.root.classList.toggle("single", stills.length <= 1);
      this.root.hidden = false;
      this.root.setAttribute("aria-hidden", "false");
      // next frame for transition
      requestAnimationFrame(function () {
        lightbox.root.classList.add("is-open");
      });
      this.render();
      document.body.style.overflow = "hidden";
      haptic(10);
    },
    render: function () {
      if (!this.state) return;
      var s = this.state;
      this.img.src = s.stills[s.idx];
      this.img.alt = s.ep.title + " — still " + (s.idx + 1);
      var cap = "Episode " + s.ep.n + " — " + s.ep.title;
      if (s.stills.length > 1) cap += "  ·  " + (s.idx + 1) + " / " + s.stills.length;
      this.caption.textContent = cap;
    },
    step: function (dir) {
      if (!this.state) return;
      var len = this.state.stills.length;
      if (len <= 1) return;
      this.state.idx = (this.state.idx + dir + len) % len;
      this.render();
      haptic(8);
    },
    close: function () {
      if (!this.root || !this.state) return;
      this.root.classList.remove("is-open");
      var self = this;
      setTimeout(function () {
        self.root.hidden = true;
        self.root.setAttribute("aria-hidden", "true");
        self.state = null;
        document.body.style.overflow = "";
      }, 220);
    },
  };
  function openLightbox(stills, idx, ep) { lightbox.open(stills, idx, ep); }

  // ---- progress card ----
  function progressCardEl(done, total) {
    var card = el("section", "progress-card");
    card.setAttribute("aria-live", "polite");
    if (done === total) card.classList.add("is-complete");

    var head = el("div", "progress-head");

    var block = el("div", "progress-text-block");
    var eyebrow = el("p", "progress-eyebrow");
    eyebrow.textContent = done === total ? "Season verdict locked" : "Season in progress";
    block.appendChild(eyebrow);

    var headline = el("h2", "progress-headline");
    if (done === total) {
      headline.innerHTML = 'All <span class="pdone">18</span> episodes ranked.';
    } else {
      headline.innerHTML =
        '<span class="pdone">' + done + '</span>' +
        '<span class="ptotal"> of ' + total + '</span> episodes have a shared verdict';
    }
    block.appendChild(headline);

    var sub = el("p", "progress-sub");
    var remaining = total - done;
    if (remaining === 0) sub.textContent = "Nicely done. Head to the Ranking tab to see your final list.";
    else if (remaining === total) sub.textContent = "Rate any episode with both stars to lock in your first shared verdict.";
    else sub.textContent = remaining + " more to go before the ranking is complete.";
    block.appendChild(sub);

    head.appendChild(block);

    var pct = el("div", "progress-pct");
    var pctNum = el("b");
    pctNum.textContent = Math.round((done / total) * 100) + "%";
    var pctLabel = el("small");
    pctLabel.textContent = "complete";
    pct.appendChild(pctNum);
    pct.appendChild(pctLabel);
    head.appendChild(pct);

    card.appendChild(head);

    var track = el("div", "progress-track");
    track.setAttribute("aria-hidden", "true");
    var fill = el("div", "progress-fill");
    fill.style.width = ((done / total) * 100) + "%";
    track.appendChild(fill);
    card.appendChild(track);

    return card;
  }

  // ---- views ----
  function renderEpisodes() {
    var app = document.getElementById("app");
    clear(app);

    var ranked = EPS.filter(function (e) { return bothRated(e.n); });
    var unranked = EPS.filter(function (e) { return !bothRated(e.n); });

    app.appendChild(progressCardEl(ranked.length, EPS.length));

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
        app.appendChild(episodeCard(ep, null, i * 30));
      });
    }

    app.appendChild(panelTitle("Ranked", ranked.length));
    if (ranked.length === 0) {
      app.appendChild(emptyNote("Rate an episode with both stars to lock in a shared verdict — it'll drop in here, in order."));
    } else {
      ranked.forEach(function (ep, i) {
        app.appendChild(episodeCard(ep, i + 1, (unranked.length + i) * 24));
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

    app.appendChild(progressCardEl(ranked.length, EPS.length));

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
      li.style.animationDelay = (i * 30) + "ms";
      li.addEventListener("click", function () { enterDetail(ep.n); });
      li.style.cursor = "pointer";

      var placeEl = el("div", "place");
      placeEl.textContent = place;
      li.appendChild(placeEl);

      li.dataset.n = ep.n;
      var img = el("img", "rthumb");
      img.src = ep.still;
      img.alt = "";
      img.loading = "lazy";
      if (pendingHeroN === ep.n) {
        img.classList.add("hero-src");
        img.style.viewTransitionName = "ep-hero";
      }
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
    if (mode === "detail") {
      renderDetail();
    } else {
      if (view === "episodes") renderEpisodes();
      else renderRanking();
    }
    refreshProgress();
  }

  function renderView(opts) {
    opts = opts || {};
    document.body.classList.toggle("is-detail", mode === "detail");
    if (hasViewTransitions && !opts.skipTransition) {
      try {
        var t = document.startViewTransition(function () {
          doRender(opts);
          // Wait for the morphing image to fully decode before the NEW
          // snapshot is taken — otherwise the freshly-mounted hero img
          // can be captured blank, causing a brief opacity flicker.
          var target = document.querySelector(".detail-hero-img");
          if (target && target.decode) {
            return target.decode().catch(function () { return null; });
          }
          return null;
        });
        if (t && t.finished && t.finished.then) {
          t.finished.then(function () {
            if (mode === "list") clearHeroTags();
            pendingHeroN = null;
          }).catch(function () {});
        }
        return;
      } catch (e) {}
    }
    doRender(opts);
    if (mode === "list") clearHeroTags();
    pendingHeroN = null;
  }

  // ---- detail mode ----
  function enterDetail(epN) {
    if (mode === "detail") return;
    // Tag the source thumb in the CURRENT (old) DOM so the morph has
    // a starting position. The new render will tag the hero too.
    tagHero(findThumbForEp(epN));
    detailN = epN;
    scrollMemo = window.scrollY || 0;
    mode = "detail";
    haptic(12);
    renderView();
    requestAnimationFrame(function () { window.scrollTo(0, 0); });
  }
  function exitDetail() {
    if (mode !== "detail") return;
    // Tell the next list render to tag the matching thumb so the hero
    // morphs back into it.
    pendingHeroN = detailN;
    mode = "list";
    detailN = null;
    haptic(10);
    renderView();
    requestAnimationFrame(function () { window.scrollTo(0, scrollMemo); });
  }
  function navDetail(dir) {
    if (mode !== "detail" || detailN == null) return;
    var idx = EPS.findIndex(function (e) { return e.n === detailN; });
    var nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= EPS.length) return;
    detailN = EPS[nextIdx].n;
    haptic(8);
    // Use a swipe-style transition (CSS-driven), bypass view transitions
    // so the morph doesn't try to share names between adjacent episodes.
    var app = document.getElementById("app");
    var existing = app.querySelector(".detail-page");
    var exitCls = dir > 0 ? "swipe-exit-left" : "swipe-exit-right";
    var enterCls = dir > 0 ? "swipe-enter-right" : "swipe-enter-left";
    if (existing) {
      existing.classList.add(exitCls);
    }
    setTimeout(function () {
      doRender({ skipTransition: true });
      var next = app.querySelector(".detail-page");
      if (next) {
        next.classList.add(enterCls);
        next.addEventListener("animationend", function once() {
          next.classList.remove(enterCls);
          next.removeEventListener("animationend", once);
        });
      }
      window.scrollTo(0, 0);
    }, 220);
  }

  function renderDetail() {
    var app = document.getElementById("app");
    clear(app);
    var ep = EP_BY_N[detailN];
    if (!ep) { mode = "list"; doRender({}); return; }
    var stills = getStills(ep);

    var page = el("div", "detail-page");
    page.dataset.n = ep.n;

    var back = el("button", "detail-back");
    back.type = "button";
    back.setAttribute("aria-label", "Back to list");
    back.appendChild(sym("arrow_back"));
    back.addEventListener("click", exitDetail);
    page.appendChild(back);

    // Hero
    var hero = el("div", "detail-hero");
    hero.style.viewTransitionName = "ep-hero";
    hero.classList.add("hero-src");
    var heroImg = el("img", "detail-hero-img");
    heroImg.src = stills[0] || "";
    heroImg.alt = ep.title + " still";
    hero.appendChild(heroImg);
    var shade = el("div", "detail-hero-shade");
    hero.appendChild(shade);

    var heroMeta = el("div", "detail-hero-meta");
    var eyebrow = el("p", "detail-hero-eyebrow");
    eyebrow.textContent = "Episode " + ep.n + " · " + ep.aired;
    heroMeta.appendChild(eyebrow);

    var heroTitle = el("h1", "detail-hero-title");
    heroTitle.textContent = ep.title;
    heroMeta.appendChild(heroTitle);

    var actions = el("div", "detail-hero-actions");
    var galleryBtn = el("button", "detail-hero-gallery");
    galleryBtn.type = "button";
    galleryBtn.appendChild(sym("photo_library"));
    var galleryLabel = el("span");
    galleryLabel.textContent = stills.length > 1 ? "View " + stills.length + " stills" : "View still";
    galleryBtn.appendChild(galleryLabel);
    galleryBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openLightbox(stills, 0, ep);
    });
    actions.appendChild(galleryBtn);
    heroMeta.appendChild(actions);
    hero.appendChild(heroMeta);

    hero.addEventListener("click", function () {
      openLightbox(stills, 0, ep);
    });

    page.appendChild(hero);

    // Body
    var body = el("div", "detail-body");

    // Verdict block
    var verdictBlock = el("section", "detail-verdict");
    var v = verdict(ep.n);
    var verdictMeta = el("div", "detail-verdict-meta");
    var verdictLabel = el("p", "detail-verdict-label");
    var verdictNum = el("div", "detail-verdict-num");
    var verdictSub = el("p", "detail-verdict-sub");
    if (v !== null) {
      verdictLabel.textContent = "Shared verdict";
      verdictNum.innerHTML = fmt(v) + "<small>/10</small>";
      verdictSub.innerHTML = "<b>Clark</b> " + fmt(getRating(ep.n, "clark")) + " · <b>Angie</b> " + fmt(getRating(ep.n, "angie"));
    } else {
      verdictBlock.classList.add("is-pending");
      verdictLabel.textContent = needText(ep.n);
      verdictNum.textContent = "—";
      var cl = getRating(ep.n, "clark");
      var an = getRating(ep.n, "angie");
      verdictSub.innerHTML =
        '<b>Clark</b> ' + (cl == null ? "—" : fmt(cl) + "/10") +
        ' · <b>Angie</b> ' + (an == null ? "—" : fmt(an) + "/10");
    }
    verdictMeta.appendChild(verdictLabel);
    verdictMeta.appendChild(verdictSub);
    verdictBlock.appendChild(verdictNum);
    verdictBlock.appendChild(verdictMeta);
    body.appendChild(verdictBlock);

    // Rate block
    var rateSection = el("section", "detail-rate");
    RATERS.forEach(function (r) {
      rateSection.appendChild(raterRow(ep, r));
    });
    body.appendChild(rateSection);

    // Synopsis
    body.appendChild(detailSection("Synopsis", function (s) {
      var p = el("p", "syn");
      p.textContent = ep.synopsis;
      s.appendChild(p);
    }));

    // Subplots
    body.appendChild(detailSection("Subplots", function (s) {
      var ul = el("ul");
      ep.subplots.forEach(function (it) {
        var li = el("li"); li.textContent = it; ul.appendChild(li);
      });
      s.appendChild(ul);
    }));

    // Moments
    body.appendChild(detailSection("Fan-favorite moments", function (s) {
      var ul = el("ul");
      ep.moments.forEach(function (it) {
        var li = el("li"); li.textContent = it; ul.appendChild(li);
      });
      s.appendChild(ul);
    }));

    page.appendChild(body);

    // Prev/Next nav
    var nav = el("nav", "detail-nav");
    nav.setAttribute("aria-label", "Episode navigation");
    var idx = EPS.findIndex(function (e) { return e.n === ep.n; });
    var prev = idx > 0 ? EPS[idx - 1] : null;
    var next = idx < EPS.length - 1 ? EPS[idx + 1] : null;
    nav.appendChild(navBtn("prev", prev));
    nav.appendChild(navBtn("next", next));
    page.appendChild(nav);

    attachSwipe(page);

    app.appendChild(page);
  }

  function detailSection(title, build) {
    var s = el("section", "detail-section");
    var t = el("h3", "detail-section-title");
    t.textContent = title;
    s.appendChild(t);
    build(s);
    return s;
  }
  function navBtn(side, ep) {
    var b = el("button", "detail-nav-btn " + side);
    b.type = "button";
    if (!ep) { b.disabled = true; }
    var label = el("span", "nav-label");
    if (side === "prev") {
      label.appendChild(sym("chevron_left"));
      label.appendChild(document.createTextNode("Previous"));
    } else {
      label.appendChild(document.createTextNode("Next"));
      label.appendChild(sym("chevron_right"));
    }
    var title = el("span", "nav-title");
    title.textContent = ep ? "Ep " + ep.n + " · " + ep.title : "End of season";
    b.appendChild(label);
    b.appendChild(title);
    if (ep) {
      b.addEventListener("click", function () {
        navDetail(side === "prev" ? -1 : 1);
      });
    }
    return b;
  }

  function attachSwipe(page) {
    var startX = 0, startY = 0, dx = 0, dy = 0;
    var tracking = false;
    var locked = null;
    var threshold = 70;
    page.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      // Don't hijack horizontal gestures inside the star slider or lightbox.
      var t = e.target;
      if (t && t.closest && (t.closest(".stars") || t.closest(".lightbox") || t.closest(".detail-back"))) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; dy = 0;
      tracking = true;
      locked = null;
    }, { passive: true });
    page.addEventListener("touchmove", function (e) {
      if (!tracking) return;
      dx = e.touches[0].clientX - startX;
      dy = e.touches[0].clientY - startY;
      if (locked === null) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        }
      }
    }, { passive: true });
    page.addEventListener("touchend", function () {
      if (!tracking) return;
      tracking = false;
      if (locked === "x" && Math.abs(dx) > threshold) {
        navDetail(dx < 0 ? 1 : -1);
      }
    });
  }

  function refreshProgress() {
    // Progress now lives inline in each view's render. This is a no-op
    // kept so callers (e.g. star drag) don't need to know about layout.
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
  lightbox.init();
  renderView({ skipTransition: true });
})();
