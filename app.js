// app.js — 辞書をめくり、しおり、掛け合わせるための仕掛け
// 依存なし・ビルドなし。data.js（ELEMENTS / CATEGORIES / STRATEGIES / THEMES）を使う。

"use strict";

// ── 状態 ──────────────────────────────────────────────
const LS = {
  marked: "htmldict.marked.v1",
  combine: "htmldict.combine.v1",
  note: "htmldict.note.v1",
  theme: "htmldict.theme.v1",
};

const state = {
  mode: "card",
  order: [],          // カードをめくる順番（index の配列）
  pos: 0,             // order の中の現在位置
  marked: loadSet(LS.marked),     // しおりを挟んだ tag の集合
  combine: loadArr(LS.combine),   // 掛け合わせに選んだ tag の配列
  query: "",
  cats: new Set(),    // 一覧の絞り込み（空＝すべて）
  seed: null,         // 直近に蒔いた種
  noteSrc: localStorage.getItem(LS.note) || "",
};

const $stage = document.getElementById("stage");

// ── 永続化ヘルパ ───────────────────────────────────────
function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch (e) { return new Set(); }
}
function loadArr(key) {
  try { const a = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch (e) {}
}
function saveArr(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
}

// ── 小道具 ────────────────────────────────────────────
function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) for (const k in props) {
    if (k === "class") node.className = props[k];
    else if (k === "html") node.innerHTML = props[k];
    else if (k.startsWith("on") && typeof props[k] === "function") node.addEventListener(k.slice(2), props[k]);
    else if (props[k] != null) node.setAttribute(k, props[k]);
  }
  if (children != null) {
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
  }
  return node;
}
function byTag(tag) { return ELEMENTS.find(e => e.tag === tag); }
function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── ダークモード ──────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(LS.theme, theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "☀" : "🌙";
}
function initTheme() {
  const saved = localStorage.getItem(LS.theme);
  const theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(theme);
}
document.getElementById("themeToggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

// ── バッジの更新 ───────────────────────────────────────
function refreshBadges() {
  const mc = document.getElementById("markedCount");
  const cc = document.getElementById("combineCount");
  mc.textContent = state.marked.size;
  mc.dataset.zero = state.marked.size ? "0" : "1";
  cc.textContent = state.combine.length;
  cc.dataset.zero = state.combine.length ? "0" : "1";
}

// ── マーク／掛け合わせの操作 ───────────────────────────
function toggleMark(tag) {
  if (state.marked.has(tag)) state.marked.delete(tag);
  else state.marked.add(tag);
  saveSet(LS.marked, state.marked);
  refreshBadges();
}
function inCombine(tag) { return state.combine.includes(tag); }
function toggleCombine(tag) {
  const i = state.combine.indexOf(tag);
  if (i >= 0) state.combine.splice(i, 1);
  else state.combine.push(tag);
  saveArr(LS.combine, state.combine);
  refreshBadges();
}

// ── 生きた標本（デモ）の組み立て ───────────────────────
function buildDemo(item) {
  const wrap = el("div", { class: "demo-wrap" });
  wrap.appendChild(el("div", { class: "demo-strip" }, "生きた標本 — 下は本物のHTMLが描かれています"));
  const live = el("div", { class: "demo-live" });
  live.innerHTML = item.demo;       // データは自前。素のHTMLをそのまま描く
  wrap.appendChild(live);
  const src = el("details", { class: "demo-src" });
  src.appendChild(el("summary", null, "ソースを見る"));
  src.appendChild(el("pre", { class: "demo-code" }, item.demo));
  wrap.appendChild(src);
  return wrap;
}

// ── カード本体 ─────────────────────────────────────────
function buildCard(item, indexLabel) {
  const card = el("div", { class: "card" });

  const head = el("div", { class: "card-head" }, [
    el("div", null, [
      el("div", { class: "card-cat" }, CATEGORIES[item.category] || item.category),
      el("div", { class: "card-display" }, item.display),
    ]),
    indexLabel ? el("div", { class: "card-index" }, indexLabel) : null,
  ]);
  card.appendChild(head);

  card.appendChild(el("p", { class: "card-summary" }, item.summary));

  card.appendChild(field("詩の素材として", el("p", { class: "poetic" }, item.poetic)));
  card.appendChild(field("けしかけ", el("p", null, el("span", { class: "spark" }, item.spark))));
  card.appendChild(field("見本", buildDemo(item)));
  if (item.note) card.appendChild(field("補足", el("p", { class: "note" }, item.note)));

  // 操作
  const markBtn = el("button", {
    class: "act act-mark" + (state.marked.has(item.tag) ? " is-on" : ""),
    onclick: (e) => { toggleMark(item.tag); e.currentTarget.classList.toggle("is-on", state.marked.has(item.tag)); },
  }, state.marked.has(item.tag) ? "★ しおり済" : "☆ しおりを挟む");

  const combBtn = el("button", {
    class: "act act-combine" + (inCombine(item.tag) ? " is-on" : ""),
    onclick: (e) => { toggleCombine(item.tag); e.currentTarget.classList.toggle("is-on", inCombine(item.tag)); e.currentTarget.textContent = inCombine(item.tag) ? "◉ 掛け合わせ中" : "＋ 掛け合わせる"; },
  }, inCombine(item.tag) ? "◉ 掛け合わせ中" : "＋ 掛け合わせる");

  const actions = el("div", { class: "card-actions" }, [markBtn, combBtn]);
  card.appendChild(actions);
  return card;
}
function field(label, node) {
  return el("div", { class: "field" }, [
    el("span", { class: "field-label" }, label),
    node,
  ]);
}

// ── モード：めくる ─────────────────────────────────────
function renderCard() {
  if (!state.order.length) state.order = Array.from({ length: ELEMENTS.length }, (_, i) => i);
  $stage.innerHTML = "";

  const item = ELEMENTS[state.order[state.pos]];
  const indexLabel = (state.pos + 1) + " / " + state.order.length;
  const card = buildCard(item, indexLabel);

  const prev = el("button", { class: "act-nav", title: "前へ (←)", onclick: () => step(-1) }, "‹");
  const next = el("button", { class: "act-nav", title: "次へ (→)", onclick: () => step(1) }, "›");
  const rnd = el("button", { class: "act", title: "ランダムにめくる (R)", onclick: shuffleDeck }, "⤬ ランダム");
  const navRow = el("div", { class: "card-actions" }, [
    prev, next, el("span", { class: "act-spacer" }), rnd,
  ]);
  card.appendChild(navRow);

  $stage.appendChild(card);
  $stage.appendChild(el("p", { class: "swipe-hint", html:
    "スワイプ、または <kbd>←</kbd> <kbd>→</kbd> でめくる ／ <kbd>R</kbd> でランダム ／ <kbd>M</kbd> でしおり" }));

  enableSwipe(card);
}
function step(d) {
  state.pos = (state.pos + d + state.order.length) % state.order.length;
  renderCard();
}
function shuffleDeck() {
  state.order = shuffled(ELEMENTS.length);
  state.pos = 0;
  renderCard();
}

// スワイプ（タッチ）
// 縦スクロールやタップの揺れを「めくる」と誤判定しないよう、
// 横方向の移動が縦方向より明確に大きい場合だけページを送る。
const SWIPE_THRESHOLD = 70;   // この距離(px)未満は無視
const SWIPE_RATIO = 1.6;      // 横方向が縦方向のこれ以上ないと「横スワイプ」と認めない
function enableSwipe(node) {
  let x0 = null, y0 = null, locked = null;
  node.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) { x0 = null; return; }
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
    locked = null;
  }, { passive: true });
  node.addEventListener("touchmove", e => {
    if (x0 == null || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - x0;
    const dy = e.touches[0].clientY - y0;
    if (locked == null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      locked = Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO ? "h" : "v";
    }
  }, { passive: true });
  node.addEventListener("touchend", e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (locked === "h" && Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO) {
      step(dx < 0 ? 1 : -1);
    }
    x0 = null; y0 = null; locked = null;
  }, { passive: true });
  node.addEventListener("touchcancel", () => { x0 = null; y0 = null; locked = null; }, { passive: true });
}

