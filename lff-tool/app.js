/* Lou's Fancy Foods — Asset Generator (Instagram tab)
   Everything is drawn on one <canvas> at the real export size, so the preview
   is the export. Logos are the master vectors in logos.js (Path2D). */

const C = { cream: "#FFFFFF", esp: "#4E3524", brown: "#4E3524", olive: "#6D712E" };   // LFF guidelines v1.0: white / 2322 C / 5757 C (keys kept for compatibility)

const FORMATS = {
  story:     { w: 1080, h: 1920, label: "Story / Reel", sub: "9:16 · full screen" },
  portrait:  { w: 1080, h: 1350, label: "Post",         sub: "4:5 · for the feed" },
};

const COLOURWAYS = {
  cream: { bg: C.cream, ink: C.esp,   accent: C.olive, eyebrow: C.olive, label: "White" },
  esp:   { bg: C.esp,   ink: C.cream, accent: C.cream, eyebrow: C.cream, label: "Brown" },   // never olive on brown (text, logo, construction fill)
  olive: { bg: C.olive, ink: C.cream, accent: C.cream, eyebrow: C.cream, label: "Olive" },   // never brown on olive
};

const LOGO_OPTIONS = [   // logo pack — Option 2 (final round of the Mid-Point deck)
  ["Option 2 · Script", [
    ["combination", "Combination mark — Lou's + Fancy Foods"],
    ["script", "Script wordmark — Lou's Fancy Foods"],
    ["lous", "Isolated — Lou's"]]],
  ["Option 2 · Sans wordmark", [
    ["sans_h", "Horizontal"],
    ["sans_stack", "Stacked"]]],
  ["Option 2 · Bonus", [
    ["bonus", "Bonus variation — LOU'S fancy FOODS"]]],
  ["Option 2 · Monogram", [
    ["lff", "LFF monogram"]]],
];

// four templates, all centred: Logo (on a colour, or on your photo), Announcement (one headline),
// Product (photo half, name half) and Monogram + tagline
const TEMPLATES = {
  logo:     { title: "Logo",          sub: "The mark on a colour, or on your photo" },
  announce: { title: "Announcement",  sub: "One big headline and the logo" },
  split:    { title: "Product",       sub: "Photo half, name half" },
  seal:     { title: "Monogram + tagline", sub: "LFF centred, line beneath" },
};
const OLD_TEMPLATE = { photo: "logo", product: "split" };   // merged templates (saved designs)

const DEFAULTS = {
  format: "portrait", template: "announce", colour: "cream", logo: "combination", logoSize: "M",
  headline: "Chicken and rice,\nmade this morning.",
  guides: false, safe: true, zoom: 1, px: 50, py: 50, logoPos: "auto", warm: 1, soft: true,
  anim: "draw",   // the only logo movement
  igName: "lousfancyfoods", igCaption: "Chicken and rice, made this morning. Available until we run out.",
};

const STARTERS = [
  { title: "Announcement", sub: "One big headline and the logo",
    set: { template: "announce", format: "portrait", colour: "esp", logo: "combination", headline: "Chicken and rice,\nmade this morning." } },
  { title: "New product", sub: "Your photo, the name underneath",
    set: { template: "split", format: "portrait", colour: "cream", logo: "combination", headline: "Chicken and rice" } },
  { title: "Story", sub: "Photo on top, words underneath",
    set: { template: "split", format: "story", colour: "olive", logo: "lous", headline: "Fresh out of the kitchen." } },
  { title: "Logo", sub: "On a colour or on your photo · draws itself on in video",
    set: { template: "logo", format: "portrait", colour: "esp", logo: "combination" } },
  { title: "Brand line", sub: "The LFF monogram and a short line",
    set: { template: "seal", format: "portrait", colour: "cream", logo: "lff", headline: "Every day is all there is" } },
];

const STORE = "lff-asset-tool-v1";
const FIRST_VISIT = (() => { try { return !localStorage.getItem("lff-asset-tool-v1"); } catch (e) { return true; } })();
let state = load();
if (!LOGOS[state.logo]) state.logo = "combination";
let photo = null;          // HTMLImageElement
let photoFx = null;        // { graded, soft } from LFFPhoto.process — the Lou's photo filter, made once per photo
let exportScale = 1;
let VIEW = "design";   // design | ig

function load() {
  let s; try { s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || "{}")); }
  catch (e) { s = Object.assign({}, DEFAULTS); }
  s.template = OLD_TEMPLATE[s.template] || (TEMPLATES[s.template] ? s.template : "announce");
  if (!FORMATS[s.format]) s.format = "portrait";                       // square / wide posts were dropped
  s.logoSize = { XS: "S", S: "S", M: "M", L: "L", XL: "L" }[s.logoSize] || "M";
  if (s.logoPos !== "auto") s.logoPos = (s.logoPos || "m")[0] + "c";   // the logo is always centred
  s.anim = "draw";
  return s;
}
function save() {
  try {
    const s = Object.assign({}, state); localStorage.setItem(STORE, JSON.stringify(s));
    if (photo && photo.src.startsWith("data:") && photo.src.length < 4.5e6) localStorage.setItem(STORE + "-photo", photo.src);
  } catch (e) { /* storage full or blocked — tool still works */ }
}

/* ---------------- drawing helpers ---------------- */
const PATHS = {};
function logoPaths(key) {
  if (!PATHS[key]) PATHS[key] = LOGOS[key].paths.map(d => new Path2D(d));
  return PATHS[key];
}
// draw logo with its box (x, y = top-left), width w
function drawLogo(ctx, key, x, y, w, color) {
  const L = LOGOS[key], s = w / L.w;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = color;
  for (const p of logoPaths(key)) ctx.fill(p);
  ctx.restore();
  return { x, y, w, h: L.h * s };
}
// fit a logo inside maxW × maxH, return its width
function fitLogoW(key, maxW, maxH) {
  const L = LOGOS[key], wide = L.w / L.h > 5 ? 1.55 : 1;   // long lockups need more width to read
  return Math.min(maxW * wide, maxH * L.w / L.h, 1080 * 0.86);
}
const TIER = { S: 0.55, M: 1, L: 1.5 };   // logo sizes S / M / L

