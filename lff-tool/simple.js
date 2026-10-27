/* Lou's Fancy Foods — Simple editor (the socials asset tool).
   One template: a photo, any number of text boxes and the logo.
   - Text boxes: drag anywhere; set sizes XS–XL; brand fonts.
   - Logo: set sizes XS–XL, centred at the top, middle or bottom; can animate (anim.js).
   Brand rules kept: PP Monument Extended is always ALL CAPS and tracked +250; photos get the
   warm Lou's grade (switchable); anything sitting on a photo gets a soft shadow. */

const C = { cream: "#FFFFFF", esp: "#4E3524", brown: "#4E3524", olive: "#6D712E" };   // LFF guidelines v1.0: white / 2322 C / 5757 C (keys kept for compatibility)
const SIZES = { portrait: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };
const FONTS = {
  mono: { css: '400 {px}px "PP Monument Extended"', caps: true, track: 0.25, lh: 1.08 },
  "mono-light": { css: '300 {px}px "PP Monument Extended"', caps: true, track: 0.25, lh: 1.08 },
};
const STEPS = ["XS", "S", "M", "L", "XL"];
const TEXT_PX = { XS: 2.6, S: 3.6, M: 5, L: 6.8, XL: 9 };          // % of the frame width
const LOGO_W = { XS: 0.2, S: 0.28, M: 0.38, L: 0.5, XL: 0.64 };     // width for a 2.35:1 mark, scaled by shape
const LOGO_LIST = ["combination", "script", "lous", "lff", "sans_stack", "sans_h", "bonus"];
const STORE = "lff-simple-v2";

const newText = (o = {}) => ({ text: "New text", font: "mono", size: "M", color: "cream", align: "center", x: 0.5, y: 0.45, ...o });   // x = the align anchor
const DEFAULTS = {
  size: "portrait", warm: true, soft: true, bg: "esp",
  texts: [newText({ text: "Fresh out of\nthe kitchen", align: "left", x: 0.074, y: 0.07 })], cur: 0,
  logoOn: true, logo: "combination", logoSize: "M", logoPos: "bottom", logoColor: "cream",
  px: 50, py: 50, anim: "static", guides: false,
};
let S = load();
let photo = null;
let photoFx = null;   // { graded, soft } from LFFPhoto.process — the Lou's photo filter, made once per photo
let sel = null;            // index of the text box being dragged, or "logo"
let BOX = { texts: [] };   // last drawn bounds (canvas px)
let snapX = null;          // x (canvas px) of the line a dragged text box snapped to
const MARGIN = 0.074;      // left/right margin as a share of the width (same as the guides)
let RS = 1;                // render scale (shadow blur is in device px)
const T0 = performance.now();
const clock = () => (performance.now() - T0) / 1000;

const $ = q => document.querySelector(q);
const cv = $("#c"), ctx = cv.getContext("2d");
const T = () => S.texts[S.cur];          // the text box being edited (or undefined)
// colour rules on a plain background (a photo allows any colour):
//  - never the same colour as the background (text and logo)
//  - never olive on brown, never brown on olive (text and logo)
const NAMES = { cream: "White", esp: "Brown", olive: "Olive" };
function blocked(name, forLogo) {
  if (photo) return false;
  if (name === S.bg) return "Same colour as the background";
  if (name === "olive" && S.bg === "esp") return forLogo ? "Olive isn't used on brown" : "Olive text isn't used on brown";
  if (name === "esp" && S.bg === "olive") return forLogo ? "Brown isn't used on olive" : "Brown text isn't used on olive";
  return false;
}
const allowed = (name, forLogo) => blocked(name, forLogo) ? ["cream", "esp", "olive"].find(n => !blocked(n, forLogo)) : name;
const textInk = tb => allowed(tb.color, false);
const logoInk = () => allowed(S.logoColor, true);
// store the allowed colours, so the panel shows what's actually used
function fixColours() {
  S.texts.forEach(t => { t.color = textInk(t); });
  S.logoColor = logoInk();
}

function load() {
  try {
    const s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || "{}"));
    if (!Array.isArray(s.texts)) s.texts = DEFAULTS.texts;
    s.cur = Math.min(s.cur || 0, s.texts.length - 1);
    s.texts.forEach(t => { if (!FONTS[t.font]) t.font = "mono"; });   // GT America is not a brand font
    return s;
  } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
}
function savePhoto(src) {
  try { if (src) localStorage.setItem(STORE + "-photo", src); else localStorage.removeItem(STORE + "-photo"); } catch (e) {}
}