// ── モード：一覧 ───────────────────────────────────────
function renderGallery() {
  $stage.innerHTML = "";
  const controls = el("div", { class: "gallery-controls" });
  const search = el("input", { class: "search", type: "search", placeholder: "タグ名・言葉で探す…", value: state.query });
  search.addEventListener("input", e => { state.query = e.target.value; drawTiles(grid); });
  controls.appendChild(search);

  const filters = el("div", { class: "cat-filters" });
  for (const key in CATEGORIES) {
    const chip = el("button", {
      class: "cat-chip" + (state.cats.has(key) ? " is-on" : ""),
      onclick: (e) => {
        if (state.cats.has(key)) state.cats.delete(key); else state.cats.add(key);
        e.currentTarget.classList.toggle("is-on", state.cats.has(key));
        drawTiles(grid);
      },
    }, CATEGORIES[key]);
    filters.appendChild(chip);
  }
  controls.appendChild(filters);
  $stage.appendChild(controls);

  const grid = el("div", { class: "grid" });
  $stage.appendChild(grid);
  drawTiles(grid);
}
function matchItem(item) {
  if (state.cats.size && !state.cats.has(item.category)) return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return (item.tag + " " + item.display + " " + item.summary + " " + item.poetic + " " + item.spark)
    .toLowerCase().includes(q);
}
function drawTiles(grid) {
  grid.innerHTML = "";
  const list = ELEMENTS.filter(matchItem);
  if (!list.length) {
    grid.appendChild(el("p", { class: "empty-note" }, "その言葉に出会う標本は、まだありません。"));
    return;
  }
  list.forEach(item => {
    const marks =
      (state.marked.has(item.tag) ? "★" : "") +
      (inCombine(item.tag) ? "◉" : "");
    const tile = el("button", { class: "tile", onclick: () => openFromGallery(item.tag) }, [
      el("div", { class: "tile-marks" }, marks),
      el("div", { class: "tile-display" }, item.display),
      el("div", { class: "tile-cat" }, CATEGORIES[item.category]),
    ]);
    grid.appendChild(tile);
  });
}
function openFromGallery(tag) {
  const idx = ELEMENTS.findIndex(e => e.tag === tag);
  state.order = Array.from({ length: ELEMENTS.length }, (_, i) => i);
  state.pos = idx;
  switchMode("card");
}