const FONT_FAMILY = '"PP Monument Extended"';     // brand secondary typeface
function font(px, weight = 400) { return `${weight} ${px}px ${FONT_FAMILY}`; }
// Brand rule: PP Monument Extended is always tracked +250 (0.25 em), whatever a template asks for.
const MONO_TRACK = 0.25;
function setText(ctx, px, track, color) {
  track = MONO_TRACK;
  ctx.font = font(px); ctx.fillStyle = color;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${track * px}px`;
}
// Brand rule: PP Monument Extended is always set in ALL CAPS.
const CAPS = s => String(s).toUpperCase();
function textW(ctx, s, px, track) {
  track = MONO_TRACK;
  s = CAPS(s);
  ctx.font = font(px);
  if ("letterSpacing" in ctx) { ctx.letterSpacing = `${track * px}px`; return ctx.measureText(s).width - track * px; }
  return ctx.measureText(s).width + track * px * Math.max(0, s.length - 1);
}
function drawLine(ctx, s, x, y, px, track, color, align = "left") {
  track = MONO_TRACK;
  s = CAPS(s);
  setText(ctx, px, track, color);
  const w = textW(ctx, s, px, track);
  const xx = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.fillText(s, xx, y);
  else { let cx = xx; for (const ch of s) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + track * px; } }
  return w;
}
function wrap(ctx, text, px, track, maxW) {
  const out = [];
  for (const para of String(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean); let line = "";
    if (!words.length) { out.push(""); continue; }
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (textW(ctx, t, px, track) <= maxW || !line) line = t; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
// paragraph block; returns bottom y. y = top of block
function drawBlock(ctx, text, x, y, maxW, px, lead, track, color, align = "left", upper = false) {
  const t = upper ? String(text).toUpperCase() : text;
  const lines = wrap(ctx, t, px, track, maxW);
  let yy = y + px * 0.78;
  for (const l of lines) { drawLine(ctx, l, align === "center" ? x + maxW / 2 : align === "right" ? x + maxW : x, yy, px, track, color, align); yy += px * lead; }
  return y + lines.length * px * lead;
}
function blockH(ctx, text, maxW, px, lead, track, upper = false) {
  return wrap(ctx, upper ? String(text).toUpperCase() : text, px, track, maxW).length * px * lead;
}
// shrink px until block fits maxH (and longest word fits maxW)
function fitPx(ctx, text, maxW, maxH, px, lead, track, minPx, upper = false) {
  while (px > minPx) {
    const t = upper ? String(text).toUpperCase() : text;
    const longest = Math.max(...t.split(/\s+/).map(w => textW(ctx, w, px, track)));
    if (blockH(ctx, text, maxW, px, lead, track, upper) <= maxH && longest <= maxW) break;
    px *= 0.95;
  }
  return px;
}

function drawPhoto(ctx, x, y, w, h, cw, clipPath) {
  hit("photo", x, y, w, h);
  ctx.save();
  if (clipPath) ctx.clip(clipPath); else { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
  if (photo) {
    const s = Math.max(w / photo.naturalWidth, h / photo.naturalHeight) * state.zoom;
    const iw = photo.naturalWidth * s, ih = photo.naturalHeight * s;
    const ix = x + (w - iw) * (state.px / 100), iy = y + (h - ih) * (state.py / 100);
    // Lou's photo filter (white balance + 3000K warmth, levels, vibrance, optional portrait background);
    // the slider blends it over the original
    const k = state.warm;
    ctx.drawImage(photo, ix, iy, iw, ih);
    if (k > 0 && photoFx) {
      ctx.globalAlpha = Math.min(1, k);
      ctx.drawImage(state.soft !== false ? photoFx.soft : photoFx.graded, ix, iy, iw, ih);
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = cw.ink; ctx.globalAlpha = 0.12; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;   // empty photo frame, no label
  }
  ctx.restore();
}
function framePath(x, y, w, h) {
  const p = new Path2D(); p.rect(x, y, w, h);
  return p;
}
function hr(ctx, x, y, w, color, alpha = 1, t = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, t); ctx.restore();
}

let EXPORTING = false;
// clickable regions on the design (collected while drawing the preview)
let HITS = [], LAST_HITS = [], THUMBING = false;
const hit = (field, x, y, w, h) => HITS.push({ field, x, y, w, h });
let RS = 1;          // current render scale (shadows are in device px, so they need it)

// logo position: "auto" uses the template default; otherwise tc / mc / bc (always centred)
function place(def, w, h, R) {
  const p = state.logoPos === "auto" ? def : state.logoPos, v = p[0], hz = "c";
  const x = hz === "l" ? R.x0 : hz === "r" ? R.x1 - w : (R.x0 + R.x1 - w) / 2;
  const y = v === "t" ? R.y0 : v === "b" ? R.y1 - h : (R.y0 + R.y1 - h) / 2;
  return { x, y, v, h: hz };
}
function withPhotoShadow(ctx, M, fn) {
  ctx.save();
  ctx.shadowColor = "rgba(34, 14, 2, 0.42)";
  ctx.shadowBlur = 1.8 * M.u * RS; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0.35 * M.u * RS;
  fn(); ctx.restore();
}
// white + soft shadow whenever the mark sits on a photo
let CAPTURE = null;   // when set, logos are recorded instead of drawn (animated export/preview)
function drawMark(ctx, M, key, x, y, w, color, onPhoto) {
  hit("logo", x, y, w, w * LOGOS[key].h / LOGOS[key].w);
  if (CAPTURE) { CAPTURE.push({ key, x, y, w, color: onPhoto ? C.cream : color, onPhoto, M, accent: COLOURWAYS[state.colour].accent });
                 return { x, y, w, h: w * LOGOS[key].h / LOGOS[key].w }; }
  if (!onPhoto) return drawLogo(ctx, key, x, y, w, color);
  let r; withPhotoShadow(ctx, M, () => { r = drawLogo(ctx, key, x, y, w, C.cream); }); return r;
}
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const GUIDES = [];   // collected per render: {x?|y?}

/* ---------------- templates ---------------- */
function frameMetrics(W, H) {
  const u = Math.min(W, H) / 100;
  const story = H / W > 1.6;
  const m = 6.5 * u;
  return { u, m, story,
    top: story ? H * 0.11 : m,         // keep clear of IG story header
    bot: story ? H * 0.13 : m,         // and reply bar
  };
}
// one headline, centred both ways inside [y, yEnd]
function headlineBlock(ctx, M, cw, x, y, maxW, yEnd, headPx, color) {
  if (!state.headline || !state.headline.trim()) return;
  const hpx = fitPx(ctx, state.headline, maxW, Math.max(30, yEnd - y), headPx, 1.04, 0, 3 * M.u);
  const h = blockH(ctx, state.headline, maxW, hpx, 1.04, 0);
  const hy = y + Math.max(0, (yEnd - y - h) / 2);
  drawBlock(ctx, state.headline, x, hy, maxW, hpx, 1.04, 0, color || cw.ink, "center");
  hit("headline", x, hy, maxW, h); GUIDES.push({ y: hy }, { y: hy + h });
}

const RENDER = {
  // the mark on its own; with a photo it sits on the photo in white
  logo(ctx, W, H, M, cw) {
    const key = state.logo;
    if (photo) drawPhoto(ctx, 0, 0, W, H, cw); else hit("photo", 0, 0, W, H);
    const base = Math.min(W * (photo ? 0.52 : 0.62), H * (photo ? 0.42 : 0.5)) * TIER[state.logoSize];
    const lw = fitLogoW(key, base, base * (photo ? 0.55 : 0.62)), lh = lw * LOGOS[key].h / LOGOS[key].w;
    const P = place(photo ? "bc" : "mc", lw, lh, { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot });
    drawMark(ctx, M, key, P.x, P.y, lw, photo ? C.cream : cw.ink, !!photo);
    GUIDES.push({ y: P.y }, { y: P.y + lh }, { x: P.x }, { x: P.x + lw });
  },

  // one big centred headline + the logo
  announce(ctx, W, H, M, cw) {
    const ink = cw.ink, key = state.logo;
    const lw = fitLogoW(key, W * 0.42 * TIER[state.logoSize], H * 0.14 * TIER[state.logoSize]);
    const lh = lw * LOGOS[key].h / LOGOS[key].w;
    const R = { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot };
    const P = place("bc", lw, lh, R);
    drawMark(ctx, M, key, P.x, P.y, lw, ink, false);
    GUIDES.push({ y: P.y }, { y: P.y + lh });
    // the headline takes the room on the far side of the logo
    let y = M.top, yEnd = P.y - 6 * M.u;
    if (P.v === "t") { y = P.y + lh + 6 * M.u; yEnd = R.y1; }
    headlineBlock(ctx, M, cw, M.m, y, W - 2 * M.m, yEnd, 11 * M.u);
  },

  // photo half, colour half with the name and the logo (centred)
  split(ctx, W, H, M, cw) {
    const ink = cw.ink, ph = H * (M.story ? 0.56 : 0.52);
    const photoR = { x: 0, y: 0, w: W, h: ph };
    drawPhoto(ctx, 0, 0, W, ph, cw);
    const key = state.logo, tx = M.m, ty = ph + 5 * M.u, tw = W - 2 * M.m;
    const lw = fitLogoW(key, tw * 0.5 * TIER[state.logoSize], H * 0.09 * TIER[state.logoSize]);
    const lh = lw * LOGOS[key].h / LOGOS[key].w;
    // auto = bottom of the colour panel; top / middle / bottom use the whole frame (over the photo it turns white)
    const panelR = { x0: tx, y0: ty, x1: W - M.m, y1: H - M.bot };
    const R = state.logoPos === "auto" ? panelR : { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot };
    const P = place("bc", lw, lh, R);
    const box = { x: P.x, y: P.y, w: lw, h: lh };
    drawMark(ctx, M, key, P.x, P.y, lw, ink, overlaps(box, photoR));
    let y = ty, yEnd = panelR.y1;
    if (overlaps(box, { x: 0, y: ty, w: W, h: H - ty })) { if (P.y > ty + (panelR.y1 - ty) * 0.35) yEnd = P.y - 4 * M.u; else y = Math.max(ty, P.y + lh + 4 * M.u); }
    headlineBlock(ctx, M, cw, tx, y, tw, yEnd, 8 * M.u);
  },

  seal(ctx, W, H, M, cw) {
    const ink = cw.ink;
    const key = "lff";                                   // this template is always the monogram
    const L = LOGOS[key], avH = H - M.top - M.bot;
    const tpx = Math.max(14, 3.1 * M.u);
    const textH = state.headline ? blockH(ctx, state.headline, W * 0.7, tpx, 1.3, 0.06, true) + 6 * M.u : 0;
    const lw = Math.min(W * (M.story ? 0.5 : 0.36) * TIER[state.logoSize], (avH - textH) * L.w / L.h * 0.8);
    const lh = lw * L.h / L.w;
    const tw = Math.max(lw, Math.min(W * 0.7, W - 2 * M.m));
    const P = place("mc", tw, lh + textH, { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot });
    const sx = P.x + (tw - lw) / 2;
    drawMark(ctx, M, key, sx, P.y, lw, ink, false);
    GUIDES.push({ y: P.y }, { y: P.y + lh }, { x: sx }, { x: sx + lw });
    if (state.headline) { const hy = P.y + lh + 6 * M.u, he = drawBlock(ctx, state.headline, P.x, hy, tw, tpx, 1.3, 0.06, ink, "center", true); hit("headline", P.x, hy, tw, he - hy); }
  },
};

// t = seconds into the logo loop; null = still (fully drawn)
const LAYER = { key: null, canvas: null, calls: [] };
function render(target, scale = 1, t = null) {
  if (t == null || state.anim === "static") return renderStatic(target, scale);
  const lk = JSON.stringify(state) + "|" + scale + "|" + (photo ? photo.src.length : 0) + "|" + VIEW + "|" + EXPORTING;
  if (LAYER.key !== lk) {                       // everything except the logo, rendered once
    LAYER.canvas = document.createElement("canvas"); CAPTURE = [];
    renderStatic(LAYER.canvas, scale); LAYER.calls = CAPTURE; CAPTURE = null; LAYER.key = lk;
  }
  target.width = LAYER.canvas.width; target.height = LAYER.canvas.height;
  const ctx = target.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(LAYER.canvas, 0, 0);
  ctx.setTransform(scale, 0, 0, scale, 0, 0); RS = scale;
  for (const c of LAYER.calls) {
    const draw = () => drawLogoAnimated(ctx, c.key, c.x, c.y, c.w, c.color, c.accent, t, state.anim, c.M.u);
    if (c.onPhoto) withPhotoShadow(ctx, c.M, draw); else draw();
  }
}
function renderStatic(target, scale = 1) {
  const f = FORMATS[state.format], W = f.w, H = f.h, cw = COLOURWAYS[state.colour];
  target.width = Math.round(W * scale); target.height = Math.round(H * scale);
  const ctx = target.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0); RS = scale;
  ctx.fillStyle = cw.bg; ctx.fillRect(0, 0, W, H);
  const M = frameMetrics(W, H);
  GUIDES.length = 0; HITS = [];
  RENDER[state.template](ctx, W, H, M, cw);
  if (!EXPORTING && !THUMBING && scale === 1) LAST_HITS = HITS.slice();
  if (state.guides) drawGuides(ctx, W, H, M, cw);
  if (state.safe && !EXPORTING && VIEW !== "ig") drawSafe(ctx, W, H, M);
}

function drawGuides(ctx, W, H, M, cw) {
  const ink = state.template === "logo" && photo ? C.cream : cw.ink;
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = ink;
  const t = Math.max(1, M.u * 0.1);
  const xs = [M.m, W - M.m, W / 2], ys = [M.top, H - M.bot];
  for (const g of GUIDES) { if (g.x != null) xs.push(g.x); if (g.y != null) ys.push(g.y); }
  for (const x of xs) ctx.fillRect(x, 0, t, H);
  for (const y of ys) ctx.fillRect(0, y, W, t);
  ctx.globalAlpha = 0.85;
  for (const x of [M.m, W - M.m]) for (const y of [M.top, H - M.bot]) { ctx.beginPath(); ctx.arc(x, y, M.u * 0.55, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function drawSafe(ctx, W, H, M) {
  if (!M.story) return;
  ctx.save(); ctx.fillStyle = "rgba(255,0,80,0.08)";
  ctx.fillRect(0, 0, W, 250); ctx.fillRect(0, H - 340, W, 340);
  ctx.restore();
}

/* ---------------- UI ---------------- */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const canvas = $("#canvas");

function fit() {
  const f = FORMATS[state.format], fr = $("#frame").getBoundingClientRect();
  if (VIEW === "ig") return fitIG(f, fr);
  const pad = innerWidth <= 760 ? 16 : 56;   // phones: use the whole width
  const s = Math.min((fr.width - pad) / f.w, (fr.height - pad) / f.h);
  canvas.style.width = f.w * s + "px"; canvas.style.height = f.h * s + "px";
  $("#dims").textContent = `${f.label} · ${f.w} × ${f.h} px · ${TEMPLATES[state.template].title} · ${COLOURWAYS[state.colour].label}`;
}
function fitIG(f, fr) {
  const story = state.format === "story";
  const pw = Math.min((fr.height - 40) / 2.1667, fr.width - 60, 420);
  $$(".phone").forEach(p => { p.style.setProperty("--pw", pw + "px"); p.classList.remove("show"); });
  const phone = story ? $("#ig-story") : $("#ig-feed");
  phone.classList.add("show");
  const host = story ? $("#story-media") : $("#feed-media");
  if (canvas.parentElement !== host) host.appendChild(canvas);
  canvas.style.width = "100%"; canvas.style.height = "auto";
  $$(".ig-name").forEach(e => e.textContent = state.igName || "lousfancyfoods");
  $$(".ig-caption").forEach(e => e.textContent = state.igCaption || "");
  $("#dims").textContent = `Instagram preview · ${f.label} · ${f.w} × ${f.h} px`;
}
function setView(v) {
  VIEW = v;
  $$(".vt").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  $("#ig").hidden = v !== "ig";
  if (v === "design" && canvas.parentElement !== $("#frame")) $("#frame").prepend(canvas);
  canvas.style.display = "";
  update();
}

// the design shows the finished logo; "Preview" plays the draw-on once (videos and GIFs always draw it on)
let T0 = performance.now(), PLAYING = false, PREVIEW_END = 0;
const previewing = () => performance.now() < PREVIEW_END;
function loopTime() { return ((performance.now() - T0) / 1000) % ANIM.D; }
function tick() {
  if (!previewing()) { PLAYING = false; render(canvas, 1); return; }
  render(canvas, 1, loopTime()); requestAnimationFrame(tick);
}
function playPreview() { T0 = performance.now(); PREVIEW_END = T0 + ANIM.D * 1000; if (!PLAYING) { PLAYING = true; requestAnimationFrame(tick); } }
function update() {
  if (!previewing()) render(canvas, 1);
  else render(canvas, 1, loopTime());
  fit(); syncUI(); save(); layoutHits();
}

function syncUI() {
  $$("[data-field]").forEach(el => {
    const k = el.dataset.field;
    if (el.type === "checkbox") el.checked = !!state[k];
    else if (document.activeElement !== el) el.value = state[k] ?? "";
  });
  $$("[data-val]").forEach(el => { const v = state[el.dataset.val]; el.textContent = el.dataset.val === "zoom" ? (+v).toFixed(2) + "×" : el.dataset.val === "warm" ? Math.round(v * 100) + "%" : Math.round(v) + "%"; });
  $$("#format-seg [data-format]").forEach(b => b.classList.toggle("active", b.dataset.format === state.format));
  $$("#template-tiles [data-template]").forEach(b => b.classList.toggle("active", b.dataset.template === state.template));
  syncSummaries(); scheduleThumbs();
  $$("#colour-tiles .swatch").forEach(b => b.classList.toggle("active", b.dataset.colour === state.colour));
  $$("#logo-size-seg .seg-btn").forEach(b => b.classList.toggle("active", b.dataset.size === state.logoSize));
  $$("[data-pos]").forEach(b => b.classList.toggle("active", b.dataset.pos === state.logoPos));

  $$("#logo-tiles .logo-tile").forEach(b => b.classList.toggle("active", b.dataset.logo === state.logo));
  const posNotes = { split: "Auto keeps it in the colour panel. Top / middle / bottom use the whole frame — over the photo it turns white.",
    logo: "With a photo the logo turns white and sits at the bottom.", seal: "This template always uses the LFF monogram. Position moves it and its line together." };
  $("#pos-hint").textContent = posNotes[state.template] || "Auto uses the template's usual spot.";
  // show only the controls a template uses
  $$(".ig-only").forEach(el => el.classList.toggle("hidden", VIEW !== "ig"));
  $$("[data-show]").forEach(el => el.classList.toggle("hidden", !el.dataset.show.split(",").includes(state.template)));
}

function build() {
  // brand mark in the top bar
  const L = LOGOS.combination, bm = $("#brand-mark");
  bm.setAttribute("viewBox", `0 0 ${L.w} ${L.h}`);
  bm.innerHTML = L.paths.map(d => `<path d="${d}"/>`).join("");

  $("#format-seg").innerHTML = Object.entries(FORMATS).map(([k, f]) =>
    `<button class="size-card" data-format="${k}" title="${f.w} × ${f.h} px"><span class="shape" style="aspect-ratio:${f.w}/${f.h}"></span><span><b>${f.label}</b><small>${f.sub}</small></span></button>`).join("");
  $("#template-tiles").innerHTML = Object.entries(TEMPLATES).map(([k, t]) =>
    `<button class="tpl" data-template="${k}" title="${t.sub}"><span class="thumb"><img alt=""></span><b>${t.title}</b></button>`).join("");
  $("#colour-tiles").innerHTML = Object.entries(COLOURWAYS).map(([k, c]) =>
    `<button class="swatch" data-colour="${k}" style="background:${c.bg};color:${c.ink}">${c.label}</button>`).join("");
  // Instagram avatar = LFF monogram
  { const L = LOGOS.lff; $$(".avatar").forEach(el => el.innerHTML = `<svg viewBox="0 0 ${L.w} ${L.h}">${L.paths.map(d => `<path d="${d}"/>`).join("")}</svg>`); }
  // logo picker: real thumbnails, grouped like the Option 2 pack
  {  // compact marks in pairs first, then the long lockups full-width — no gaps
    const all = LOGO_OPTIONS.flatMap(([, o]) => o), wide = k => LOGOS[k].w / LOGOS[k].h > 5;
    const order = all.filter(([k]) => !wide(k)).concat(all.filter(([k]) => wide(k)));
    $("#logo-tiles").innerHTML = order.map(([k, l]) => {
      const L = LOGOS[k], pad = L.w * 0.06;
      return `<button class="logo-tile${wide(k) ? " wide" : ""}" data-logo="${k}" title="${l}"><svg viewBox="${-pad} ${-pad} ${L.w + pad * 2} ${L.h + pad * 2}" preserveAspectRatio="xMidYMid meet">${L.paths.map(d => `<path d="${d}"/>`).join("")}</svg></button>`;
    }).join("");
  }
  $("#logo-tiles").addEventListener("click", e => { const b = e.target.closest("[data-logo]"); if (b) { state.logo = b.dataset.logo; update(); } });

  $("#format-seg").addEventListener("click", e => { const b = e.target.closest("[data-format]"); if (b) { state.format = b.dataset.format; update(); } });
  $("#template-tiles").addEventListener("click", e => { const b = e.target.closest("[data-template]"); if (b) { state.template = b.dataset.template; update(); } });
  $("#colour-tiles").addEventListener("click", e => { const b = e.target.closest("[data-colour]"); if (b) { state.colour = b.dataset.colour; update(); } });
  $$("[data-pos]").forEach(b => b.addEventListener("click", () => { state.logoPos = b.dataset.pos; update(); }));
  $("#play").addEventListener("click", playPreview);
  $("#export-mp4").addEventListener("click", () => exportVideo("mp4"));
  $("#export-gif").addEventListener("click", () => exportVideo("gif"));
  $("#logo-size-seg").addEventListener("click", e => { const b = e.target.closest("[data-size]"); if (b) { state.logoSize = b.dataset.size; update(); } });
  $$("[data-field]").forEach(el => el.addEventListener("input", () => {
    const k = el.dataset.field;
    state[k] = el.type === "checkbox" ? el.checked : el.type === "range" ? +el.value : el.value;
    update();
  }));

  // tabs
  $$(".tab").forEach(t => t.addEventListener("click", () => {
    $$(".tab").forEach(x => x.classList.toggle("active", x === t));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + t.dataset.tab));
    const insta = t.dataset.tab === "insta";
    $$(".top-actions > *").forEach(x => x.style.visibility = insta ? "" : "hidden");
    if (insta) { fit(); update(); }
  }));

  // photo
  const drop = $("#drop"), input = $("#photo-input");
  const take = file => {
    if (!file || !file.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result, true);
    r.readAsDataURL(file);
  };
  input.addEventListener("change", () => take(input.files[0]));
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => take(e.dataTransfer.files[0]));
  $("#stage").addEventListener("dragover", e => e.preventDefault());
  $("#stage").addEventListener("drop", e => { e.preventDefault(); take(e.dataTransfer.files[0]); });
  $("#photo-remove").addEventListener("click", () => {
    photo = null; photoFx = null; drop.classList.remove("has"); drop.style.backgroundImage = "";
    try { localStorage.removeItem(STORE + "-photo"); } catch (e) {}
    update();
  });

  // export
  $$("#scale-seg .seg-btn").forEach(b => b.addEventListener("click", () => {
    exportScale = +b.dataset.scale; $$("#scale-seg .seg-btn").forEach(x => x.classList.toggle("active", x === b));
  }));
  $("#export-png").addEventListener("click", () => exportPNG());
  $("#export-all").addEventListener("click", async () => {
    const keep = state.format;
    for (const f of Object.keys(FORMATS)) { state.format = f; await exportPNG(true); await new Promise(r => setTimeout(r, 350)); }
    state.format = keep; update(); toast("Saved both sizes");
  });
  $$(".vt").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
  $("#reset").addEventListener("click", () => { state = Object.assign({}, DEFAULTS); update(); });

  new ResizeObserver(() => { fit(); layoutHits(); }).observe($("#frame"));
  initSteps(); initDirectEdit();
  document.body.insertAdjacentHTML("beforeend", '<div id="toast"></div>');
}

/* ---------- sidebar helpers ---------- */
const LOGO_NAMES = Object.fromEntries(LOGO_OPTIONS.flatMap(([, o]) => o));
function syncSummaries() {
  const f = FORMATS[state.format], firstLine = s => (s || "").split("\n")[0];
  const sums = {
    size: f.label, more: "Text, photo, logo position",
    template: TEMPLATES[state.template].title,
    text: firstLine(state.headline),
    photo: photo ? "Photo added" : "No photo",
    logo: (LOGO_NAMES[state.logo] || "").split(" — ")[0],
    colours: COLOURWAYS[state.colour].label,
    ig: state.igName, extras: "",
  };
  $$("[data-sum]").forEach(el => el.textContent = sums[el.dataset.sum] ?? "");

}
let THUMB_T = null;
function scheduleThumbs() { clearTimeout(THUMB_T); THUMB_T = setTimeout(renderThumbs, 160); }
function renderThumbs() {   // live mini previews of every template with the current settings
  const keep = state.template, keepSafe = state.safe, keepGuides = state.guides, c = document.createElement("canvas");
  state.safe = false; state.guides = false; EXPORTING = true; THUMBING = true;
  try {
    for (const k of Object.keys(TEMPLATES)) {
      state.template = k; render(c, 180 / FORMATS[state.format].w);
      const img = document.querySelector(`#template-tiles [data-template="${k}"] img`); if (img) img.src = c.toDataURL("image/jpeg", 0.8);
    }
  } finally { state.template = keep; state.safe = keepSafe; state.guides = keepGuides; EXPORTING = false; THUMBING = false; }
}
const OPEN_KEY = STORE + "-open2";
function initSteps() {
  let open; try { open = JSON.parse(localStorage.getItem(OPEN_KEY)); } catch (e) {}
  open = open || ["size", "template", "colours", "logo"];
  $$(".step").forEach(s => {
    s.classList.toggle("open", open.includes(s.dataset.step));
    s.querySelector(".step-head").addEventListener("click", () => {
      s.classList.toggle("open");
      try { localStorage.setItem(OPEN_KEY, JSON.stringify($$(".step.open").map(x => x.dataset.step))); } catch (e) {}
    });
  });
  // export menu
  const menu = $("#export-menu");
  $("#export-open").addEventListener("click", e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener("click", e => { if (!menu.hidden && !e.target.closest(".export-wrap")) menu.hidden = true; });
  menu.querySelectorAll(".em-item").forEach(b => b.addEventListener("click", () => { menu.hidden = true; }));
}

/* ---------- starters ---------- */
function applyStarter(st) {
  Object.assign(state, DEFAULTS, { igName: state.igName, igCaption: state.igCaption }, st.set, { logoPos: "auto" });
  update();
}
function openStarters() {
  const g = $("#starter-grid"), keep = Object.assign({}, state), c = document.createElement("canvas");
  EXPORTING = true; THUMBING = true;
  g.innerHTML = STARTERS.map((s, i) => {
    Object.assign(state, DEFAULTS, s.set); render(c, 240 / FORMATS[state.format].w);
    return `<button class="starter" data-i="${i}"><span class="thumb"><img src="${c.toDataURL("image/jpeg", .85)}" alt=""></span><b>${s.title}</b><span>${s.sub}</span></button>`;
  }).join("");
  EXPORTING = false; THUMBING = false; Object.assign(state, keep); update();
  $("#starters").hidden = false;
}

/* ---------- edit on the design ---------- */
const HIT_LABELS = { headline: "Headline", photo: "Photo", logo: "Logo" };
function layoutHits() {
  const layer = $("#hits"); layer.innerHTML = "";
  if (VIEW !== "design") return;
  const f = FORMATS[state.format], cr = canvas.getBoundingClientRect(), fr = $("#frame").getBoundingClientRect();
  const k = cr.width / f.w;
  layer.style.left = (cr.left - fr.left) + "px"; layer.style.top = (cr.top - fr.top) + "px";
  layer.style.width = cr.width + "px"; layer.style.height = cr.height + "px";
  for (const hh of LAST_HITS) {
    const d = document.createElement("div");
    d.className = "hit hit-" + hh.field; d.dataset.field = hh.field;
    d.style.left = hh.x * k + "px"; d.style.top = hh.y * k + "px"; d.style.width = hh.w * k + "px"; d.style.height = hh.h * k + "px";
    d.innerHTML = `<span>${hh.field === "photo" ? (photo ? "Click to change · drag to move" : "Click to add a photo") : "Edit " + HIT_LABELS[hh.field].toLowerCase()}</span>`;
    d._hit = hh; layer.appendChild(d);
  }
}
function fieldInput(label, key, multi, ph) {
  return `<label class="field">${label ? `<span>${label}</span>` : ""}${multi ? `<textarea data-pf="${key}" rows="3"></textarea>` : `<input data-pf="${key}" type="text" placeholder="${ph || ""}">`}</label>`;
}
function openPop(field, el) {
  const pop = $("#pop");
  let html = `<div class="pop-title">${HIT_LABELS[field]}</div>`;
  if (field === "headline") html += fieldInput("", "headline", true);
  if (field === "photo") html += `<div class="pop-btns"><button class="btn small" data-act="choose">${photo ? "Change photo" : "Add a photo"}</button>${photo ? '<button class="btn ghost small" data-act="remove">Remove</button>' : ""}</div>
      <div class="slider"><span>Zoom</span><input type="range" data-pf="zoom" min="1" max="3" step="0.01"></div>
      <div class="slider"><span>Lou's filter</span><input type="range" data-pf="warm" min="0" max="1" step="0.01"></div>
      <label class="toggle"><input type="checkbox" data-pf="soft"> Soft background (portrait look)</label>
      <p class="hint">Drag the photo on the design to move it. Best photos: shot from 45° with the whole plate in frame, in iPhone Portrait mode.</p>`;
  if (field === "logo") html += `<div class="row-label">Where</div>
      <div class="seg cols-4">${[["auto","Auto"],["tc","Top"],["mc","Middle"],["bc","Bottom"]].map(([p, l]) => `<button class="seg-btn" data-ppos="${p}">${l}</button>`).join("")}</div>
      <div class="row-label">Size</div>
      <div class="seg cols-3">${["S","M","L"].map(s => `<button class="seg-btn" data-psize="${s}">${s}</button>`).join("")}</div>
      <p class="hint">Change the logo itself in step 4.</p>`;
  html += `<div class="pop-foot"><button class="btn small" data-act="done">Done</button></div>`;
  pop.innerHTML = html; pop.hidden = false;
  // bind
  pop.querySelectorAll("[data-pf]").forEach(inp => {
    const k = inp.dataset.pf;
    if (inp.type === "checkbox") inp.checked = !!state[k]; else inp.value = state[k] ?? "";
    inp.addEventListener("input", () => { state[k] = inp.type === "checkbox" ? inp.checked : inp.type === "range" ? +inp.value : inp.value; update(); });
  });
  const syncPos = () => { pop.querySelectorAll("[data-ppos]").forEach(b => b.classList.toggle("active", b.dataset.ppos === state.logoPos));
                          pop.querySelectorAll("[data-psize]").forEach(b => b.classList.toggle("active", b.dataset.psize === state.logoSize)); };
  pop.querySelectorAll("[data-ppos]").forEach(b => b.addEventListener("click", () => { state.logoPos = b.dataset.ppos; update(); syncPos(); }));
  pop.querySelectorAll("[data-psize]").forEach(b => b.addEventListener("click", () => { state.logoSize = b.dataset.psize; update(); syncPos(); }));
  syncPos();
  pop.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", () => {
    const act = b.dataset.act;
    if (act === "choose") $("#photo-input").click();
    if (act === "remove") $("#photo-remove").click();
    closePop();
  }));
  // position next to the element, inside the frame
  const fr = $("#frame").getBoundingClientRect(), r = el.getBoundingClientRect();
  const pw = 300; pop.style.width = pw + "px";
  let left = r.left - fr.left + r.width / 2 - pw / 2; left = Math.max(8, Math.min(fr.width - pw - 8, left));
  let top = r.bottom - fr.top + 10; const ph = pop.offsetHeight;
  if (top + ph > fr.height - 8) top = Math.max(8, r.top - fr.top - ph - 10);
  pop.style.left = left + "px"; pop.style.top = top + "px";
  const first = pop.querySelector("textarea, input[type=text]"); if (first) { first.focus(); first.select && first.select(); }
}
function closePop() { $("#pop").hidden = true; }
function initDirectEdit() {
  const layer = $("#hits");
  let drag = null;
  layer.addEventListener("pointerdown", e => {
    const el = e.target.closest(".hit"); if (!el) return;
    if (el._hit.field === "photo" && photo) {
      const hh = el._hit, s = Math.max(hh.w / photo.naturalWidth, hh.h / photo.naturalHeight) * state.zoom;
      drag = { el, x: e.clientX, y: e.clientY, px: state.px, py: state.py, moved: false,
               ox: photo.naturalWidth * s - hh.w, oy: photo.naturalHeight * s - hh.h,
               k: canvas.getBoundingClientRect().width / FORMATS[state.format].w };
      el.setPointerCapture(e.pointerId);
    }
  });
  layer.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) / drag.k, dy = (e.clientY - drag.y) / drag.k;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    if (drag.ox > 1) state.px = Math.max(0, Math.min(100, drag.px - dx / drag.ox * 100));
    if (drag.oy > 1) state.py = Math.max(0, Math.min(100, drag.py - dy / drag.oy * 100));
    render(canvas, 1, previewing() ? loopTime() : null);
  });
  layer.addEventListener("pointerup", e => {
    const el = e.target.closest(".hit");
    if (drag) { const moved = drag.moved; drag = null; if (moved) { update(); return; } }
    if (!el) return;
    if (el._hit.field === "photo" && !photo) { $("#photo-input").click(); return; }
    openPop(el._hit.field, el);
  });
  document.addEventListener("pointerdown", e => {
    if (!$("#pop").hidden && !e.target.closest("#pop") && !e.target.closest(".hit")) closePop();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closePop(); $("#starters").hidden = true; } });
  // starters
  $("#new-design").addEventListener("click", openStarters);
  $("#starters-close").addEventListener("click", () => $("#starters").hidden = true);
  $("#starter-grid").addEventListener("click", e => { const b = e.target.closest(".starter"); if (b) { applyStarter(STARTERS[+b.dataset.i]); $("#starters").hidden = true; } });
}

