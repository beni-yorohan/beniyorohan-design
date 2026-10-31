/* Lou's Fancy Foods — Asset Generator (the socials asset tool; editor and templates in one).
   A design = a photo (full frame, or the top half), any number of text boxes and the logo.
   "New design" starts from a template (starters.js).
   - Text boxes: drag anywhere; set sizes XS–XL; brand fonts.
   - Text is always centred in the frame and centre-aligned; boxes move up and down only.
   - Logo: sizes S / M / L, centred at the top, middle or bottom; videos and GIFs draw it on (anim.js).
   Brand rules kept: PP Monument Extended is always ALL CAPS and tracked +250; photos get the
   warm Lou's grade (switchable); anything sitting on a photo gets a soft shadow. */

const C = { cream: "#FFFFFF", esp: "#4E3524", brown: "#4E3524", olive: "#6D712E" };   // LFF guidelines v1.0: white / 2322 C / 5757 C (keys kept for compatibility)
const SIZES = { portrait: [1080, 1350], story: [1080, 1920] };
const FONTS = {
  mono: { css: '400 {px}px "PP Monument Extended"', caps: true, track: 0.25, lh: 1.08 },
  "mono-light": { css: '300 {px}px "PP Monument Extended"', caps: true, track: 0.25, lh: 1.08 },
};
const STEPS = ["XS", "S", "M", "L", "XL"];
const TEXT_PX = { XS: 2.6, S: 3.6, M: 5, L: 6.8, XL: 9 };          // % of the frame width
const LOGO_STEPS = ["S", "M", "L"];
const LOGO_W = { S: 0.2, M: 0.38, L: 0.64 };     // width for a 2.35:1 mark, scaled by shape (were XS / M / XL)
const LOGO_LIST = ["combination", "lous", "lff", "sans_stack", "script", "sans_h", "bonus"];   // compact marks in pairs, then the long lockups full width
const STORE = "lff-simple-v2";

const newText = (o = {}) => ({ text: "New text", font: "mono", size: "M", color: "cream", ...o, align: "center", x: 0.5 });   // always centred
const DEFAULTS = {
  size: "portrait", layout: "full", warm: true, soft: true, bg: "esp",
  texts: [newText({ text: "Fresh out of\nthe kitchen", y: 0.12 })], cur: 0,
  logoOn: true, logo: "combination", logoSize: "M", logoPos: "bottom", logoColor: "cream",
  px: 50, py: 50, pz: 1, logoScrim: false, guides: false,
  igName: "lousfancyfoods", igCaption: "",   // Instagram preview only
};
let S = load();
let photo = null;
let photoFx = null;   // { graded, soft } from LFFPhoto.process — the Lou's photo filter, made once per photo
let sel = null;            // index of the text box being dragged, or "logo"
let BOX = { texts: [] };   // last drawn bounds (canvas px)
let snapY = null;          // y (canvas px) of the centre line a dragged text box snapped to
const ANIM_MODE = "draw";  // the only logo movement: drawn on
const MARGIN = 0.074;      // left/right margin as a share of the width (same as the guides)
let RS = 1;                // render scale (shadow blur is in device px)
const T0 = performance.now();
const clock = () => (performance.now() - T0) / 1000;

const $ = q => document.querySelector(q);
const cv = $("#c"), ctx = cv.getContext("2d");
const T = () => S.texts[S.cur];          // the text box being edited (or undefined)
// colour rules on a plain background (on a photo any colour is fine):
//  - never the same colour as the background (text and logo)
//  - never olive on brown, never brown on olive (text and logo)
// onP = the element sits on the photo (worked out while drawing; see BOX)
const NAMES = { cream: "White", esp: "Brown", olive: "Olive" };
function blocked(name, forLogo, onP) {
  if (onP) return false;
  if (name === S.bg) return "Same colour as the background";
  if (name === "olive" && S.bg === "esp") return forLogo ? "Olive isn't used on brown" : "Olive text isn't used on brown";
  if (name === "esp" && S.bg === "olive") return forLogo ? "Brown isn't used on olive" : "Brown text isn't used on olive";
  return false;
}
const allowed = (name, forLogo, onP) => blocked(name, forLogo, onP) ? ["cream", "esp", "olive"].find(n => !blocked(n, forLogo, onP)) : name;
const onPhotoNow = i => i === "logo" ? !!(BOX.logo && BOX.logo.onPhoto) : !!(BOX.texts[i] && BOX.texts[i].onPhoto);
const textInk = (tb, onP) => allowed(tb.color, false, onP);
const logoInk = onP => allowed(S.logoColor, true, onP);
// store the allowed colours, so the panel shows what's actually used
function fixColours() {
  S.texts.forEach((t, i) => { t.color = textInk(t, onPhotoNow(i)); });
  S.logoColor = logoInk(onPhotoNow("logo"));
}