// ── モード：しおり ─────────────────────────────────────
function renderMarked() {
  $stage.innerHTML = "";
  const items = ELEMENTS.filter(e => state.marked.has(e.tag));
  $stage.appendChild(el("p", { class: "combine-intro" },
    items.length ? "しおりを挟んだ標本。気になったものは、ここに集まります。"
                 : ""));
  if (!items.length) {
    $stage.appendChild(el("p", { class: "empty-note", html:
      "まだ、しおりはありません。<br>「めくる」や「一覧」で ☆ を押すと、ここに集まります。" }));
    return;
  }
  const grid = el("div", { class: "grid" });
  items.forEach(item => {
    const tile = el("button", { class: "tile", onclick: () => openFromGallery(item.tag) }, [
      el("div", { class: "tile-marks" }, (inCombine(item.tag) ? "◉" : "") + "★"),
      el("div", { class: "tile-display" }, item.display),
      el("div", { class: "tile-cat" }, CATEGORIES[item.category]),
    ]);
    grid.appendChild(tile);
  });
  $stage.appendChild(grid);

  const clear = el("button", { class: "act", onclick: () => {
    state.marked.clear(); saveSet(LS.marked, state.marked); refreshBadges(); renderMarked();
  }}, "しおりをすべて外す");
  $stage.appendChild(el("div", { class: "card-actions" }, [el("span", { class: "act-spacer" }), clear]));
}

// ── モード：掛け合わせ ─────────────────────────────────
function renderCombine() {
  $stage.innerHTML = "";

  // 種をまく（ランダム生成）
  const seedBox = el("div", { class: "seed-box" });
  seedBox.appendChild(el("span", { class: "field-label" }, "種をまく — 偶然から、詩の核を取り出す"));
  const seedBody = el("div", { id: "seedBody" });
  seedBox.appendChild(seedBody);
  const sowBtn = el("button", { class: "btn-primary", onclick: () => { sowSeed(); drawSeed(seedBody); } },
    state.seed ? "もう一度、種をまく" : "種をまく");
  seedBox.appendChild(sowBtn);
  $stage.appendChild(seedBox);
  drawSeed(seedBody);

  // 手で選んだ掛け合わせ
  $stage.appendChild(el("span", { class: "field-label" }, "選んだ標本を、組み合わせる"));
  if (!state.combine.length) {
    $stage.appendChild(el("p", { class: "empty-note", html:
      "まだ、掛け合わせる標本がありません。<br>各カードで「＋ 掛け合わせる」を押すと、ここに集まります。<br>2つ以上で、組み合わせの問いが立ち上がります。" }));
    return;
  }
  const list = el("div", { class: "combine-list" });
  state.combine.forEach(tag => {
    const item = byTag(tag);
    if (!item) return;
    const row = el("div", { class: "combine-item" }, [
      el("div", { class: "ci-display" }, item.display),
      el("div", { class: "ci-body" }, [
        el("div", { class: "ci-summary", html: "<small>" + item.summary + "</small>" }),
        el("div", { class: "ci-spark" }, item.spark),
      ]),
      el("button", { class: "combine-remove", title: "外す", onclick: () => { toggleCombine(tag); renderCombine(); } }, "✕"),
    ]);
    list.appendChild(row);
  });
  $stage.appendChild(list);

  if (state.combine.length >= 2) {
    $stage.appendChild(buildProvocation(state.combine.map(byTag).filter(Boolean)));
  }

  const clear = el("button", { class: "act", onclick: () => {
    state.combine = []; saveArr(LS.combine, state.combine); refreshBadges(); renderCombine();
  }}, "組み合わせを空にする");
  $stage.appendChild(el("div", { class: "card-actions" }, [el("span", { class: "act-spacer" }), clear]));
}

