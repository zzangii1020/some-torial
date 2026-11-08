/* 썸토리얼 — 앱 로직 */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sometorial:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("sometorial:" + k, JSON.stringify(v)); } catch (e) { /* 무시 */ } },
    del(k) { try { localStorage.removeItem("sometorial:" + k); } catch (e) { /* 무시 */ } }
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* 무시 */ } };

  /* ───────── 화면 전환 ───────── */
  function show(id) {
    document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("active", el.id === id));
    window.scrollTo(0, 0);
    if (id === "home") renderHome();
    if (id === "patterns") renderPatterns();
    if (id === "methods") renderMethods();
    if (id === "drill") startDrill();
    if (id !== "game") stopAuto();
  }
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { show(go.dataset.go); return; }
    const st = e.target.closest("[data-start]");
    if (st) startGame(st.dataset.start);
  });

  /* ───────── 홈 ───────── */
  function renderHome() {
    const best = store.get("best", null);
    const bs = $("#bestScore");
    if (best != null) { bs.hidden = false; bs.innerHTML = `최고 호감도 <b>${best}</b> / 100 · 만점 루트는 89`; }
    else bs.hidden = true;
    const saved = store.get("save", null);
    $("#resumeBtn").hidden = !saved;
  }
  $("#resumeBtn").addEventListener("click", () => {
    const saved = store.get("save", null);
    if (saved) resumeGame(saved);
  });

  /* ───────── 게임 상태 ───────── */
  let S = null;          // { mode, i, score, picks, log, transcript }
  let queue = [];        // 렌더 대기 중인 스텝
  let waiting = false;   // 선택지 대기 중
  let autoTimer = null, auto = false;
  let timerId = null;

  const chat = $("#chat");

  /* 지현 프사 */
  const herAvatar = () => (typeof HER_PHOTO !== "undefined" && HER_PHOTO)
    ? `<img class="avatar her photo" src="${esc(HER_PHOTO)}" alt="지현">`
    : `<div class="avatar her">지</div>`;
  // 프사 누르면 크게 보기 (카톡 프로필처럼)
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".avatar.photo");
    if (!a) return;
    e.stopPropagation();
    const m = document.createElement("div");
    m.className = "profile-modal";
    m.innerHTML = `<div class="profile-card"><img src="${esc(HER_PHOTO.replace(".jpg", "-full.jpg"))}" alt="지현"><div class="profile-info"><b>지현</b><span>27 · 홍보팀 사보 담당</span></div></div>`;
    m.addEventListener("click", () => m.remove());
    document.body.appendChild(m);
  }, true);
  (function applyHomeAvatar() {
    const el = document.querySelector(".cast .avatar.her");
    if (el && typeof HER_PHOTO !== "undefined" && HER_PHOTO) el.outerHTML = herAvatar();
  })();

  function newState(mode) {
    return { mode, i: 0, score: START_SCORE, picks: {}, log: [], transcript: [], clock: "18:02", chapter: "" };
  }

  function startGame(mode) {
    S = newState(mode);
    queue = [];
    waiting = false;
    chat.innerHTML = "";
    $("#sheet").hidden = true;
    $("#tapbar").classList.remove("hide");
    clearInterval(timerId);
    setScore(S.score, 0, true);
    show("game");
    next();
  }

  function resumeGame(saved) {
    S = saved;
    queue = saved.queue || [];
    waiting = false;
    chat.innerHTML = "";
    $("#sheet").hidden = true;
    $("#tapbar").classList.remove("hide");
    clearInterval(timerId);
    show("game");
    // 대화 기록 다시 그리기 (애니메이션 없이)
    S.transcript.forEach((st) => renderStep(st, true));
    setScore(S.score, 0, true);
    $("#clock").textContent = S.clock;
    $("#chapterBar").textContent = S.chapter;
    scrollDown(true);
    next();
  }

  function save() {
    if (!S) return;
    S.queue = queue;
    store.set("save", S);
  }

  /* 호감도 */
  function setScore(v, d, instant) {
    $("#scoreNum").textContent = v;
    const fill = $("#scoreFill");
    if (instant) { fill.style.transition = "none"; requestAnimationFrame(() => { fill.style.transition = ""; }); }
    fill.style.width = v + "%";
    const del = $("#scoreDelta");
    if (d) {
      del.textContent = (d > 0 ? "+" : "") + d;
      del.className = "meter-delta show " + (d > 0 ? "up" : "down");
      clearTimeout(del._t);
      del._t = setTimeout(() => { del.className = "meter-delta"; }, 1800);
      if (d < 0) vibrate(40);
    }
  }

  /* ───────── 진행 ───────── */
  function next() {
    if (waiting) return;
    let step = queue.length ? queue.shift() : null;
    while (!step) {
      if (S.i >= STORY.length) return;
      const s = STORY[S.i++];
      if (s.cond && !s.cond(S)) continue;
      step = s;
    }
    if (step.t === "choice") { openChoice(step); return; }
    if (step.t === "end") { finish(); return; }
    if (step.t === "heart") {
      const d = step._apply !== undefined ? step._apply : (step._applied ? 0 : step.d || 0);
      step = Object.assign({}, step, { _applied: true });
      delete step._apply;
      if (d) { S.score = clamp(S.score + d); setScore(S.score, d); }
    }
    if (step.t === "chapter") {
      S.clock = step.clock; S.chapter = step.title + " — " + step.sub;
      $("#clock").textContent = step.clock;
      $("#chapterBar").textContent = S.chapter;
    }
    const clean = Object.assign({}, step);
    S.transcript.push(clean);
    renderStep(clean, false);
    save();
    scrollDown();
    // 지문·챕터는 이어서 바로 다음 대사까지 (자연스러운 흐름)
    if (step.t === "chapter") setTimeout(next, 450);
    scheduleAuto(step);
  }

  function scrollDown(instant) {
    requestAnimationFrame(() => chat.scrollTo({ top: chat.scrollHeight, behavior: instant ? "auto" : "smooth" }));
  }

  function renderStep(st, silent) {
    let el;
    switch (st.t) {
      case "chapter":
        el = h(`<div class="chapter"><span class="ch-title">${esc(st.title)}</span><span class="ch-sub">${esc(st.sub)} · ${esc(st.clock)}</span></div>`);
        break;
      case "narr":
        el = h(`<div class="narr">${esc(st.text)}</div>`);
        break;
      case "j":
        el = h(`<div><div class="who">지현</div><div class="msg her">${herAvatar()}<div class="bubble">${esc(st.text)}</div></div></div>`);
        break;
      case "s":
        el = h(`<div><div class="who staff">직원</div><div class="msg staff"><div class="avatar" style="background:var(--surface-2)">🍝</div><div class="bubble">${esc(st.text)}</div></div></div>`);
        break;
      case "w":
        el = h(`<div class="msg me"><div class="bubble">${esc(st.text)}</div></div>`);
        break;
      case "think":
        el = h(`<div class="card think"><div class="card-h"><span>🧠 남자의 머릿속</span></div>${esc(st.text)}</div>`);
        break;
      case "heart": {
        const d = st.d || 0;
        const chip = d ? `<span class="delta-chip ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${d}</span>` : "";
        el = h(`<div class="card heart"><div class="card-h"><span>💗 여자의 속마음</span>${chip}</div>${esc(st.text)}</div>`);
        break;
      }
      case "tip":
        el = h(`<div class="card tip"><div class="card-h"><span>💡 ${esc(st.title)}</span></div>${st.html}</div>`);
        break;
      case "coach": {
        const bestLine = st.good ? "" : `<div class="best-line">✅ <b>더 좋은 선택:</b> ${esc(st.best)}</div>`;
        const pat = st.pattern ? `<div class="pat">📌 패턴 ${st.pattern}. ${esc(PATTERNS[st.pattern - 1][0])}</div>` : "";
        el = h(`<div class="card coach ${st.good ? "good" : "bad"}"><div class="card-h"><span class="verdict">${st.timeout ? "⏱ 시간 초과" : st.good ? "✓ 좋은 선택" : "✗ 아쉬운 선택"}</span></div>${esc(st.why)}${bestLine}${pat}</div>`);
        break;
      }
      default: return;
    }
    if (silent) el.style.animation = "none";
    chat.appendChild(el);
  }

  function h(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  /* 탭으로 진행 */
  chat.addEventListener("click", () => { if (!waiting) next(); });
  $("#tapbar").addEventListener("click", () => { if (!waiting) next(); });
  document.addEventListener("keydown", (e) => {
    if (!$("#game").classList.contains("active")) return;
    if (waiting) {
      const n = parseInt(e.key, 10);
      const btns = document.querySelectorAll("#options .opt");
      if (n >= 1 && n <= btns.length) btns[n - 1].click();
      return;
    }
    if (e.key === " " || e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); next(); }
  });

  /* 자동 진행 */
  function scheduleAuto(step) {
    clearTimeout(autoTimer);
    if (!auto || waiting) return;
    const len = (step && (step.text || step.title || "")).length || 20;
    const delay = Math.min(4200, 900 + len * 45) + (step && (step.t === "tip" || step.t === "coach") ? 2500 : 0);
    autoTimer = setTimeout(() => { if (!waiting) next(); }, delay);
  }
  function stopAuto() { clearTimeout(autoTimer); }
  $("#autoBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    auto = !auto;
    $("#autoBtn").classList.toggle("on", auto);
    $("#autoBtn").textContent = auto ? "❚❚" : "▶";
    if (auto && !waiting) next();
    else stopAuto();
  });

  $("#gameBack").addEventListener("click", () => {
    clearInterval(timerId);
    show("home");
  });

  /* ───────── 선택지 ───────── */
  function openChoice(c) {
    waiting = true;
    stopAuto();
    S.i--; // 선택 전 저장 시 이 선택지로 돌아오도록
    save();
    S.i++;
    $("#tapbar").classList.add("hide");
    const real = S.mode === "real";
    $("#sheetPrompt").textContent = c.prompt;
    const hintBtn = $("#hintBtn"), hintText = $("#hintText");
    hintText.textContent = c.hint || "";
    hintText.hidden = true;
    hintBtn.hidden = real || !c.hint;
    hintBtn.onclick = () => { hintText.hidden = !hintText.hidden; };

    let opts = c.options.map((o, idx) => Object.assign({ idx }, o));
    if (real) opts = shuffle(opts);
    const box = $("#options");
    box.innerHTML = "";
    opts.forEach((o, n) => {
      const b = document.createElement("button");
      b.className = "opt";
      const label = real ? `${n + 1}` : `${o.kind ? "[" + o.kind + "] " : ""}${o.label}`;
      b.innerHTML = `<span class="opt-label">${esc(label)}</span><span class="opt-text">${esc(o.text)}</span>`;
      b.addEventListener("click", () => pick(c, o, false));
      box.appendChild(b);
    });
    $("#sheet").hidden = false;
    $("#sheet").scrollTop = 0;
    scrollDown();

    // 실전 모드 타이머
    clearInterval(timerId);
    const timer = $("#timer");
    timer.hidden = !real;
    if (real) {
      const total = 12000, t0 = Date.now();
      const fill = $("#timerFill");
      fill.style.transform = "scaleX(1)";
      timerId = setInterval(() => {
        const left = Math.max(0, 1 - (Date.now() - t0) / total);
        fill.style.transform = `scaleX(${left})`;
        if (left <= 0) {
          clearInterval(timerId);
          const best = c.options.find((o) => o.best);
          pick(c, best, true);
        }
      }, 100);
    }
  }

  function pick(c, o, timeout) {
    if (!waiting) return;
    clearInterval(timerId);
    waiting = false;
    $("#sheet").hidden = true;
    $("#tapbar").classList.remove("hide");
    vibrate(15);

    const best = c.options.find((x) => x.best);
    let d = o.d;
    let heart = o.heart;
    if (timeout) {
      d = Math.min(o.d - 4, -2);
      heart = "…한참 뜸 들이시네. 무슨 생각 하시는 거지?";
    }
    const before = S.score;
    S.score = clamp(S.score + d);
    S.picks[c.id] = o.kind || o.label;
    S.log.push({
      id: c.id, prompt: c.prompt, chosen: timeout ? "(시간 초과)" : o.text, label: o.label,
      good: !!o.best && !timeout, d: S.score - before, best: best.text, why: o.why, pattern: c.pattern, timeout
    });

    const steps = [];
    if (timeout) steps.push({ t: "narr", text: "⏱ 머리가 하얘졌다. 3초가 30초처럼 느껴진다… 겨우 입을 뗀다." });
    const isAction = /^\(.*\)$/.test(o.text.trim());
    steps.push(isAction ? { t: "narr", text: o.text.replace(/^\(|\)$/g, "") } : { t: "w", text: o.text });
    (o.react || []).forEach((r) => steps.push(r));
    steps.push({ t: "heart", text: heart, d });
    if (S.mode === "learn" || timeout) {
      steps.push({ t: "coach", good: !!o.best && !timeout, timeout, why: o.why, best: best.text, pattern: c.pattern });
    }
    // 점수는 속마음 카드가 화면에 나올 때 반영
    S.score = before;
    queue = steps.map((st) => (st.t === "heart" ? Object.assign({}, st, { _apply: d }) : st));
    next();
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ───────── 결과 ───────── */
  function finish() {
    store.del("save");
    const best = store.get("best", null);
    if (best == null || S.score > best) store.set("best", S.score);

    const end = ENDINGS.find((e) => S.score >= e.min);
    const good = S.log.filter((l) => l.good).length;
    $("#ending").innerHTML = `
      <div class="e-emoji">${end.emoji}</div>
      <h2>${esc(end.title)}</h2>
      <div class="e-score">최종 호감도 <b>${S.score}</b> / 100</div>
      <div class="e-stats">
        <div><b>${good}/${S.log.length}</b>좋은 선택</div>
        <div><b>${S.score - START_SCORE >= 0 ? "+" : ""}${S.score - START_SCORE}</b>호감도 변화</div>
        <div><b>${S.mode === "real" ? "실전" : "학습"}</b>모드</div>
      </div>
      <p class="e-text">${esc(end.text)}</p>`;

    $("#report").innerHTML = S.log.map((l, n) => `
      <div class="rep ${l.good ? "good" : "bad"}">
        <div class="rep-h"><span>${n + 1}. ${l.good ? "✓" : l.timeout ? "⏱" : "✗"} ${esc(l.timeout ? "시간 초과" : l.label)}</span><span>${l.d > 0 ? "+" : ""}${l.d}</span></div>
        <div class="rep-q">${esc(l.prompt)}</div>
        <div class="rep-a">나: "${esc(l.chosen)}"</div>
        ${l.good ? "" : `<div class="rep-best">✅ ${esc(l.best)}</div>`}
        <div class="rep-why">${esc(l.why)}${l.pattern ? ` <br>📌 패턴 ${l.pattern}. ${esc(PATTERNS[l.pattern - 1][0])}` : ""}</div>
      </div>`).join("");
    show("result");
  }
  $("#retryBtn").addEventListener("click", () => startGame(S ? S.mode : "learn"));

  /* ───────── 패턴 / 사고법 ───────── */
  function renderPatterns() {
    const el = $("#patternList");
    if (el.childElementCount) return;
    el.innerHTML = PATTERNS.map((p, i) => `
      <details class="pcard"><summary><span class="pnum">${i + 1}</span><span>${esc(p[0])}</span></summary>
      <div class="pbody">${esc(p[1])}</div></details>`).join("");
  }
  function renderMethods() {
    const el = $("#methodList");
    if (el.childElementCount) return;
    el.innerHTML = METHODS.map((m, i) => `
      <details class="mcard" ${i === 0 ? "open" : ""}><summary><span class="pnum">${i + 1}</span><span>${esc(m.title)}</span></summary>
      <div class="mbody">${m.html}</div></details>`).join("");
  }

  /* ───────── 순발력 훈련 ───────── */
  let D = null;
  function startDrill() {
    D = { order: shuffle(DRILLS.map((_, i) => i)), n: 0, right: 0 };
    renderDrill();
  }
  function renderDrill() {
    const body = $("#drillBody");
    if (D.n >= D.order.length) {
      $("#drillCount").textContent = "";
      body.innerHTML = `
        <div class="ending"><div class="e-emoji">${D.right >= 7 ? "🏆" : D.right >= 5 ? "👍" : "🔁"}</div>
        <h2>${D.right} / ${D.order.length}</h2>
        <p class="e-text">${D.right >= 7 ? "상대가 흘린 걸 거의 다 잡았다. 실전 모드에 도전해보자." : "사고법을 한 번 읽고 다시 해보자. 정답보다 '왜'가 중요하다."}</p></div>
        <div class="row-btns"><button class="btn primary" id="drillAgain">다시 하기</button><button class="btn outline" data-go="methods">사고법 보기</button></div>`;
      $("#drillAgain").onclick = startDrill;
      return;
    }
    const q = DRILLS[D.order[D.n]];
    $("#drillCount").textContent = `${D.n + 1} / ${D.order.length}`;
    const opts = shuffle(q.options.map((o) => Object.assign({}, o)));
    body.innerHTML = `
      <div class="drill-say"><span class="drill-skill">${esc(q.skill)}</span><p class="drill-line">지현: "${esc(q.say)}"</p></div>
      <div class="drill-opts">${opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-text">${esc(o.text)}</span></button>`).join("")}</div>
      <div id="drillAfter"></div>`;
    body.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      const o = opts[+b.dataset.i];
      body.querySelectorAll(".opt").forEach((x) => {
        x.disabled = true;
        if (opts[+x.dataset.i].best) x.classList.add("right");
      });
      if (o.best) D.right++; else { b.classList.add("wrong"); vibrate(40); }
      $("#drillAfter").innerHTML = `<div class="drill-why">${o.best ? "✓ 정답! " : "✗ "}${esc(q.why)}</div>
        <button class="btn primary drill-next" id="drillNext">${D.n + 1 >= D.order.length ? "결과 보기" : "다음 →"}</button>`;
      $("#drillNext").onclick = () => { D.n++; renderDrill(); window.scrollTo(0, 0); };
    }));
  }

  /* ───────── 설치 (PWA) ───────── */
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    $("#installBtn").hidden = false;
  });
  $("#installBtn").addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (e) { /* 무시 */ }
    deferred = null;
    $("#installBtn").hidden = true;
  });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (isIOS && !standalone && !isNative) $("#iosHint").hidden = false;
  if (/android/i.test(navigator.userAgent) && !isNative) $("#apkLink").hidden = false;

  if ("serviceWorker" in navigator && location.protocol === "https:" && !isNative) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  renderHome();
})();
