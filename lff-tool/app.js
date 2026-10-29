/* Lou's Fancy Foods — Asset Generator (Instagram tab)
   Everything is drawn on one <canvas> at the real export size, so the preview
   is the export. Logos are the master vectors in logos.js (Path2D). */

const C = { cream: "#FFFFFF", esp: "#4E3524", brown: "#4E3524", olive: "#6D712E" };   // LFF guidelines v1.0: white / 2322 C / 5757 C (keys kept for compatibility)

const FORMATS = {
  story:     { w: 1080, h: 1920, label: "Story / Reel", sub: "Full screen" },
  portrait:  { w: 1080, h: 1350, label: "Tall post",    sub: "Best for feed" },
  square:    { w: 1080, h: 1080, label: "Square post",  sub: "Classic" },
  landscape: { w: 1080, h: 566,  label: "Wide post",    sub: "Landscape" },
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

const TEMPLATES = {
  photo:    { title: "Photo + logo",  sub: "Full-bleed photo, mark on top",
              icon: '<rect x="2" y="2" width="30" height="30" rx="2" fill="currentColor" opacity=".18"/><rect x="10" y="22" width="14" height="4" rx="1" fill="currentColor"/>' },
  announce: { title: "Announcement",  sub: "Headline, body, logo",
              icon: '<rect x="5" y="6" width="10" height="2" fill="currentColor"/><rect x="5" y="11" width="24" height="4" fill="currentColor"/><rect x="5" y="17" width="18" height="4" fill="currentColor"/><rect x="5" y="26" width="12" height="3" fill="currentColor" opacity=".6"/>' },
  product:  { title: "Product label", sub: "Photo + label lines",
              icon: '<path d="M11 21V12a6 6 0 0 1 12 0v9z" fill="currentColor" opacity=".25"/><rect x="9" y="24" width="16" height="2" fill="currentColor"/><rect x="7" y="28" width="20" height="1" fill="currentColor" opacity=".6"/><rect x="13" y="4" width="8" height="2" fill="currentColor"/>' },
  seal:     { title: "Monogram + tagline", sub: "LFF centred, line beneath",
              icon: '<text x="17" y="21" text-anchor="middle" font-size="12" font-style="italic" font-family="Georgia,serif" fill="currentColor">LFF</text><rect x="9" y="26" width="16" height="2" fill="currentColor"/>' },
  logo:     { title: "Logo only",     sub: "The mark on its own — made for GIFs",
              icon: '<rect x="8" y="13" width="18" height="6" rx="1" fill="currentColor"/>' },
  split:    { title: "Split",         sub: "Photo half, colour half",
              icon: '<rect x="2" y="2" width="30" height="16" fill="currentColor" opacity=".18"/><rect x="5" y="21" width="16" height="3" fill="currentColor"/><rect x="5" y="26" width="10" height="2" fill="currentColor" opacity=".6"/><rect x="23" y="25" width="7" height="4" fill="currentColor"/>' },
};

const DEFAULTS = {
  format: "portrait", template: "announce", colour: "cream", logo: "combination", logoSize: "M",
  eyebrow: "New this week",
  headline: "Chicken and rice,\nmade this morning.",
  product: "Chicken and rice",
  body: "Slow-cooked, packed by hand and banded in the kitchen.\nAvailable until we run out.",
  l1k: "Ingredients", l1v: "", l2k: "Made on", l2v: "", l3k: "Best by", l3v: "",
  footer: true, footL: "Lou's Fancy Foods\nEvery day is all there is", footR: "Brand mark\n2026",
  guides: false, safe: true, zoom: 1, px: 50, py: 50, logoPos: "auto", warm: 1, soft: true,
  anim: "static",
  igName: "lousfancyfoods", igCaption: "Chicken and rice, made this morning. Available until we run out.",
};

const STARTERS = [
  { title: "New product", sub: "Photo with label lines",
    set: { template: "product", format: "portrait", colour: "cream", logo: "combination", anim: "static", product: "Chicken and rice" } },
  { title: "Announcement", sub: "A big headline and a short line",
    set: { template: "announce", format: "portrait", colour: "esp", logo: "combination", anim: "static", eyebrow: "New this week",
           headline: "Chicken and rice,\nmade this morning.", body: "Slow-cooked, packed by hand and banded in the kitchen.\nAvailable until we run out." } },
  { title: "Photo post", sub: "Your photo with the logo on top",
    set: { template: "photo", format: "portrait", colour: "esp", logo: "combination", anim: "static" } },
  { title: "Story", sub: "Photo on top, words underneath",
    set: { template: "split", format: "story", colour: "olive", logo: "lous", anim: "static", eyebrow: "Today at Lou's", headline: "Fresh out of the kitchen." } },
  { title: "Logo animation", sub: "The logo drawing itself — for GIF or video",
    set: { template: "logo", format: "square", colour: "esp", logo: "combination", anim: "construct" } },
  { title: "Brand line", sub: "The LFF monogram and a short line",
    set: { template: "seal", format: "portrait", colour: "cream", logo: "lff", anim: "static", headline: "Every day is all there is" } },
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
  try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || "{}")); }
  catch (e) { return Object.assign({}, DEFAULTS); }
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
const TIER = { XS: 0.55, S: 0.75, M: 1, L: 1.3 };

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