function buildProvocation(items) {
  const names = items.map(i => i.display).join(" と ");
  const strat = pick(STRATEGIES);
  const theme = pick(THEMES);
  const box = el("div", { class: "provocation" });
  box.appendChild(el("span", { class: "pv-label" }, "組み合わせの問い"));
  box.appendChild(el("div", { class: "pv-text", html:
    `<b>${names}</b> を、ひとつの作品の中で出会わせる。<br>` +
    `そのとき——「${strat}」<br>` +
    `題材は、たとえば〈${theme}〉。` }));
  return box;
}

function sowSeed() {
  const n = 2 + Math.floor(Math.random() * 2); // 2〜3 個
  const order = shuffled(ELEMENTS.length).slice(0, n);
  state.seed = {
    tags: order.map(i => ELEMENTS[i].tag),
    strategy: pick(STRATEGIES),
    theme: pick(THEMES),
  };
}
function drawSeed(container) {
  container.innerHTML = "";
  if (!state.seed) {
    container.appendChild(el("p", { class: "note", html:
      "ボタンを押すと、いくつかの標本と、詩の方位と、ひとつの題材が、偶然に選ばれます。<br>選ばれた組から、まだ無い詩を想像してみてください。" }));
    return;
  }
  const tagsRow = el("div", { class: "seed-tags" });
  state.seed.tags.forEach((tag, i) => {
    if (i) tagsRow.appendChild(el("span", { class: "seed-x" }, "×"));
    const item = byTag(tag);
    const chip = el("button", { class: "seed-tag", title: "この標本を開く", onclick: () => openFromGallery(tag) }, item ? item.display : tag);
    tagsRow.appendChild(chip);
  });
  container.appendChild(tagsRow);
  container.appendChild(el("p", null, el("span", { class: "seed-strategy" }, state.seed.strategy)));
  container.appendChild(el("p", { class: "seed-theme", html: `題材 — <b>${state.seed.theme}</b>` }));

  // 種を、そのまま掛け合わせに送れる
  const send = el("button", { class: "act", onclick: () => {
    state.seed.tags.forEach(t => { if (!inCombine(t)) toggleCombine(t); });
    renderCombine();
  }}, "この組を、掛け合わせに加える");
  container.appendChild(el("div", { class: "card-actions" }, [el("span", { class: "act-spacer" }), send]));
}

