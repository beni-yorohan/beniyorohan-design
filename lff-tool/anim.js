/* Lou's Fancy Foods — animated logo engine.
   Same language as the brand motion pieces: outlines draw on along the real
   bezier paths, anchors + handles appear (Construction), a construction fill
   gives way to the solid mark, then everything retracts so the loop is seamless.
   All timings are on a 5 s loop. t = seconds into the loop. */

const ANIM = {
  D: 5,                       // loop length (s)
  HOLD_T: 3.2,                // a fully-drawn frame (used for stills)
  MODES: [["static", "Static"], ["draw", "Draw on"], ["construct", "Construction"], ["fade", "Fade up"]],
};

/* ---------- path geometry ---------- */
const _TOK = /[MmLlHhVvCcSsQqZz]|-?\d*\.?\d+(?:e-?\d+)?/g;
function parseD(d) {
  const t = d.match(_TOK) || []; let i = 0, cmd = null, cur = [0, 0], start = [0, 0];
  const contours = []; let segs = [];
  const n = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    const rel = cmd === cmd.toLowerCase(), c = cmd.toUpperCase(), o = rel ? cur : [0, 0];
    if (c === "M") { if (segs.length) contours.push(segs); segs = []; cur = start = [n() + o[0], n() + o[1]]; cmd = rel ? "l" : "L"; }
    else if (c === "L") { const p = [n() + o[0], n() + o[1]]; segs.push({ c: "L", p0: cur, p1: p }); cur = p; }
    else if (c === "H") { const p = [n() + o[0], cur[1]]; segs.push({ c: "L", p0: cur, p1: p }); cur = p; }
    else if (c === "V") { const p = [cur[0], n() + o[1]]; segs.push({ c: "L", p0: cur, p1: p }); cur = p; }
    else if (c === "C") { const a = [n() + o[0], n() + o[1]], b = [n() + o[0], n() + o[1]], p = [n() + o[0], n() + o[1]]; segs.push({ c: "C", p0: cur, c1: a, c2: b, p1: p }); cur = p; }
    else if (c === "Q") { const q = [n() + o[0], n() + o[1]], p = [n() + o[0], n() + o[1]];
      segs.push({ c: "C", p0: cur, c1: [cur[0] + 2 / 3 * (q[0] - cur[0]), cur[1] + 2 / 3 * (q[1] - cur[1])], c2: [p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1])], p1: p }); cur = p; }
    else if (c === "Z") { if (Math.hypot(cur[0] - start[0], cur[1] - start[1]) > 0.01) segs.push({ c: "L", p0: cur, p1: start }); cur = start; if (segs.length) contours.push(segs); segs = []; }
    else i++;
  }
  if (segs.length) contours.push(segs);
  return contours;
}
function bez(s, u) {
  const v = 1 - u;
  return [v * v * v * s.p0[0] + 3 * v * v * u * s.c1[0] + 3 * v * u * u * s.c2[0] + u * u * u * s.p1[0],
          v * v * v * s.p0[1] + 3 * v * v * u * s.c1[1] + 3 * v * u * u * s.c2[1] + u * u * u * s.p1[1]];
}
const _GEOM = {};
function logoGeom(key) {
  if (_GEOM[key]) return _GEOM[key];
  const pieces = LOGOS[key].paths.map(d => {
    const polys = [], anchors = []; let total = 0;
    for (const segs of parseD(d)) {
      const pts = [segs[0].p0], cum = [0];
      for (const s of segs) {
        anchors.push({ at: total + cum[cum.length - 1], p: s.p0, hs: s.c === "C" ? [[s.p0, s.c1], [s.p1, s.c2]] : [] });
        const steps = s.c === "C" ? 14 : 1;
        for (let k = 1; k <= steps; k++) {
          const q = s.c === "C" ? bez(s, k / steps) : s.p1, last = pts[pts.length - 1];
          pts.push(q); cum.push(cum[cum.length - 1] + Math.hypot(q[0] - last[0], q[1] - last[1]));
        }
      }
      polys.push({ pts, cum, len: cum[cum.length - 1] }); total += cum[cum.length - 1];
    }
    for (const a of anchors) a.frac = total ? a.at / total : 0;
    return { polys, anchors, total, path: new Path2D(d) };
  });
  return (_GEOM[key] = pieces);
}
// stroke the first (or last, if fromEnd) `frac` of a polyline
function strokePartial(ctx, poly, frac, fromEnd) {
  if (frac <= 0) return;
  const L = poly.len, a = fromEnd ? L * (1 - frac) : 0, b = fromEnd ? L : L * frac;
  const { pts, cum } = poly; ctx.beginPath(); let started = false;
  for (let i = 1; i < pts.length; i++) {
    const l0 = cum[i - 1], l1 = cum[i];
    if (l1 < a || l0 > b) continue;
    const s = Math.max(0, (a - l0) / (l1 - l0 || 1)), e = Math.min(1, (b - l0) / (l1 - l0 || 1));
    const p = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * s, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * s];
    const q = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * e, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * e];
    if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
}