/* ---------- drawing ---------- */
const PATHS = {};
const paths = k => PATHS[k] || (PATHS[k] = LOGOS[k].paths.map(d => new Path2D(d)));
function drawLogo(c, key, x, y, w, color) {
  const L = LOGOS[key], s = w / L.w;
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = color;
  for (const p of paths(key)) c.fill(p);
  c.restore();
  return { x, y, w, h: L.h * s };
}
function withShadow(c, on, W, fn) {
  c.save();
  if (on) { c.shadowColor = "rgba(34,14,2,.42)"; c.shadowBlur = W * 0.018 * RS; c.shadowOffsetY = W * 0.0035 * RS; }
  fn(); c.restore();
}
function drawPhoto(c, W, H) {
  const s = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
  const iw = photo.naturalWidth * s, ih = photo.naturalHeight * s;
  const ix = (W - iw) * S.px / 100, iy = (H - ih) * S.py / 100;
  // Lou's photo filter: white balance + 3000K warmth, levels, vibrance, and (optionally) the soft portrait background
  const src = S.warm && photoFx ? (S.soft !== false ? photoFx.soft : photoFx.graded) : photo;
  c.drawImage(src, ix, iy, iw, ih);
}
function measureText(c, W, tb) {
  const F = FONTS[tb.font]; let px = W * TEXT_PX[tb.size] / 100;
  const lines = String(tb.text).split("\n").map(l => F.caps ? l.toUpperCase() : l);
  // measure the visible ink of each line (not the advance), so left / centre / right line up
  // on the letters themselves, without side-bearings or the trailing letter-space
  let ink;
  const measure = () => {
    c.font = F.css.replace("{px}", px);
    if ("letterSpacing" in c) c.letterSpacing = `${F.track * px}px`;
    ink = lines.map(l => { if (!l.trim()) return { l: 0, r: 0 };
      const m = c.measureText(l); return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight }; });
    return ink.map(k => Math.max(0, k.l + k.r));
  };
  let widths = measure();
  const widest = Math.max(1, ...widths), maxW = W * (1 - 2 * MARGIN);   // margin to margin
  if (widest > maxW) { px *= maxW / widest; widths = measure(); }   // never run off the edge
  return { px, lines, widths, ink, w: Math.max(1, ...widths), lh: px * F.lh, F };
}
// Story: Instagram covers the top ~250 px and bottom ~340 px, so text boxes are kept between them
function safeY(H) {
  if (S.size !== "story") return [0, H];
  const pad = SIZES.story[0] * 0.03;
  return [H * 250 / 1920 + pad, H - H * 340 / 1920 - pad];
}
function clampTextY(tb, H, boxH) {
  const [lo, hi] = safeY(H);
  return Math.max(lo, Math.min(tb.y * H, hi - boxH));
}
// logo box: centred, at the top / middle / bottom (inside the margins, and the Story safe area)
function logoBox(W, H) {
  const L = LOGOS[S.logo], aspect = L.w / L.h;
  const w = Math.min(W * 0.86, W * LOGO_W[S.logoSize] * Math.sqrt(aspect / 2.35)), h = w / aspect;
  const m = W * 0.074, story = S.size === "story";
  const top = story ? H * 250 / 1920 + m * 0.4 : m, bot = story ? H * 340 / 1920 + m * 0.4 : m;
  const y = S.logoPos === "top" ? top : S.logoPos === "middle" ? (H - h) / 2 : H - bot - h;
  return { x: (W - w) / 2, y, w, h };
}
// t = seconds into the 5 s loop, or null for the finished (still) logo
function render(c, W, H, preview, t = null) {
  c.clearRect(0, 0, W, H);
  c.fillStyle = C[S.bg]; c.fillRect(0, 0, W, H);
  if (photo) drawPhoto(c, W, H);   // no placeholder text: the hint under the design and the drop overlay cover it
  const onPhoto = !!photo;
  BOX = { texts: [] };
  if (S.logoOn) {
    // construction fill (Construction movement): olive on white; white on brown and on olive (olive and brown never touch)
    const ink = logoInk(), b = logoBox(W, H), col = C[ink], accent = (ink === "olive" || (!photo && S.bg !== "cream")) ? C.cream : C.olive;
    withShadow(c, onPhoto, W, () => {
      if (S.anim !== "static" && t !== null) drawLogoAnimated(c, S.logo, b.x, b.y, b.w, col, accent, t, S.anim, Math.min(W, H) / 100);
      else drawLogo(c, S.logo, b.x, b.y, b.w, col);
    });
    BOX.logo = b;
  }
  S.texts.forEach((tb, i) => {
    if (!tb.text.trim()) { BOX.texts[i] = null; return; }
    const m = measureText(c, W, tb), ax = tb.x * W;
    const boxH = m.px * 0.78 + (m.lines.length - 1) * m.lh + m.px * 0.08, top = clampTextY(tb, H, boxH);
    const x0 = tb.align === "left" ? ax : tb.align === "center" ? ax - m.w / 2 : ax - m.w;
    withShadow(c, onPhoto, W * 0.6, () => {
      c.fillStyle = C[textInk(tb)]; c.textBaseline = "alphabetic"; c.textAlign = "left";
      m.lines.forEach((l, k) => {   // pen x so the line's ink edge / ink centre sits on the anchor
        const { l: il, r: ir } = m.ink[k];
        const lx = tb.align === "left" ? ax + il : tb.align === "center" ? ax - (ir - il) / 2 : ax - ir;
        c.fillText(l, lx, top + m.px * 0.78 + k * m.lh);
      });
    });
    BOX.texts[i] = { x: x0, y: top, w: m.w, h: boxH };
  });
  if (preview && S.guides) drawGuides(c, W, H);
  if (preview) {
    if (snapX !== null) twoTone(c, W, W * 0.002, () => { c.moveTo(snapX, 0); c.lineTo(snapX, H); });
    const outline = (b, solid) => { if (!b) return; const p = W * 0.012;
      twoTone(c, W, W * 0.003, () => c.rect(b.x - p, b.y - p, b.w + 2 * p, b.h + 2 * p), solid); };
    if (S.texts.length > 1 || hover === S.cur) outline(BOX.texts[S.cur], true);   // which box the panel is editing
    if (typeof hover === "number" && hover !== S.cur) outline(BOX.texts[hover], false);
    if (hover === "logo") outline(BOX.logo, false);
  }
}
// helper lines that stay visible on any background (white, brown, olive or a photo):
// brown and white dashes alternating along the same path; `solid` = brown line + white dashes
function twoTone(c, W, lw, path, solid) {
  const d = W * 0.009;
  c.save(); c.lineWidth = lw; c.beginPath(); path();
  c.strokeStyle = C.esp; c.setLineDash(solid ? [] : [d, d]); c.stroke();
  c.strokeStyle = C.cream; c.setLineDash([d, d]); c.lineDashOffset = solid ? 0 : d; c.stroke();
  c.restore();
}
// layout guides (preview only): margins, centre lines, and the Story safe area
function drawGuides(c, W, H) {
  const m = W * 0.074, lw = W * 0.0018;
  twoTone(c, W, lw, () => c.rect(m, m, W - 2 * m, H - 2 * m));
  twoTone(c, W, lw, () => { c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.moveTo(0, H / 2); c.lineTo(W, H / 2); });
  if (S.size === "story") {   // Instagram covers ~250 px top (profile) and ~340 px bottom (reply bar)
    const top = H * 250 / 1920, bot = H * 340 / 1920;
    c.save();
    c.fillStyle = "rgba(78,53,36,.38)"; c.fillRect(0, 0, W, top); c.fillRect(0, H - bot, W, bot);   // dim the covered strips
    c.restore();
    twoTone(c, W, lw, () => { c.moveTo(0, top); c.lineTo(W, top); c.moveTo(0, H - bot); c.lineTo(W, H - bot); });
    c.save(); c.font = `400 ${W * 0.02}px "GT America"`; if ("letterSpacing" in c) c.letterSpacing = "0px";
    c.fillStyle = C.cream; c.shadowColor = "rgba(34,14,2,.8)"; c.shadowBlur = W * 0.006 * RS;
    c.fillText("Covered by Instagram", m, top - W * 0.022); c.fillText("Covered by Instagram", m, H - bot + W * 0.04);
    c.restore();
  }
}
function animating() { return S.anim !== "static" && TAB === "insta"; }
function draw() {
  const [W, H] = SIZES[S.size];
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  RS = 1;
  render(ctx, W, H, true, animating() ? clock() : null);
}
let PLAYING = false;
function play() {
  if (PLAYING || !animating()) return;
  PLAYING = true;
  const tick = () => { if (!animating()) { PLAYING = false; draw(); return; } draw(); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ---------- direct manipulation on the canvas ---------- */
let hover = null, drag = null, TAB = "insta";
function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height];
}
const inside = (b, x, y, pad) => b && x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad;
// text boxes first (last added on top), then the logo, then the photo
function pick(x, y) {
  const pad = cv.width * 0.015;
  for (let i = S.texts.length - 1; i >= 0; i--) if (inside(BOX.texts[i], x, y, pad)) return i;
  if (inside(BOX.logo, x, y, pad)) return "logo";
  return photo ? "photo" : null;
}
cv.addEventListener("pointermove", e => {
  const [x, y] = toCanvas(e);
  if (!drag) {
    const p = pick(x, y), h = p === "photo" ? null : p;
    cv.style.cursor = p === "photo" ? "grab" : p === "logo" ? "pointer" : p !== null ? "move" : "default";
    if (h !== hover) { hover = h; draw(); }
    return;
  }
  const W = cv.width, H = cv.height, dx = x - drag.x, dy = y - drag.y;
  snapX = null;
  if (typeof drag.what === "number") {
    const tb = S.texts[drag.what], b = BOX.texts[drag.what];
    let tx = drag.s.x + dx / W;
    if (b) {   // snap the box's left edge / middle / right edge to the left margin / centre / right margin
      const bw = b.w / W, left = tb.align === "left" ? tx : tb.align === "center" ? tx - bw / 2 : tx - bw;
      const lines = [[left, MARGIN], [left + bw / 2, 0.5], [left + bw, 1 - MARGIN]];
      for (const [edge, line] of lines) if (Math.abs(edge - line) < 0.02) { tx += line - edge; snapX = line * W; break; }
    }
    tb.x = tx; tb.y = drag.s.y + dy / H;
  } else if (drag.what === "photo") {
    const s = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    const ox = photo.naturalWidth * s - W, oy = photo.naturalHeight * s - H;
    if (ox > 1) S.px = Math.max(0, Math.min(100, drag.s.px - dx / ox * 100));
    if (oy > 1) S.py = Math.max(0, Math.min(100, drag.s.py - dy / oy * 100));
  }
  draw();
});
cv.addEventListener("pointerdown", e => {
  const [x, y] = toCanvas(e), what = pick(x, y);
  if (what === null) { if (!photo) $("#file").click(); return; }
  if (what === "logo") {   // the logo isn't dragged: it lives at top / middle / bottom
    const order = ["top", "middle", "bottom"];
    S.logoPos = order[(order.indexOf(S.logoPos) + 1) % 3]; save(); sync(); return;
  }
  cv.setPointerCapture(e.pointerId);
  if (typeof what === "number") {
    S.cur = what; const b = BOX.texts[what];
    drag = { what, x, y, s: { ...S.texts[what], y: b ? b.y / cv.height : S.texts[what].y } }; syncText();
  }
  else { drag = { what, x, y, s: { px: S.px, py: S.py } }; cv.style.cursor = "grabbing"; }
  draw();
});
const endDrag = () => { if (!drag) return; drag = null; snapX = null; save(); draw(); };
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
cv.addEventListener("pointerleave", () => { if (!drag && hover !== null) { hover = null; draw(); } });
cv.addEventListener("dblclick", e => {
  const [x, y] = toCanvas(e), p = pick(x, y);
  if (typeof p === "number") { S.cur = p; syncText(); const t = $("#text"); t.focus(); t.select(); }
});