function setPhoto(src, fresh) {
  const img = new Image();
  img.onload = () => {
    photo = img; photoFx = window.LFFPhoto ? LFFPhoto.process(img) : null; const d = $("#drop"); d.classList.add("has"); d.style.backgroundImage = `url(${src})`;
    if (fresh) { state.zoom = 1; state.px = 50; state.py = 50; }
    update();
  };
  img.src = src;
}

function exportPNG(quiet) {
  return new Promise(resolve => {
    EXPORTING = true;
    const c = document.createElement("canvas"); render(c, exportScale);
    EXPORTING = false;
    const f = FORMATS[state.format];
    const name = `lff_${state.template}_${state.format}_${f.w}x${f.h}${exportScale > 1 ? "@" + exportScale + "x" : ""}.png`;
    c.toBlob(b => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      if (!quiet) toast("Saved " + name);
      resolve();
    }, "image/png");
  });
}
let BUSY = false;
async function exportVideo(kind) {
  if (BUSY) return; BUSY = true;
  const f = FORMATS[state.format], base = `lff_${state.template}_${state.format}_logo`;
  const c = document.createElement("canvas");
  EXPORTING = true;
  try {
    if (kind === "mp4") {
      if (!("VideoEncoder" in window)) { toast("MP4 export needs Chrome, Edge or Safari 16.4+"); return; }
      const s = exportScale, W = Math.round(f.w * s / 2) * 2, H = Math.round(f.h * s / 2) * 2, fps = 30, N = ANIM.D * fps;
      let codec = null;
      for (const cd of ["avc1.640033", "avc1.4d0033", "avc1.640028", "avc1.42002a"]) {
        try { const r = await VideoEncoder.isConfigSupported({ codec: cd, width: W, height: H, bitrate: 12e6, framerate: fps }); if (r.supported) { codec = cd; break; } } catch (e) {}
      }
      if (!codec) { toast("This browser can't encode MP4 at this size — try 1×"); return; }
      const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" });
      const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => console.error(e) });
      enc.configure({ codec, width: W, height: H, bitrate: 12e6, framerate: fps });
      for (let i = 0; i < N; i++) {
        render(c, s, i / fps);
        const fr = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        enc.encode(fr, { keyFrame: i % 60 === 0 }); fr.close();
        if (i % 10 === 0) { toast(`Rendering MP4… ${Math.round(i / N * 100)}%`, true); await new Promise(r => setTimeout(r, 0)); }
        while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 5));
      }
      await enc.flush(); muxer.finalize();
      download(new Blob([muxer.target.buffer], { type: "video/mp4" }), `${base}_${W}x${H}.mp4`);
    } else {
      const gw = 540, s = gw / f.w, fps = 20, N = ANIM.D * fps;
      const gif = new GIF({ workers: 2, quality: 8, width: Math.round(f.w * s), height: Math.round(f.h * s), workerScript: "vendor/gif.worker.js" });
      for (let i = 0; i < N; i++) {
        render(c, s, i / fps); gif.addFrame(c, { copy: true, delay: 1000 / fps });
        if (i % 10 === 0) { toast(`Preparing GIF frames… ${Math.round(i / N * 100)}%`, true); await new Promise(r => setTimeout(r, 0)); }
      }
      await new Promise(res => {
        gif.on("progress", p => toast(`Encoding GIF… ${Math.round(p * 100)}%`, true));
        gif.on("finished", b => { download(b, `${base}_${Math.round(f.w * s)}x${Math.round(f.h * s)}.gif`); res(); });
        gif.render();
      });
    }
  } finally { EXPORTING = false; BUSY = false; }
}
function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Saved " + name);
}

function toast(msg, sticky) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), sticky ? 6000 : 2200); }

(async function init() {
  build();
  try { await Promise.all([document.fonts.load('400 40px "PP Monument Extended"'), document.fonts.load('300 40px "PP Monument Extended"')]); } catch (e) {}
  const saved = (() => { try { return localStorage.getItem(STORE + "-photo"); } catch (e) { return null; } })();
  if (saved) setPhoto(saved, false);
  update();
  document.fonts.ready.then(scheduleThumbs);
  if (FIRST_VISIT) openStarters();
})();