/* ---------- easing ---------- */
const _cl = x => Math.max(0, Math.min(1, x));
const _win = (t, a, b) => _cl((t - a) / (b - a));
const _ease = x => { x = _cl(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const _eout = x => 1 - Math.pow(1 - _cl(x), 3);

/* ---------- draw one animated logo ----------
   box: x, y, w (screen px); color: ink; accent: construction fill colour;
   unit: 1% of the short side (for hairline + dot sizes) */
function drawLogoAnimated(ctx, key, x, y, w, color, accent, t, mode, unit) {
  const L = LOGOS[key], s = w / L.w, G = logoGeom(key), n = G.length;
  t = ((t % ANIM.D) + ANIM.D) % ANIM.D;
  ctx.save();
  if (mode === "fade") {
    const a = _ease(_win(t, 0.15, 1.0)) * (1 - _ease(_win(t, 4.15, 4.9)));
    const dy = (1 - _ease(_win(t, 0.15, 1.25))) * L.h * s * 0.18;
    ctx.globalAlpha *= a; ctx.translate(x, y + dy); ctx.scale(s, s); ctx.fillStyle = color;
    for (const g of G) ctx.fill(g.path);
    ctx.restore(); return;
  }
  ctx.translate(x, y); ctx.scale(s, s);
  const lw = Math.max(1, unit * 0.16) / s, dot = Math.max(1.6, unit * 0.36) / s;
  const out = t >= 3.95;
  const solid = _ease(_win(t, 1.95, 2.55)) * (1 - _ease(_win(t, 4.05, 4.45)));
  const con = mode === "construct" ? _ease(_win(t, 1.45, 1.95)) * (1 - _ease(_win(t, 2.05, 2.5))) : 0;
  const lineA = out ? _ease(_win(t, 3.95, 4.15)) : 1 - _ease(_win(t, 2.4, 2.8));
  const ptsA = mode !== "construct" ? 0 : out ? _ease(_win(t, 3.97, 4.2)) * (1 - _ease(_win(t, 4.4, 4.7))) : 1 - _ease(_win(t, 2.15, 2.55));
  G.forEach((g, i) => {
    const k = n > 1 ? i / (n - 1) : 0;
    const d0 = 0.12 + k * 0.85, dur = 1.15;
    const prog = out ? 1 - _ease(_win(t, 4.2 + k * 0.28, 4.2 + k * 0.28 + 0.48)) : _ease(_win(t, d0, d0 + dur));
    if (con > 0) { ctx.globalAlpha = 0.9 * con; ctx.fillStyle = accent; ctx.fill(g.path); }
    if (solid > 0) { ctx.globalAlpha = solid; ctx.fillStyle = color; ctx.fill(g.path); }
    if (prog > 0 && lineA > 0) {
      ctx.globalAlpha = 0.95 * lineA; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (const p of g.polys) strokePartial(ctx, p, prog, out);
    }
    if (ptsA > 0) {
      for (const an of g.anchors) {
        const sc = out ? 1 : _eout(_win(t, d0 + an.frac * dur * 0.95, d0 + an.frac * dur * 0.95 + 0.25));
        const a = sc * ptsA; if (a <= 0.01) continue;
        ctx.globalAlpha = 0.55 * a; ctx.strokeStyle = color; ctx.lineWidth = lw * 0.6;
        for (const [p0, c] of an.hs) {
          const ex = p0[0] + (c[0] - p0[0]) * sc, ey = p0[1] + (c[1] - p0[1]) * sc;
          ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.globalAlpha = 0.85 * a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(ex, ey, dot * 0.55, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(an.p[0], an.p[1], dot * (0.4 + 0.6 * sc), 0, Math.PI * 2); ctx.fill();
      }
    }
  });
  ctx.restore();
}