function load() {
  try {
    const s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || "{}"));
    if (!Array.isArray(s.texts)) s.texts = DEFAULTS.texts;
    s.cur = Math.min(s.cur || 0, s.texts.length - 1);
    s.texts.forEach(t => { if (!FONTS[t.font]) t.font = "mono"; t.align = "center"; t.x = 0.5; });   // GT America is not a brand font; text is always centred
    if (!SIZES[s.size]) s.size = "portrait";                                   // the square post was dropped
    if (s.layout !== "split") s.layout = "full";
    s.logoSize = { XS: "S", S: "S", M: "M", L: "L", XL: "L" }[s.logoSize] || "M";
    delete s.anim;
    return s;
  } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
}
// undo / redo: snapshots of the design (not the photo itself); quick runs of changes
// (typing, nudging) count as one step
const HIST = { undo: [], redo: [], last: null, at: 0 };
function save() {
  const now = JSON.stringify(S);
  if (HIST.last !== null && now !== HIST.last) {
    if (performance.now() - HIST.at > 600 || !HIST.undo.length) HIST.undo.push(HIST.last);
    if (HIST.undo.length > 80) HIST.undo.shift();
    HIST.redo = []; HIST.at = performance.now();
  }
  HIST.last = now;
  try { localStorage.setItem(STORE, now); } catch (e) {}
  syncUndo();
}
function stepHistory(back) {
  const from = back ? HIST.undo : HIST.redo, to = back ? HIST.redo : HIST.undo;
  if (!from.length) return;
  to.push(HIST.last); HIST.last = from.pop(); HIST.at = 0;
  S = JSON.parse(HIST.last);
  try { localStorage.setItem(STORE, HIST.last); } catch (e) {}
  syncUndo(); sync();
}
function syncUndo() {
  const u = document.getElementById("undo"), r = document.getElementById("redo");
  if (u) u.disabled = !HIST.undo.length;
  if (r) r.disabled = !HIST.redo.length;
}
let photoSrc = null;   // the photo as a data URL (kept when a template that uses a photo is picked)
function savePhoto(src) {
  photoSrc = src || null;
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
// where the photo goes: the whole frame, or the top half ("Photo on top" layout)
function photoRect(W, H) {
  return S.layout === "split" ? { x: 0, y: 0, w: W, h: Math.round(H * (S.size === "story" ? 0.56 : 0.52)) } : { x: 0, y: 0, w: W, h: H };
}
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const onPhotoBox = (b, W, H) => !!photo && !!b && overlaps(b, photoRect(W, H));
// cover-fit scale × zoom (1 = the photo just fills its area)
const photoScale = (R) => Math.max(R.w / photo.naturalWidth, R.h / photo.naturalHeight) * (S.pz || 1);
function drawPhoto(c, R) {
  const s = photoScale(R);
  const iw = photo.naturalWidth * s, ih = photo.naturalHeight * s;
  const ix = R.x + (R.w - iw) * S.px / 100, iy = R.y + (R.h - ih) * S.py / 100;
  // Lou's photo filter: white balance + 3000K warmth, levels, vibrance, and (optionally) the soft portrait background
  const src = S.warm && photoFx ? (S.soft !== false ? photoFx.soft : photoFx.graded) : photo;
  c.save(); c.beginPath(); c.rect(R.x, R.y, R.w, R.h); c.clip();
  c.drawImage(src, ix, iy, iw, ih);
  c.restore();
}
// "Photo on top" without a photo yet: a quiet empty area (and an "Add a photo" hint while editing)
function drawPhotoSlot(c, R, preview) {
  c.save();
  c.fillStyle = S.bg === "cream" ? "rgba(78,53,36,.08)" : "rgba(255,255,255,.12)"; c.fillRect(R.x, R.y, R.w, R.h);
  if (preview) {
    c.font = `400 ${R.w * 0.032}px "GT America"`; if ("letterSpacing" in c) c.letterSpacing = "0px";
    c.fillStyle = S.bg === "cream" ? "rgba(78,53,36,.55)" : "rgba(255,255,255,.7)"; c.textAlign = "center";
    c.fillText("+ Add a photo", R.x + R.w / 2, R.y + R.h / 2);
  }
  c.restore();
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
  const R = photoRect(W, H);
  if (photo) drawPhoto(c, R); else if (S.layout === "split") drawPhotoSlot(c, R, preview);
  BOX = { texts: [] };
  if (S.logoOn) {
    const b = logoBox(W, H), onP = onPhotoBox(b, W, H);
    if (onP && S.logoScrim) drawScrim(c, W, H);
    // draw-on accent: olive on white; white on brown and on olive (olive and brown never touch)
    const ink = logoInk(onP), col = C[ink], accent = (ink === "olive" || (!onP && S.bg !== "cream")) ? C.cream : C.olive;
    withShadow(c, onP, W, () => {
      if (t !== null) drawLogoAnimated(c, S.logo, b.x, b.y, b.w, col, accent, t, ANIM_MODE, Math.min(W, H) / 100);
      else drawLogo(c, S.logo, b.x, b.y, b.w, col);
    });
    BOX.logo = { ...b, onPhoto: onP };
  }
  S.texts.forEach((tb, i) => {
    if (!tb.text.trim()) { BOX.texts[i] = null; return; }
    const m = measureText(c, W, tb);
    const boxH = m.px * 0.78 + (m.lines.length - 1) * m.lh + m.px * 0.08, top = clampTextY(tb, H, boxH);
    const off = tb.align === "left" ? 0 : tb.align === "center" ? m.w / 2 : m.w;
    const x0 = Math.max(0, Math.min(tb.x * W - off, W - m.w)), ax = x0 + off;   // never off the side of the frame
    const onP = onPhotoBox({ x: x0, y: top, w: m.w, h: boxH }, W, H);
    withShadow(c, onP, W * 0.6, () => {
      c.fillStyle = C[textInk(tb, onP)]; c.textBaseline = "alphabetic"; c.textAlign = "left";
      m.lines.forEach((l, k) => {   // pen x so the line's ink edge / ink centre sits on the anchor
        const { l: il, r: ir } = m.ink[k];
        const lx = tb.align === "left" ? ax + il : tb.align === "center" ? ax - (ir - il) / 2 : ax - ir;
        c.fillText(l, lx, top + m.px * 0.78 + k * m.lh);
      });
    });
    BOX.texts[i] = { x: x0, y: top, w: m.w, h: boxH, onPhoto: onP };
  });
  if (preview && S.guides) drawGuides(c, W, H);
  if (preview) {
    if (snapY !== null) twoTone(c, W, W * 0.002, () => { c.moveTo(0, snapY); c.lineTo(W, snapY); });
    const outline = (b, solid) => { if (!b) return; const p = W * 0.012;
      twoTone(c, W, W * 0.003, () => c.rect(b.x - p, b.y - p, b.w + 2 * p, b.h + 2 * p), solid); };
    if (S.texts.length > 1 || hover === S.cur) outline(BOX.texts[S.cur], true);   // which box the panel is editing
    if (typeof hover === "number" && hover !== S.cur) outline(BOX.texts[hover], false);
    if (hover === "logo") outline(BOX.logo, false);
  }
}
// "Darken behind logo": a soft brown fade from the logo's edge of the frame (photos only)
function drawScrim(c, W, H) {
  const b = logoBox(W, H), col = a => `rgba(48,30,18,${a})`;
  c.save();
  if (S.logoPos === "middle") {
    const cx = W / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) * 0.95;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col(0.5)); g.addColorStop(0.55, col(0.28)); g.addColorStop(1, col(0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  } else {
    const top = S.logoPos === "top", edge = top ? 0 : H;
    const reach = top ? b.y + b.h * 1.9 : H - b.y + b.h * 0.9;
    const g = c.createLinearGradient(0, edge, 0, top ? reach : H - reach);
    g.addColorStop(0, col(0.6)); g.addColorStop(0.45, col(0.34)); g.addColorStop(1, col(0));
    c.fillStyle = g; c.fillRect(0, top ? 0 : H - reach, W, reach);
  }
  c.restore();
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
// the editor shows the finished logo; "Preview movement" plays the draw-on once
let PREVIEW_END = 0, PREVIEW_T0 = 0;
function animating() { return performance.now() < PREVIEW_END && TAB === "insta"; }
// Design view = the editable canvas; Instagram view = the same design inside a phone (never exported)
let VIEW = "design";
const igc = document.createElement("canvas");
function fitPhones() {
  const r = $("#wrap").getBoundingClientRect();
  const pw = Math.max(120, Math.min((r.height - 12) / 2.1667, r.width - 40, 420));
  document.querySelectorAll(".phone").forEach(p => p.style.setProperty("--pw", pw + "px"));
  return pw;
}
function drawIG(t) {
  const story = S.size === "story", [W, H] = SIZES[S.size];
  $("#ig-feed").classList.toggle("show", !story); $("#ig-story").classList.toggle("show", story);
  const host = story ? $("#story-media") : $("#feed-media");
  if (igc.parentElement !== host) host.appendChild(igc);
  const pw = fitPhones(), k = Math.min(2.5, pw * (devicePixelRatio || 1) / W);
  igc.width = Math.round(W * k); igc.height = Math.round(H * k);
  frame(igc, k, t);
  document.querySelectorAll(".ig-name").forEach(e => e.textContent = S.igName || "lousfancyfoods");
  document.querySelectorAll(".ig-caption").forEach(e => e.textContent = S.igCaption || "");
}
function setView(v) {
  VIEW = v;
  document.body.classList.toggle("view-ig", v === "ig");
  document.querySelectorAll("#views button").forEach(b => b.classList.toggle("on", b.dataset.view === v));
  $("#ig").hidden = v !== "ig";
  $("#ig-name").value = S.igName || ""; $("#ig-caption").value = S.igCaption || "";
  hover = null; draw();
}
function draw() {
  if (VIEW === "ig") { drawIG(animating() ? (performance.now() - PREVIEW_T0) / 1000 : null); return; }
  const [W, H] = SIZES[S.size];
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  RS = 1;
  render(ctx, W, H, true, animating() ? (performance.now() - PREVIEW_T0) / 1000 : null);
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
  const R = photoRect(cv.width, cv.height);
  if (inside(R, x, y, 0)) return photo ? "photo" : S.layout === "split" ? "addphoto" : null;
  return null;
}
cv.addEventListener("pointermove", e => {
  const [x, y] = toCanvas(e);
  if (touches.has(e.pointerId)) touches.set(e.pointerId, [x, y]);
  if (pinch) { if (touches.size === 2) setZoom(pinch.z * spread() / pinch.d); return; }
  if (!drag) {
    const p = pick(x, y), h = p === "photo" ? null : p;
    cv.style.cursor = p === "photo" ? "grab" : p === "logo" || p === "addphoto" || (p === null && !photo) ? "pointer" : p !== null ? "move" : "default";
    if (h !== hover && h !== "addphoto") { hover = h; draw(); }
    return;
  }
  const W = cv.width, H = cv.height, dx = x - drag.x, dy = y - drag.y;
  snapY = null;
  if (typeof drag.what === "number") {   // text stays centred: it only moves up and down
    const tb = S.texts[drag.what], b = BOX.texts[drag.what];
    let ty = drag.s.y + dy / H;
    if (b) {   // snap the box's middle to the middle of the frame
      const mid = ty + b.h / H / 2;
      if (Math.abs(mid - 0.5) < 0.015) { ty += 0.5 - mid; snapY = H / 2; }
    }
    tb.y = ty;
  } else if (drag.what === "photo") {
    const R = photoRect(W, H), s = photoScale(R);
    const ox = photo.naturalWidth * s - R.w, oy = photo.naturalHeight * s - R.h;
    if (ox > 1) S.px = Math.max(0, Math.min(100, drag.s.px - dx / ox * 100));
    if (oy > 1) S.py = Math.max(0, Math.min(100, drag.s.py - dy / oy * 100));
  }
  draw();
});
// two fingers on the photo = zoom (phones / tablets)
const touches = new Map();
let pinch = null;
const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
function setZoom(z) {
  S.pz = Math.round(Math.max(1, Math.min(3, z)) * 100) / 100;
  const zr = $("#zoom"); if (zr) zr.value = S.pz;
  draw();
}
cv.addEventListener("pointerdown", e => {
  if (e.pointerType === "touch") {
    touches.set(e.pointerId, toCanvas(e));
    if (touches.size === 2 && photo) { drag = null; snapY = null; pinch = { d: spread(), z: S.pz || 1 }; return; }
  }
  if (pinch) return;
  cv.focus({ preventScroll: true });
  const [x, y] = toCanvas(e), what = pick(x, y);
  if (what === null || what === "addphoto") { if (!photo) $("#file").click(); return; }
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
const endDrag = e => {
  touches.delete(e.pointerId);
  if (pinch) { if (touches.size < 2) { pinch = null; save(); } return; }
  if (!drag) return; drag = null; snapY = null; save(); draw();
};
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
// trackpad pinch (and ctrl + scroll) zooms the photo too
cv.addEventListener("wheel", e => {
  if (!photo || !e.ctrlKey) return;
  e.preventDefault(); setZoom((S.pz || 1) * Math.exp(-e.deltaY * 0.01)); clearTimeout(cv._z); cv._z = setTimeout(save, 300);
}, { passive: false });
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
      savePhoto(src); S.px = 50; S.py = 50; S.pz = 1; save();
      setPhoto(src);
    };
    img.src = r.result;
  };
  r.readAsDataURL(f);
}
function setPhoto(src, done) {
  if (!src) { photo = null; photoFx = null; sync(); return; }
  const img = new Image();
  img.onload = () => { photo = img; photoFx = window.LFFPhoto ? LFFPhoto.process(img) : null; sync(); if (done) done(); };
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
      b.innerHTML = `<i style="background:${C[name]}"></i><span>${NAMES[name]}</span>`;   // colour dot + name
      b.title = NAMES[name]; b.dataset.v = name;
      b.onclick = () => {
        if (key === "textColor") { if (T()) T().color = name; } else S[key] = name;
        fixColours(); save(); sync();
      };
      box.appendChild(b);
    }
  });
}
function steps(boxSel, onPick, list = STEPS) {
  const box = $(boxSel);
  box.innerHTML = list.map(s => `<button data-v="${s}">${s}</button>`).join("");
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
  onClass("#text-sizes button", "v", tb.size);
  $('[data-for="textColor"]').querySelectorAll("button").forEach(b => {
    const why = blocked(b.dataset.v, false, onPhotoNow(S.cur));
    b.disabled = !!why; b.title = why || NAMES[b.dataset.v];
    b.classList.toggle("on", b.dataset.v === textInk(tb, onPhotoNow(S.cur)));
  });
}
function sync() {
  onClass("#sizes button", "size", S.size);
  onClass("#logos button", "v", S.logo);
  onClass("#logo-sizes button", "v", S.logoSize);
  onClass("#logo-pos button", "pos", S.logoPos);
  $("#guides").checked = S.guides;
  document.querySelectorAll(".swatches:not([data-for=textColor])").forEach(box => box.querySelectorAll("button").forEach(b => {
    const why = box.dataset.for === "logoColor" ? blocked(b.dataset.v, true, onPhotoNow("logo")) : false;
    b.disabled = !!why; b.title = why || NAMES[b.dataset.v];
    b.classList.toggle("on", b.dataset.v === (box.dataset.for === "logoColor" ? logoInk(onPhotoNow("logo")) : S[box.dataset.for]));
  }));
  $("#warm").checked = S.warm;
  $("#soft").checked = S.soft !== false; $("#soft").disabled = !S.warm;
  $("#logo-on").checked = S.logoOn;
  $("#scrim").checked = !!S.logoScrim;
  $("#scrim").parentElement.classList.toggle("hidden", !photo);
  $("#zoom").value = S.pz || 1;
  $("#zoom-row").classList.toggle("hidden", !photo);
  $(".when-logo").classList.toggle("hidden", !S.logoOn);
  $(".when-nophoto").classList.toggle("hidden", !!photo && S.layout !== "split");
  onClass("#layout button", "layout", S.layout);
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
  steps("#text-sizes", v => { if (T()) T().size = v; save(); sync(); });
  steps("#logo-sizes", v => { S.logoSize = v; save(); sync(); }, LOGO_STEPS);
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
  $("#scrim").onchange = e => { S.logoScrim = e.target.checked; save(); sync(); };
  $("#zoom").oninput = e => setZoom(+e.target.value);
  $("#zoom").onchange = () => save();
  $("#undo").onclick = () => stepHistory(true);
  $("#redo").onclick = () => stepHistory(false);
  document.addEventListener("keydown", e => {
    const typing = /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
      e.preventDefault(); stepHistory(!e.shiftKey); return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); stepHistory(false); return; }
    // with the design selected: arrows nudge the current text box, Delete removes it
    if (document.activeElement !== cv || !T()) return;
    const step = e.shiftKey ? 0.025 : 0.005, mv = { ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (mv) {   // text only moves up and down (it's always centred)
      e.preventDefault();
      const tb = T(), b = BOX.texts[S.cur];
      if (b) tb.y = b.y / cv.height;   // start from where it's drawn (it may have been kept inside the frame)
      tb.y = Math.max(0, Math.min(0.98, tb.y + mv * step));
      save(); draw(); return;
    }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); $("#del-text").click(); }
  });
  $("#text").oninput = e => { if (T()) T().text = e.target.value; save(); draw();
    const chip = $(`#text-list [data-i="${S.cur}"]`); if (chip) chip.textContent = (e.target.value.split("\n")[0] || "Empty").slice(0, 18); };
  document.querySelectorAll("#layout button").forEach(b => b.onclick = () => { S.layout = b.dataset.layout; S.px = 50; S.py = 50; save(); sync(); });
  document.querySelectorAll("#views button").forEach(b => b.onclick = () => setView(b.dataset.view));
  $("#ig-name").oninput = e => { S.igName = e.target.value; save(); draw(); };
  $("#ig-caption").oninput = e => { S.igCaption = e.target.value; save(); draw(); };
  new ResizeObserver(() => { if (VIEW === "ig") draw(); }).observe($("#wrap"));
  $("#play").onclick = () => { PREVIEW_T0 = performance.now(); PREVIEW_END = PREVIEW_T0 + ANIM.D * 1000; play(); };
  $("#guides").onchange = e => { S.guides = e.target.checked; save(); sync(); };
  const menu = $("#dl-menu");
  $("#download").onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener("click", e => { if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") menu.hidden = true; });
  menu.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => {
    menu.hidden = true;
    if (b.dataset.dl === "png") download(); else if (b.dataset.dl === "both") downloadBoth(); else exportVideo(b.dataset.dl);
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
  return new Promise(res => c.toBlob(b => { save_(b, stamp() + ".png"); res(); }, "image/png"));
}
// the same design as a Post and as a Story (text and logo positions are relative, so they carry over)
async function downloadBoth() {
  const keep = S.size;
  for (const sz of Object.keys(SIZES)) { S.size = sz; await download(); await new Promise(r => setTimeout(r, 350)); }
  S.size = keep; draw(); toast("Saved the Post and the Story");
}
let BUSY = false;
async function exportVideo(kind) {
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
      save_(new Blob([muxer.target.buffer], { type: "video/mp4" }), `${stamp()}_logo.mp4`);
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
        gif.on("finished", b => { save_(b, `${stamp()}_logo.gif`); res(); });
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
  HIST.last = JSON.stringify(S);
  swatches(); logoTiles(); bindPanel(); syncUndo();
  { const L = LOGOS.lff;   // Instagram avatar = the LFF monogram
    document.querySelectorAll(".avatar").forEach(el => el.innerHTML = `<svg viewBox="0 0 ${L.w} ${L.h}">${L.paths.map(d => `<path d="${d}"/>`).join("")}</svg>`); }
  setView("design");
  let saved = null; try { saved = localStorage.getItem(STORE + "-photo"); } catch (e) {}
  if (saved) { photoSrc = saved; setPhoto(saved); } else sync();
  document.fonts.ready.then(draw);
  Promise.all(["mono", "mono-light"].map(k => document.fonts.load(FONTS[k].css.replace("{px}", 40)))).then(draw);
})();