// ── モード：読み方（about）─────────────────────────────
function renderAbout() {
  $stage.innerHTML = "";
  const a = el("div", { class: "about", html: `
    <h2>この辞典について</h2>
    <p>これは、<b>素のHTMLだけ</b>で詩的な作品をつくるための、発想の道具です。
    CSSもJavaScriptも使わず、HTML5 が生まれつき持っている機能だけで、何が表現できるか。
    その素材を一つひとつ眺め、しおりを挟み、掛け合わせるための、辞書のようなビューアです。</p>
    <p><small>※「作品」は素のHTMLで。けれど、この発想を助ける「ツール」自体は、
    ランダムやしおりの保存のために、少しだけCSS/JSを使っています。</small></p>

    <h2>使い方</h2>
    <ul>
      <li><b>めくる</b> — 標本を1枚ずつ。スワイプ、<code>←</code> <code>→</code>、または「ランダム」で偶然に出会う。</li>
      <li><b>一覧</b> — すべてを俯瞰。言葉で探す、種類で絞る。</li>
      <li><b>しおり</b> — 気になった標本を ☆ で挟み、あとで見返す。（この端末に保存されます）</li>
      <li><b>掛け合わせ</b> — 複数を選んで組み合わせ、「問い」を立ち上げる。あるいは「種をまく」で、偶然に任せる。</li>
    </ul>
    <p class="note">★ しおり と ◉ 掛け合わせ は、このブラウザの中だけに記憶されます（localStorage）。</p>

    <h2>キーボード</h2>
    <ul>
      <li><code>←</code> / <code>→</code> … 前後にめくる</li>
      <li><code>R</code> … ランダムにめくり直す</li>
      <li><code>M</code> … 今のカードに、しおりを挟む／外す</li>
    </ul>

    <h2>到達点 — 純HTMLの作例</h2>
    <p>この辞典が向かう先。下は、CSSもJSも一切使わない、素のHTMLだけの小さな詩です。
    ソースを開いて、どのタグで出来ているか確かめてみてください。</p>
    <div class="examples">
      <a class="ex-card" href="examples/details-confession.html"><b>告白</b><span>&lt;details&gt; で、開くまで届かない言葉</span></a>
      <a class="ex-card" href="examples/alt-unseen.html"><b>見えない絵</b><span>&lt;img alt&gt; だけに書かれた風景</span></a>
      <a class="ex-card" href="examples/ruby-double.html"><b>二重の声</b><span>&lt;ruby&gt; で、表記と読みをずらす</span></a>
      <a class="ex-card" href="examples/eternal-morning.html"><b>終わらない朝</b><span>&lt;meta refresh&gt; で巡るループ詩</span></a>
    </div>

    <h2>タグ標本箱</h2>
    <p>タグそのものを、昆虫標本のように一匹ずつ並べて眺めるための別室です。
    HTML5 のタグを「採集された種」として、目(Order)ごとに分類してあります。</p>
    <div class="examples">
      <a class="ex-card" href="specimen/case.html"><b>標本ケース（画面）</b><span>木箱にピンで留めた114匹を眺める</span></a>
      <a class="ex-card" href="specimen/labels.html"><b>標本ラベル（印刷用）</b><span>切って箱にピン留めする物理標本箱用</span></a>
    </div>
  ` });
  $stage.appendChild(a);
}

// ── モード：ノオト（自由なHTMLエディタ＆リアルタイムViewer）──
function renderNote() {
  $stage.innerHTML = "";
  const wrap = el("div", { class: "note-wrap" });

  const editor = el("textarea", {
    class: "note-editor",
    placeholder: "ここに、素のHTMLを自由に書いてください…",
    spellcheck: "false",
  });
  editor.value = state.noteSrc;

  const live = el("div", { class: "note-live demo-live" });
  const update = () => { live.innerHTML = state.noteSrc; };
  update();

  editor.addEventListener("input", e => {
    state.noteSrc = e.target.value;
    localStorage.setItem(LS.note, state.noteSrc);
    update();
  });

  wrap.appendChild(el("div", { class: "note-pane" }, [
    el("span", { class: "field-label" }, "エディタ"),
    editor,
  ]));
  wrap.appendChild(el("div", { class: "note-pane" }, [
    el("span", { class: "field-label" }, "ビュー（リアルタイム）"),
    live,
  ]));
  $stage.appendChild(wrap);

  const clear = el("button", { class: "act", onclick: () => {
    state.noteSrc = ""; localStorage.removeItem(LS.note);
    editor.value = ""; update();
  }}, "ノオトを空にする");
  $stage.appendChild(el("div", { class: "card-actions" }, [el("span", { class: "act-spacer" }), clear]));
  $stage.appendChild(el("p", { class: "note" }, "ここで書いたHTMLは、この端末に保存されます（localStorage）。"));
}

// ── モード切り替え ─────────────────────────────────────
const RENDERERS = {
  card: renderCard,
  gallery: renderGallery,
  marked: renderMarked,
  combine: renderCombine,
  about: renderAbout,
  note: renderNote,
};
function switchMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-btn").forEach(b =>
    b.classList.toggle("is-active", b.dataset.mode === mode));
  (RENDERERS[mode] || renderCard)();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── 起動 ──────────────────────────────────────────────
document.getElementById("modes").addEventListener("click", e => {
  const btn = e.target.closest(".mode-btn");
  if (btn) switchMode(btn.dataset.mode);
});

document.addEventListener("keydown", e => {
  if (e.target.matches("input, textarea, [contenteditable]")) return;
  if (state.mode !== "card") return;
  if (e.key === "ArrowRight") { step(1); }
  else if (e.key === "ArrowLeft") { step(-1); }
  else if (e.key === "r" || e.key === "R") { shuffleDeck(); }
  else if (e.key === "m" || e.key === "M") {
    const item = ELEMENTS[state.order[state.pos]];
    toggleMark(item.tag); renderCard();
  }
});

initTheme();
refreshBadges();
switchMode("card");