/* ---------- photo in ---------- */
function useFile(f) {
  if (!f || !f.type.startsWith("image/")) return;
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {   // shrink big photos so they stay quick and can be remembered
      const k = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
      const t = document.createElement("canvas"); t.width = Math.round(img.naturalWidth * k); t.height = Math.round(img.naturalHeight * k);
      t.getContext("2d").drawImage(img, 0, 0, t.width, t.height);
      const src = t.toDataURL("image/jpeg", 0.9);
      setPhoto(src); savePhoto(src); S.px = 50; S.py = 50; save();
    };
    img.src = r.result;
  };
  r.readAsDataURL(f);
}
function setPhoto(src) {
  if (!src) { photo = null; sync(); return; }
  const img = new Image();
  img.onload = () => { photo = img; photoFx = window.LFFPhoto ? LFFPhoto.process(img) : null; sync(); };
  img.src = src;
}
let dragDepth = 0;
window.addEventListener("dragenter", e => { e.preventDefault(); dragDepth++; document.body.classList.add("dragging"); });
window.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove("dragging"); } });
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => {
  e.preventDefault(); dragDepth = 0; document.body.classList.remove("dragging");
  useFile(e.dataTransfer.files[0]);
});
$("#choose").onclick = () => $("#file").click();
$("#file").onchange = e => { useFile(e.target.files[0]); e.target.value = ""; };
$("#remove").onclick = () => { photo = null; photoFx = null; savePhoto(null); fixColours(); save(); setPhoto(null); };