// logo position: "auto" uses the template default; otherwise tl tc tr / ml mc mr / bl bc br
function place(def, w, h, R) {
  const p = state.logoPos === "auto" ? def : state.logoPos, v = p[0], hz = p[1];
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
function footer(ctx, W, H, M, cw, color, x0, onPhoto) {
  if (!state.footer) return 0;
  if (onPhoto) { let r; withPhotoShadow(ctx, M, () => { r = footer(ctx, W, H, M, cw, C.cream, x0, false); }); return r; }
  x0 = x0 == null ? M.m : x0;
  const px = Math.max(11, 1.6 * M.u), lead = 1.35, tr = 0.04;
  const l = state.footL ? state.footL.toUpperCase().split("\n") : [];
  const r = state.footR ? state.footR.toUpperCase().split("\n") : [];
  const wl = Math.max(0, ...l.map(s => textW(ctx, s, px, tr))), wr = Math.max(0, ...r.map(s => textW(ctx, s, px, tr)));
  const room = W - M.m - x0;
  const stacked = wl + wr + 4 * M.u > room;          // narrow column: stack right under left
  const lines = stacked ? l.concat(r) : null;
  const n = stacked ? lines.length : Math.max(l.length, r.length), h = n * px * lead;
  const y0 = H - M.bot - h;
  if (stacked) lines.forEach((s, i) => drawLine(ctx, s, x0, y0 + px * 0.8 + i * px * lead, px, tr, color));
  else {
    l.forEach((s, i) => drawLine(ctx, s, x0, y0 + px * 0.8 + i * px * lead, px, tr, color));
    r.forEach((s, i) => drawLine(ctx, s, W - M.m, y0 + px * 0.8 + i * px * lead, px, tr, color, "right"));
  }
  GUIDES.push({ y: y0 }); hit("footer", x0, y0, W - M.m - x0, h);
  return h + 5 * M.u;                                   // breathing room above the captions
}

const RENDER = {
  photo(ctx, W, H, M, cw) {
    drawPhoto(ctx, 0, 0, W, H, cw);
    const fh = footer(ctx, W, H, M, cw, C.cream, M.m, true);
    const key = state.logo, base = Math.min(W * 0.52, H * 0.42) * TIER[state.logoSize];
    const lw = fitLogoW(key, base, base * 0.55), lh = lw * LOGOS[key].h / LOGOS[key].w;
    const P = place("bc", lw, lh, { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot - fh });
    drawMark(ctx, M, key, P.x, P.y, lw, C.cream, true);
    GUIDES.push({ y: P.y }, { y: P.y + lh }, { x: P.x }, { x: P.x + lw });
  },

  announce(ctx, W, H, M, cw) {
    const ink = cw.ink, fh = footer(ctx, W, H, M, cw, ink);
    const key = state.logo, landscape = W / H > 1.5;
    const lmax = (landscape ? W * 0.3 : W * 0.42) * TIER[state.logoSize];
    const lw = fitLogoW(key, lmax, (landscape ? H * 0.22 : H * 0.14) * TIER[state.logoSize]);
    const lh = lw * LOGOS[key].h / LOGOS[key].w;
    const R = { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot - fh };
    const P = place("bl", lw, lh, R);
    drawMark(ctx, M, key, P.x, P.y, lw, ink, false);
    GUIDES.push({ y: P.y }, { y: P.y + lh });
    // text keeps clear of the mark
    const maxW = landscape ? W * 0.62 : W - 2 * M.m;
    let y = M.top, yEnd = P.y - 6 * M.u;
    if (P.v === "t") { y = P.y + lh + 6 * M.u; yEnd = R.y1; }
    if (landscape && P.h === "r" && P.v !== "b") { y = M.top; yEnd = R.y1; }
    textStack(ctx, M, cw, M.m, y, maxW, yEnd, (landscape ? 9.5 : 11) * M.u, 2.9 * M.u);
  },

  product(ctx, W, H, M, cw) {
    const ink = cw.ink, landscape = W / H > 1.3;
    const aw0 = Math.min(W * 0.36, (H - M.top - M.bot) * 0.62);
    const fh = footer(ctx, W, H, M, cw, ink, landscape ? M.m + aw0 + 6 * M.u : M.m);
    const key = state.logo, lmax = (landscape ? W * 0.18 : W * 0.3) * TIER[state.logoSize];
    const lw = fitLogoW(key, lmax, H * (landscape ? 0.12 : 0.085) * TIER[state.logoSize]);
    const lh = lw * LOGOS[key].h / LOGOS[key].w;
    const pos = state.logoPos === "auto" ? "tc" : state.logoPos, v = pos[0];
    const linesPx = Math.max(12, 1.9 * M.u), rows = [[state.l1k, state.l1v], [state.l2k, state.l2v], [state.l3k, state.l3v]].filter(r => r[0] || r[1]);
    const overPhoto = (ax, ay, aw, ah) => {           // middle = the mark sits on the photo
      const w2 = Math.min(aw * 0.78, lw * 1.25), h2 = w2 * LOGOS[key].h / LOGOS[key].w;
      drawMark(ctx, M, key, ax + (aw - w2) / 2, ay + ah * 0.62 - h2 / 2, w2, C.cream, true);
    };
    if (landscape) {
      const aw = aw0, ah = H - M.top - M.bot, ax = M.m, ay = M.top;
      drawPhoto(ctx, ax, ay, aw, ah, cw, framePath(ax, ay, aw, ah));
      const tx = ax + aw + 6 * M.u, tw = W - tx - M.m;
      let y = M.top;
      if (v === "t") { drawMark(ctx, M, key, tx, M.top, lw, ink, false); y += lh + 6 * M.u; }
      else if (v === "m") overPhoto(ax, ay, aw, ah);
      else drawMark(ctx, M, key, tx, H - M.bot - fh - lh, lw, ink, false);
      const ppx = fitPx(ctx, state.product, tw, 14 * M.u, 5.5 * M.u, 1.1, 0.05, 2.5 * M.u, true);
      { const py0 = y; y = drawBlock(ctx, state.product, tx, y, tw, ppx, 1.1, 0.05, ink, "left", true); hit("product", tx, py0, tw, y - py0); y += 4 * M.u; }
      productRows(ctx, rows, tx, y, tw, linesPx, M, ink);
      return;
    }
    const hx = pos[1] === "l" ? M.m : pos[1] === "r" ? W - M.m - lw : (W - lw) / 2;
    let y = M.top;
    if (v === "t") { drawMark(ctx, M, key, hx, y, lw, ink, false); y += lh + 4.5 * M.u; }
    const rowsH = rows.length * (linesPx * 1.2 + 4.2 * M.u);
    const ppx = fitPx(ctx, state.product, W - 2 * M.m, 12 * M.u, 5.4 * M.u, 1.1, 0.05, 2.6 * M.u, true);
    const prodH = blockH(ctx, state.product, W - 2 * M.m, ppx, 1.1, 0.05, true);
    let bottom = H - M.bot - fh;
    if (v === "b") { drawMark(ctx, M, key, hx, bottom - lh, lw, ink, false); bottom -= lh + 4 * M.u; }
    const ah = Math.max(10 * M.u, bottom - y - prodH - rowsH - 10 * M.u);
    const aw = Math.min(W * 0.62, ah * 0.72), ax = (W - aw) / 2;
    drawPhoto(ctx, ax, y, aw, ah, cw, framePath(ax, y, aw, ah));
    if (v === "m") overPhoto(ax, y, aw, ah);
    GUIDES.push({ y }, { y: y + ah }, { x: ax }, { x: ax + aw });
    y += ah + 5 * M.u;
    { const py0 = y; y = drawBlock(ctx, state.product, M.m, y, W - 2 * M.m, ppx, 1.1, 0.05, ink, "center", true); hit("product", M.m, py0, W - 2 * M.m, y - py0); y += 3.5 * M.u; }
    const rw = Math.min(W - 2 * M.m, W * 0.66);
    productRows(ctx, rows, (W - rw) / 2, y, rw, linesPx, M, ink);
  },

  seal(ctx, W, H, M, cw) {
    const ink = cw.ink, fh = footer(ctx, W, H, M, cw, ink);
    const key = "lff";                                   // this template is always the monogram
    const L = LOGOS[key], avH = H - M.top - M.bot - fh;
    const tpx = Math.max(14, 3.1 * M.u);
    const textH = state.headline ? blockH(ctx, state.headline, W * 0.7, tpx, 1.3, 0.06, true) + 6 * M.u : 0;
    const lw = Math.min(W * (M.story ? 0.5 : 0.36) * TIER[state.logoSize], (avH - textH) * L.w / L.h * 0.8);
    const lh = lw * L.h / L.w;
    const tw = Math.max(lw, Math.min(W * 0.7, W - 2 * M.m));
    const P = place("mc", tw, lh + textH, { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot - fh });
    const sx = P.x + (tw - lw) / 2;
    drawMark(ctx, M, key, sx, P.y, lw, ink, false);
    GUIDES.push({ y: P.y }, { y: P.y + lh }, { x: sx }, { x: sx + lw });
    if (state.headline) { const hy = P.y + lh + 6 * M.u, he = drawBlock(ctx, state.headline, P.x, hy, tw, tpx, 1.3, 0.06, ink, "center", true); hit("headline", P.x, hy, tw, he - hy); }
  },

  logo(ctx, W, H, M, cw) {
    const ink = cw.ink, fh = footer(ctx, W, H, M, cw, ink);
    const key = state.logo, base = Math.min(W * 0.62, H * 0.5) * TIER[state.logoSize];
    const lw = fitLogoW(key, base, base * 0.62), lh = lw * LOGOS[key].h / LOGOS[key].w;
    const P = place("mc", lw, lh, { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot - fh });
    drawMark(ctx, M, key, P.x, P.y, lw, ink, false);
    GUIDES.push({ y: P.y }, { y: P.y + lh }, { x: P.x }, { x: P.x + lw });
  },

  split(ctx, W, H, M, cw) {
    const ink = cw.ink, vertical = H / W > 1.05;
    let photoR, tx, ty, tw;
    if (vertical) { const ph = H * (H / W > 1.6 ? 0.56 : 0.52); photoR = { x: 0, y: 0, w: W, h: ph }; tx = M.m; ty = ph + 5 * M.u; tw = W - 2 * M.m; }
    else { photoR = { x: 0, y: 0, w: W * 0.5, h: H }; tx = W * 0.5 + 5 * M.u; ty = M.top; tw = W - tx - M.m; }
    drawPhoto(ctx, photoR.x, photoR.y, photoR.w, photoR.h, cw);
    const fh = footer(ctx, W, H, M, cw, ink, tx);
    const key = state.logo;
    const lw = fitLogoW(key, tw * 0.5 * TIER[state.logoSize], (vertical ? H * 0.09 : H * 0.18) * TIER[state.logoSize]);
    const lh = lw * LOGOS[key].h / LOGOS[key].w;
    // auto = bottom-left of the colour panel; any other position is on the whole frame
    const panelR = { x0: tx, y0: ty, x1: W - M.m, y1: H - M.bot - fh };
    const R = state.logoPos === "auto" ? panelR : { x0: M.m, y0: M.top, x1: W - M.m, y1: H - M.bot - fh };
    const P = place("bl", lw, lh, R);
    const box = { x: P.x, y: P.y, w: lw, h: lh };
    const onPhoto = overlaps(box, photoR);
    drawMark(ctx, M, key, P.x, P.y, lw, ink, onPhoto);
    const inPanel = overlaps(box, { x: tx, y: ty, w: W - tx, h: H - ty });
    let y = ty, yEnd = panelR.y1;
    if (inPanel) { if (P.y > ty + (panelR.y1 - ty) * 0.35) yEnd = P.y - 4 * M.u; else y = Math.max(ty, P.y + lh + 4 * M.u); }
    textStack(ctx, M, cw, tx, y, tw, yEnd, 8 * M.u, 2.6 * M.u);
  },
};

// eyebrow + headline (auto-fit) + body inside [y, yEnd]
function textStack(ctx, M, cw, x, y, maxW, yEnd, headPx, bodyPx0) {
  const ink = cw.ink;
  if (state.eyebrow) {
    const epx = 2.2 * M.u; drawLine(ctx, state.eyebrow.toUpperCase(), x, y + epx * 0.8, epx, 0.06, cw.eyebrow);
    y += epx * 1.2 + 3 * M.u; GUIDES.push({ y });
  }
  if (state.eyebrow) hit("eyebrow", x, y - 3 * M.u - 2.2 * M.u * 1.2, maxW, 2.2 * M.u * 1.3);
  let bodyPx = Math.max(13, bodyPx0);
  const bw = maxW * 0.9;
  // body may use at most 60% of the room left (wide +250 tracking wraps sooner), the headline gets the rest
  const room = yEnd - y, minBody = Math.max(11, 2 * M.u);
  while (state.body && bodyPx > minBody && blockH(ctx, state.body, bw, bodyPx, 1.38, 0) + 3 * M.u > room * 0.6) bodyPx *= 0.95;
  const bodyH = state.body ? blockH(ctx, state.body, bw, bodyPx, 1.38, 0) + 3 * M.u : 0;
  const hpx = fitPx(ctx, state.headline, maxW, Math.max(30, yEnd - y - bodyH), headPx, 1.04, 0, 3 * M.u);
  const hy = y; y = drawBlock(ctx, state.headline, x, y, maxW, hpx, 1.04, 0, ink); hit("headline", x, hy, maxW, y - hy);
  if (state.body) { const by = y + 3 * M.u, be = drawBlock(ctx, state.body, x, by, bw, bodyPx, 1.38, 0, ink); hit("body", x, by, bw, be - by); }
}

function productRows(ctx, rows, x, y, w, px, M, ink) {
  if (rows.length) hit("rows", x, y, w, rows.length * (px * 1.2 + 4.2 * M.u));
  for (const [k, v] of rows) {
    const yy = y + px;
    const kw = drawLine(ctx, (k || "").toUpperCase(), x, yy, px, 0.06, ink);
    if (v) drawLine(ctx, v, x + kw + 2.5 * M.u, yy, px * 1.15, 0, ink);
    hr(ctx, x, yy + 1.6 * M.u, w, ink, 0.55, Math.max(1, M.u * 0.12));
    y += px * 1.2 + 4.2 * M.u;
  }
  return y;
}

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
  const ink = state.template === "photo" ? C.cream : cw.ink;
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

let T0 = performance.now(), PLAYING = false;
function loopTime() { return ((performance.now() - T0) / 1000) % ANIM.D; }
function tick() {
  if (state.anim === "static" || document.querySelector(".tab.active").dataset.tab !== "insta") { PLAYING = false; return; }
  render(canvas, 1, loopTime()); requestAnimationFrame(tick);
}
function update() {
  if (state.anim === "static") render(canvas, 1);
  else { render(canvas, 1, loopTime()); if (!PLAYING) { PLAYING = true; requestAnimationFrame(tick); } }
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
  $$("#anim-seg .seg-btn").forEach(b => b.classList.toggle("active", b.dataset.anim === state.anim));

  $$("#logo-tiles .logo-tile").forEach(b => b.classList.toggle("active", b.dataset.logo === state.logo));
  const posNotes = { split: "Auto keeps it in the colour panel. Other positions use the whole frame — over the photo it turns white.",
    product: "Middle puts the mark over the photo.", seal: "This template always uses the LFF monogram. Position moves it and its line together." };
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
    `<button class="size-card" data-format="${k}" title="${f.w} × ${f.h} px"><span class="shape" style="aspect-ratio:${f.w}/${f.h}"></span><b>${f.label}</b><small>${f.sub}</small></button>`).join("");
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
  $("#anim-seg").innerHTML = ANIM.MODES.map(([k, l]) => `<button class="seg-btn" data-anim="${k}">${l}</button>`).join("");
  $("#anim-seg").addEventListener("click", e => { const b = e.target.closest("[data-anim]"); if (b) { state.anim = b.dataset.anim; T0 = performance.now(); update(); } });
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
    state.format = keep; update(); toast("Exported 4 formats");
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
    size: f.label, more: "Text, photo, captions…",
    template: TEMPLATES[state.template].title,
    text: firstLine(state.template === "product" ? state.product : state.headline),
    photo: photo ? "Photo added" : "No photo",
    logo: (LOGO_NAMES[state.logo] || "").split(" — ")[0] + (state.anim !== "static" ? " · animated" : ""),
    colours: COLOURWAYS[state.colour].label,
    footer: state.footer ? "On" : "Off",
    ig: state.igName, extras: "",
  };
  $$("[data-sum]").forEach(el => el.textContent = sums[el.dataset.sum] ?? "");
  const still = state.anim === "static";
  ["#export-mp4", "#export-gif"].forEach(s => $(s).classList.toggle("dim", still));
  $("#em-note").textContent = still ? "For a video or GIF, pick a Movement under 4 · Logo (e.g. Draw on)." : "";
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
  T0 = performance.now(); update();
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
const HIT_LABELS = { eyebrow: "Small heading", headline: "Headline", body: "Body text", product: "Product name",
  rows: "Label lines", footer: "Footer captions", photo: "Photo", logo: "Logo" };
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
  if (field === "eyebrow") html += fieldInput("", "eyebrow");
  if (field === "headline") html += fieldInput("", "headline", true);
  if (field === "body") html += fieldInput("", "body", true);
  if (field === "product") html += fieldInput("", "product");
  if (field === "rows") html += [1, 2, 3].map(i => `<div class="pair"><input data-pf="l${i}k" type="text"><input data-pf="l${i}v" type="text" placeholder="—"></div>`).join("");
  if (field === "footer") html += `<label class="toggle"><input type="checkbox" data-pf="footer"> Show captions</label>` + fieldInput("Left", "footL", true) + fieldInput("Right", "footR", true);
  if (field === "photo") html += `<div class="pop-btns"><button class="btn small" data-act="choose">${photo ? "Change photo" : "Add a photo"}</button>${photo ? '<button class="btn ghost small" data-act="remove">Remove</button>' : ""}</div>
      <div class="slider"><span>Zoom</span><input type="range" data-pf="zoom" min="1" max="3" step="0.01"></div>
      <div class="slider"><span>Lou's filter</span><input type="range" data-pf="warm" min="0" max="1" step="0.01"></div>
      <label class="toggle"><input type="checkbox" data-pf="soft"> Soft background (portrait look)</label>
      <p class="hint">Drag the photo on the design to move it. Best photos: shot from 45° with the whole plate in frame, in iPhone Portrait mode.</p>`;
  if (field === "logo") html += `<div class="row-label">Where</div>
      <div class="pos-grid small">${["tl","tc","tr","ml","mc","mr","bl","bc","br"].map(p => `<button data-ppos="${p}"></button>`).join("")}</div>
      <button class="seg-btn auto-btn" data-ppos="auto">Auto</button>
      <div class="row-label">Size</div>
      <div class="seg cols-4">${["XS","S","M","L"].map(s => `<button class="seg-btn" data-psize="${s}">${s}</button>`).join("")}</div>
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
    render(canvas, 1, state.anim === "static" ? null : loopTime());
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
  if (state.anim === "static") { toast("Pick a Movement under 4 · Logo first"); return; }
  if (BUSY) return; BUSY = true;
  const f = FORMATS[state.format], base = `lff_${state.template}_${state.format}_${state.anim}`;
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