/* ---------- panel ---------- */
function swatches() {
  document.querySelectorAll(".swatches").forEach(box => {
    const key = box.dataset.for;
    box.innerHTML = "";
    for (const name of ["cream", "esp", "olive"]) {
      const b = document.createElement("button");
      b.style.background = C[name]; b.title = { cream: "White", esp: "Brown", olive: "Olive" }[name];
      b.dataset.v = name;
      b.onclick = () => {
        if (key === "textColor") { if (T()) T().color = name; } else S[key] = name;
        fixColours(); save(); sync();
      };
      box.appendChild(b);
    }
  });
}
function steps(boxSel, onPick) {
  const box = $(boxSel);
  box.innerHTML = STEPS.map(s => `<button data-v="${s}">${s}</button>`).join("");
  box.querySelectorAll("button").forEach(b => b.onclick = () => onPick(b.dataset.v));
}
function logoTiles() {
  const box = $("#logos");
  for (const k of LOGO_LIST) {
    const L = LOGOS[k], b = document.createElement("button"), t = document.createElement("canvas");
    const wide = L.w / L.h > 5; if (wide) b.classList.add("wide");
    const maxW = wide ? 240 : 110, maxH = 40, s = Math.min(maxW / L.w, maxH / L.h);
    t.width = Math.ceil(L.w * s * 2); t.height = Math.ceil(L.h * s * 2); t.style.width = L.w * s + "px";
    drawLogo(t.getContext("2d"), k, 0, 0, t.width, C.esp);
    b.appendChild(t); b.dataset.v = k;
    b.onclick = () => { S.logo = k; save(); sync(); };
    box.appendChild(b);
  }
}
function onClass(sel2, attr, val) {
  document.querySelectorAll(sel2).forEach(b => b.classList.toggle("on", b.dataset[attr] === val));
}
// the text-box list + the editor for the current box
function syncText() {
  const list = $("#text-list"), tb = T();
  list.innerHTML = S.texts.map((t, i) => {
    const label = (t.text.split("\n")[0] || "Empty").slice(0, 18);
    return `<button data-i="${i}" class="${i === S.cur ? "on" : ""}">${label.replace(/</g, "&lt;")}</button>`;
  }).join("");
  list.querySelectorAll("button").forEach(b => b.onclick = () => { S.cur = +b.dataset.i; save(); sync(); });
  list.classList.toggle("hidden", S.texts.length < 2);
  $(".when-text").classList.toggle("hidden", !tb);
  if (!tb) return;
  if (document.activeElement !== $("#text")) $("#text").value = tb.text;
  onClass("#fonts button", "font", tb.font);
  onClass("#align button", "align", tb.align);
  onClass("#text-sizes button", "v", tb.size);
  $('[data-for="textColor"]').querySelectorAll("button").forEach(b => {
    const why = blocked(b.dataset.v, false);
    b.disabled = !!why; b.title = why || NAMES[b.dataset.v];
    b.classList.toggle("on", b.dataset.v === textInk(tb));
  });
}
function sync() {
  onClass("#sizes button", "size", S.size);
  onClass("#logos button", "v", S.logo);
  onClass("#logo-sizes button", "v", S.logoSize);
  onClass("#logo-pos button", "pos", S.logoPos);
  onClass("#anim button", "anim", S.anim);
  $("#guides").checked = S.guides;
  const still = S.anim === "static";
  document.querySelectorAll(".needs-anim").forEach(b => b.disabled = still);
  $("#dl-note").textContent = still ? "For a video or GIF, pick a Movement under Logo." : "";
  document.querySelectorAll(".swatches:not([data-for=textColor])").forEach(box => box.querySelectorAll("button").forEach(b => {
    const why = box.dataset.for === "logoColor" ? blocked(b.dataset.v, true) : false;
    b.disabled = !!why; b.title = why || NAMES[b.dataset.v];
    b.classList.toggle("on", b.dataset.v === (box.dataset.for === "logoColor" ? logoInk() : S[box.dataset.for]));
  }));
  $("#warm").checked = S.warm;
  $("#soft").checked = S.soft !== false; $("#soft").disabled = !S.warm;
  $("#logo-on").checked = S.logoOn;
  $(".when-logo").classList.toggle("hidden", !S.logoOn);
  $(".when-nophoto").classList.toggle("hidden", !!photo);
  $("#remove").classList.toggle("hidden", !photo);
  $("#warm").parentElement.classList.toggle("hidden", !photo);
  $("#soft").parentElement.classList.toggle("hidden", !photo);
  $("#shoot-tip").classList.toggle("hidden", !!photo);
  $("#choose").textContent = photo ? "Change photo" : "Choose photo";
  syncText();
  draw(); play();
}
function bindPanel() {
  document.querySelectorAll("#sizes button").forEach(b => b.onclick = () => { S.size = b.dataset.size; save(); sync(); });
  document.querySelectorAll("#fonts button").forEach(b => b.onclick = () => { if (T()) T().font = b.dataset.font; save(); sync(); });
  // Left / Centre / Right puts the box on the left margin, the centre of the frame or the right margin
  document.querySelectorAll("#align button").forEach(b => b.onclick = () => {
    const tb = T(); if (!tb) return;
    tb.align = b.dataset.align;
    tb.x = { left: MARGIN, center: 0.5, right: 1 - MARGIN }[tb.align];
    save(); sync();
  });
  steps("#text-sizes", v => { if (T()) T().size = v; save(); sync(); });
  steps("#logo-sizes", v => { S.logoSize = v; save(); sync(); });
  document.querySelectorAll("#logo-pos button").forEach(b => b.onclick = () => { S.logoPos = b.dataset.pos; save(); sync(); });
  $("#add-text").onclick = () => {
    const n = S.texts.length, dark = photo || S.bg !== "cream";
    S.texts.push(newText({ y: Math.min(0.8, 0.4 + n * 0.07), color: dark ? "cream" : "esp" }));
    fixColours();
    S.cur = S.texts.length - 1; save(); sync();
    const t = $("#text"); t.focus(); t.select();
  };
  $("#del-text").onclick = () => {
    if (!T()) return;
    S.texts.splice(S.cur, 1); S.cur = Math.max(0, Math.min(S.cur, S.texts.length - 1)); save(); sync();
  };
  $("#warm").onchange = e => { S.warm = e.target.checked; save(); sync(); };
  $("#soft").onchange = e => { S.soft = e.target.checked; save(); sync(); };
  $("#logo-on").onchange = e => { S.logoOn = e.target.checked; save(); sync(); };
  $("#text").oninput = e => { if (T()) T().text = e.target.value; save(); draw();
    const chip = $(`#text-list [data-i="${S.cur}"]`); if (chip) chip.textContent = (e.target.value.split("\n")[0] || "Empty").slice(0, 18); };
  $("#reset").onclick = () => { if (!confirm("Start over? This clears the photo and text.")) return;
    S = JSON.parse(JSON.stringify(DEFAULTS)); save(); savePhoto(null); setPhoto(null); };
  document.querySelectorAll("#anim button").forEach(b => b.onclick = () => { S.anim = b.dataset.anim; save(); sync(); });
  $("#guides").onchange = e => { S.guides = e.target.checked; save(); sync(); };
  const menu = $("#dl-menu");
  $("#download").onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener("click", e => { if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") menu.hidden = true; });
  menu.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => {
    menu.hidden = true;
    if (b.dataset.dl === "png") download(); else exportVideo(b.dataset.dl);
  });
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
    TAB = t.dataset.tab;
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === "view-" + TAB));
    $("#download").parentElement.style.visibility = TAB === "insta" ? "" : "hidden";
    sync();
  });
}

/* ---------- export ---------- */
function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return `lous_${S.size}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
function save_(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Saved " + name);
}
// draw one export frame at scale s into canvas c (t = null → finished logo)
function frame(c, s, t) {
  const [W, H] = SIZES[S.size], x = c.getContext("2d");
  x.setTransform(s, 0, 0, s, 0, 0); RS = s;
  render(x, W, H, false, t);
  x.setTransform(1, 0, 0, 1, 0, 0); RS = 1;
}
function download() {   // the still always shows the finished logo
  const [W, H] = SIZES[S.size], c = document.createElement("canvas");
  c.width = W; c.height = H; frame(c, 1, null);
  c.toBlob(b => save_(b, stamp() + ".png"), "image/png");
}
let BUSY = false;
async function exportVideo(kind) {
  if (S.anim === "static") { toast("Pick a Movement under Logo first"); return; }
  if (BUSY) return; BUSY = true;
  const [FW, FH] = SIZES[S.size], c = document.createElement("canvas");
  try {
    if (kind === "mp4") {
      if (!("VideoEncoder" in window)) { toast("Video needs Chrome, Edge or Safari 16.4+"); return; }
      const W = FW, H = FH, fps = 30, N = ANIM.D * fps;
      c.width = W; c.height = H;
      let codec = null;
      for (const cd of ["avc1.640033", "avc1.4d0033", "avc1.640028", "avc1.42002a"]) {
        try { const r = await VideoEncoder.isConfigSupported({ codec: cd, width: W, height: H, bitrate: 12e6, framerate: fps }); if (r.supported) { codec = cd; break; } } catch (e) {}
      }
      if (!codec) { toast("This browser can't make a video at this size"); return; }
      const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" });
      const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => console.error(e) });
      enc.configure({ codec, width: W, height: H, bitrate: 12e6, framerate: fps });
      for (let i = 0; i < N; i++) {
        frame(c, 1, i / fps);
        const fr = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(fr, { keyFrame: i % 60 === 0 }); fr.close();
        if (i % 10 === 0) { toast(`Making video… ${Math.round(i / N * 100)}%`, true); await new Promise(r => setTimeout(r, 0)); }
        while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 5));
      }
      await enc.flush(); muxer.finalize();
      save_(new Blob([muxer.target.buffer], { type: "video/mp4" }), `${stamp()}_${S.anim}.mp4`);
    } else {
      const s = 540 / FW, fps = 20, N = ANIM.D * fps;
      c.width = Math.round(FW * s); c.height = Math.round(FH * s);
      const gif = new GIF({ workers: 2, quality: 8, width: c.width, height: c.height, workerScript: "vendor/gif.worker.js" });
      for (let i = 0; i < N; i++) {
        frame(c, s, i / fps); gif.addFrame(c, { copy: true, delay: 1000 / fps });
        if (i % 10 === 0) { toast(`Preparing GIF… ${Math.round(i / N * 100)}%`, true); await new Promise(r => setTimeout(r, 0)); }
      }
      await new Promise(res => {
        gif.on("progress", p => toast(`Making GIF… ${Math.round(p * 100)}%`, true));
        gif.on("finished", b => { save_(b, `${stamp()}_${S.anim}.gif`); res(); });
        gif.render();
      });
    }
  } finally { BUSY = false; }
}
function toast(msg, sticky) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), sticky ? 6000 : 2200);
}

/* ---------- start ---------- */
(function init() {
  const bl = $("#bar-logo");
  drawLogo(bl.getContext("2d"), "combination", 0, 0, bl.width, C.cream);
  bl.style.width = "60px";
  swatches(); logoTiles(); bindPanel();
  let saved = null; try { saved = localStorage.getItem(STORE + "-photo"); } catch (e) {}
  if (saved) setPhoto(saved); else sync();
  document.fonts.ready.then(draw);
  Promise.all(["mono", "mono-light"].map(k => document.fonts.load(FONTS[k].css.replace("{px}", 40)))).then(draw);
})();
