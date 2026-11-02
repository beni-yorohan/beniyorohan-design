/* Lou's Fancy Foods — Labels tab (container label, Rect 2 × 4 in).
   Built on Lara Arditi's label editor: same artwork, measurements and type rules
   (dish name + ingredients typed live, auto CAPS, tracked, shrink-to-fit).
   What changed on the way in:
   - Text is drawn from the font's own outlines (labelfont.js), so the preview, the PNG and the PDF
     are identical and never fall back to another font.
   - The print PDF is vector and matches Lara's print file: one spot colour, PANTONE 5757 C
     (the stamp is its 10% tint), and the die line as a 0.25 pt CutContour stroke. 2.25 × 4.25 in page,
     0.125 in bleed, TrimBox 2 × 4 in.
   - Fit notes tell the kitchen when a name is set smaller or the list is squeezed.
   - Recent labels: every download is kept on this device, one click to bring it back. */
(function () {
  const $ = q => document.querySelector(q);
  const OLIVE = "#6D712E", TINT = "#F0F1EA", PINK = "#EC008C";   // screen versions of 5757 C, its 10% tint, and the cut line
  const W = 162, H = 306;                    // page in pt (2.25 × 4.25 in incl. bleed)
  const TRIM = [9, 9, 153, 297];             // the 2 × 4 in label
  const MAX_TEXT_W = 128, BOTTOM_LIMIT = 284, TRACK = 0.5;   // tracking as a share of cap height
  const LOGO_SHIFT = -3, STAMP_SHIFT = -21.6;
  const L = { dishTop: 104.8, dishCap: 7.8, dishPitch: 13.1, dotsGap: 10.2, headerGap: 24, smallCap: 4.8,
              dots2Gap: 10.3, ingrGap: 10.9, ingrPitch: 13.1, dotsTopOriginal: 148.1 };
  const STORE = "lff-labels-v1";
  const F = LABEL_FONT, CAP = F.cap / F.upm;

  /* vector artwork from LFF_Container-Rect-2x4.3in_Charred-Leeks.pdf (pt, y down) */
  const ART = LABEL_ART;   // labelart.js

  /* ---------- state ---------- */
  const DEFAULTS = { dish: "Charred\nLeeks", ingr: "Sheep's curd\nOlive oil\nLeeks\nLemon", cut: true, recent: [] };
  let S = DEFAULTS;
  try { S = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} };

  const clean = s => s.replace(/'/g, "’").replace(/"/g, "”").toUpperCase().replace(/\s+/g, " ").trim();
  const lines = v => v.split("\n").map(clean).filter(Boolean);

  /* ---------- layout: a list of filled paths (+ the cut line), in pt ---------- */
  const advance = (ch, size) => ((F.glyphs[ch] || F.glyphs["?"])[0]) * size / F.upm;
  const lineWidth = (t, cap) => { const size = cap / CAP, ch = Array.from(t);
    return ch.reduce((a, c) => a + advance(c, size), 0) + cap * TRACK * (ch.length - 1); };
  const fitCap = (group, cap) => { const w = Math.max(0, ...group.map(t => lineWidth(t, cap))); return w > MAX_TEXT_W ? cap * MAX_TEXT_W / w : cap; };

  function layout(st) {
    const items = [], notes = [];
    const art = (k, dy, tint) => ART[k].forEach(d => items.push({ d, m: [1, 0, 0, 1, 0, dy], tint }));
    const text = (t, cap, top) => {
      const size = cap / CAP, s = size / F.upm, base = top + cap;
      let x = W / 2 - lineWidth(t, cap) / 2;
      Array.from(t).forEach(ch => {
        const g = F.glyphs[ch] || F.glyphs["?"];
        if (g[1]) items.push({ d: g[1], m: [s, 0, 0, -s, x, base], tint: 1 });
        x += g[0] * s + cap * TRACK;
      });
    };
    art("stamp", STAMP_SHIFT, 0.1);
    art("logo", LOGO_SHIFT, 1);
    const dish = lines(st.dish), ingr = lines(st.ingr);
    const dishCap = fitCap(dish, L.dishCap);
    dish.forEach((t, i) => text(t, dishCap, L.dishTop + i * L.dishPitch));
    const dishBottom = dish.length ? L.dishTop + (dish.length - 1) * L.dishPitch + dishCap : L.dishTop;
    const dotsTop = dishBottom + L.dotsGap;
    art("dots", dotsTop - L.dotsTopOriginal, 1);
    const headTop = dotsTop + L.headerGap;
    text("INGREDIENTS", L.smallCap, headTop);
    const dots2Top = headTop + L.smallCap + L.dots2Gap;
    art("dots", dots2Top - L.dotsTopOriginal, 1);
    const listTop = dots2Top + L.ingrGap;
    const need = ingr.length ? (ingr.length - 1) * L.ingrPitch + L.smallCap : 0;
    const f = need > 0 ? Math.max(0.35, Math.min(1, (BOTTOM_LIMIT - listTop) / need)) : 1;   // never collapses or flips
    const ingrCap = fitCap(ingr, L.smallCap * f);
    ingr.forEach((t, i) => text(t, ingrCap, listTop + i * L.ingrPitch * f));

    if (!dish.length) notes.push(["warn", "The label has no dish name yet."]);
    else if (dishCap < 5.4) notes.push(["warn", "The name is set quite small to fit. A shorter name or another line break will read better."]);
    else if (dishCap < L.dishCap - 0.01) notes.push(["info", "A long line, so the name is set a little smaller to fit."]);
    if (!ingr.length) notes.push(["warn", "No ingredients yet."]);
    else if (f < 0.6 || ingrCap < 3.2) notes.push(["warn", "Too much to read comfortably. Shorten the list or the name."]);
    else if (f < 1) notes.push(["info", "A long list, so the lines sit closer together."]);
    else if (ingrCap < L.smallCap - 0.01) notes.push(["info", "A long ingredient, so the list is set a little smaller."]);
    return { items, notes, cut: st.cut };
  }

  /* ---------- SVG path data → commands (absolute M L H V C Q Z, the only ones used here) ---------- */
  const CACHE = new Map();
  function parse(d) {
    if (CACHE.has(d)) return CACHE.get(d);
    const tok = d.match(/[MLHVCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) || [], out = [];
    const N = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };
    let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0;
    while (i < tok.length) {
      if (/[A-Z]/i.test(tok[i])) cmd = tok[i++].toUpperCase();
      else if (cmd === "M") cmd = "L";   // extra pairs after M are lines
      const a = tok.slice(i, i + N[cmd]).map(Number); i += N[cmd];
      if (cmd === "M") { x = sx = a[0]; y = sy = a[1]; out.push(["M", x, y]); }
      else if (cmd === "L") { x = a[0]; y = a[1]; out.push(["L", x, y]); }
      else if (cmd === "H") { x = a[0]; out.push(["L", x, y]); }
      else if (cmd === "V") { y = a[0]; out.push(["L", x, y]); }
      else if (cmd === "C") { out.push(["C", ...a]); x = a[4]; y = a[5]; }
      else if (cmd === "Q") { const c1x = x + 2 / 3 * (a[0] - x), c1y = y + 2 / 3 * (a[1] - y), c2x = a[2] + 2 / 3 * (a[0] - a[2]), c2y = a[3] + 2 / 3 * (a[1] - a[3]);
        out.push(["C", c1x, c1y, c2x, c2y, a[2], a[3]]); x = a[2]; y = a[3]; }
      else { out.push(["Z"]); x = sx; y = sy; if (i < tok.length && !/[A-Z]/i.test(tok[i])) cmd = "L"; }
    }
    CACHE.set(d, out); return out;
  }
  const P2D = new Map();
  const path2d = d => { if (!P2D.has(d)) P2D.set(d, new Path2D(d)); return P2D.get(d); };

  // rounded 2 × 4 in cut line (r = 4.5 pt) as commands
  function cutPath() {
    const [x0, y0, x1, y1] = TRIM, r = 4.5, k = r * 0.5523;
    return [["M", x0 + r, y0], ["L", x1 - r, y0], ["C", x1 - r + k, y0, x1, y0 + r - k, x1, y0 + r],
      ["L", x1, y1 - r], ["C", x1, y1 - r + k, x1 - r + k, y1, x1 - r, y1],
      ["L", x0 + r, y1], ["C", x0 + r - k, y1, x0, y1 - r + k, x0, y1 - r],
      ["L", x0, y0 + r], ["C", x0, y0 + r - k, x0 + r - k, y0, x0 + r, y0], ["Z"]];
  }

  /* ---------- canvas (preview + PNG) ---------- */
  function paint(ctx, k, lay) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    lay.items.forEach(it => {
      const m = it.m; ctx.setTransform(k * m[0], k * m[1], k * m[2], k * m[3], k * m[4], k * m[5]);
      ctx.fillStyle = it.tint === 1 ? OLIVE : TINT; ctx.fill(path2d(it.d));
    });
    if (lay.cut) {
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.beginPath();
      cutPath().forEach(c => c[0] === "M" ? ctx.moveTo(c[1], c[2]) : c[0] === "L" ? ctx.lineTo(c[1], c[2]) : c[0] === "C" ? ctx.bezierCurveTo(...c.slice(1)) : ctx.closePath());
      ctx.strokeStyle = PINK; ctx.lineWidth = Math.max(0.25, 1 / k); ctx.stroke();   // at least a device pixel on screen
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------- print PDF: vector, PANTONE 5757 C + CutContour, like Lara's print files ---------- */
  function pdf(lay) {
    const n = v => (Math.round(v * 1000) / 1000).toString();
    const ops = ["1 0 0 -1 0 " + H + " cm"];   // work top-down in pt, like the canvas
    let tint = null;
    lay.items.forEach(it => {
      if (tint !== it.tint) { ops.push("/CS0 cs " + (it.tint === 1 ? "1" : "0.1") + " scn"); tint = it.tint; }   // set outside q…Q so it carries over
      ops.push("q " + it.m.map(n).join(" ") + " cm");
      parse(it.d).forEach(c => ops.push(c[0] === "Z" ? "h" : c.slice(1).map(n).join(" ") + " " + { M: "m", L: "l", C: "c" }[c[0]]));
      ops.push("f Q");
    });
    if (lay.cut) {
      ops.push("/CS1 CS 1 SCN 0.25 w");
      cutPath().forEach(c => ops.push(c[0] === "Z" ? "h" : c.slice(1).map(n).join(" ") + " " + { M: "m", L: "l", C: "c" }[c[0]]));
      ops.push("S");
    }
    const content = ops.join("\n");
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const push = s => { const b = enc.encode(s); parts.push(b); len += b.length; };
    const obj = (i, body) => { offs[i] = len; push(i + " 0 obj\n" + body + "\nendobj\n"); };
    const stream = (dict, s) => "<< " + dict + " /Length " + enc.encode(s).length + " >>\nstream\n" + s + "\nendstream";
    push("%PDF-1.6\n%\xE2\xE3\xCF\xD3\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /BleedBox [0 0 " + W + " " + H + "] /TrimBox [" + TRIM.join(" ") + "]" +
           " /Resources << /ColorSpace << /CS0 4 0 R /CS1 5 0 R >> >> /Contents 8 0 R >>");
    obj(4, "[ /Separation /PANTONE#205757#20C /DeviceCMYK 6 0 R ]");
    obj(5, "[ /Separation /CutContour /DeviceCMYK 7 0 R ]");
    obj(6, stream("/FunctionType 4 /Domain [0 1] /Range [0 1 0 1 0 1 0 1]", "{dup 0.4 mul exch dup 0.25 mul exch dup 1.0 mul exch 0.35 mul}"));
    obj(7, stream("/FunctionType 4 /Domain [0 1] /Range [0 1 0 1 0 1 0 1]", "{0.0 exch dup 1.0 mul exch 0.0 exch pop 0.0}"));
    obj(8, stream("", content));
    obj(9, "<< /Title (Lou's Fancy Foods container label " + fileBase().replace(/[()\\]/g, "") + ") /Creator (Lou's Asset Generator) >>");
    const xref = len; let x = "xref\n0 10\n0000000000 65535 f \n";
    for (let i = 1; i <= 9; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
    push(x + "trailer\n<< /Size 10 /Root 1 0 R /Info 9 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
  }

  /* ---------- UI ---------- */
  const cv = $("#lab-c"), wrap = $("#lab-wrap");
  function render() {
    const lay = layout(S);
    const r = wrap.getBoundingClientRect();
    if (r.width && r.height) {
      const hCss = Math.max(160, Math.min(r.height, r.width * H / W)), wCss = hCss * W / H, dpr = window.devicePixelRatio || 1;
      cv.style.width = wCss + "px"; cv.style.height = hCss + "px";
      cv.width = Math.round(wCss * dpr); cv.height = Math.round(hCss * dpr);
      paint(cv.getContext("2d"), cv.width / W, lay);
      $("#lab-scale").textContent = (hCss / (H * 96 / 72)).toFixed(1).replace(/\.0$/, "") + "× actual size on a standard screen";
    }
    const box = $("#lab-notes");
    box.innerHTML = lay.notes.map(([k, t]) => `<p class="note ${k}">${t}</p>`).join("");
    return lay;
  }
  function fileBase() {
    const name = lines(S.dish).join(" ").toLowerCase().replace(/’/g, "")
      .replace(/(^|\s)\S/g, s => s.toUpperCase()).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "LFF_Container-Rect-2x4in_" + (name || "Label");
  }
  function remember() {
    if (!lines(S.dish).length) return;
    const key = lines(S.dish).join(" ");
    S.recent = [{ dish: S.dish, ingr: S.ingr }, ...S.recent.filter(r => lines(r.dish).join(" ") !== key)].slice(0, 8);
    save(); recentChips();
  }
  function recentChips() {
    const box = $("#lab-recent");
    $("#lab-recent-group").hidden = !S.recent.length;
    box.innerHTML = "";
    S.recent.forEach(r => {
      const b = document.createElement("button");
      b.textContent = lines(r.dish).join(" "); b.title = lines(r.ingr).join(", ");
      b.classList.toggle("on", r.dish === S.dish && r.ingr === S.ingr);
      b.onclick = () => { S.dish = r.dish; S.ingr = r.ingr; $("#lab-dish").value = S.dish; $("#lab-ingr").value = S.ingr; save(); render(); recentChips(); };
      box.appendChild(b);
    });
  }
  function download(kind) {
    const lay = render();
    if (kind === "pdf") { LFF.save(pdf(lay), fileBase() + ".pdf"); remember(); return; }
    const k = 600 / 72, c = document.createElement("canvas");
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    paint(c.getContext("2d"), k, lay);
    c.toBlob(b => { LFF.save(b, fileBase() + ".png"); remember(); }, "image/png");
  }

  $("#lab-dish").value = S.dish; $("#lab-ingr").value = S.ingr; $("#lab-cut").checked = S.cut;
  $("#lab-dish").oninput = e => { S.dish = e.target.value; save(); render(); recentChips(); };
  $("#lab-ingr").oninput = e => { S.ingr = e.target.value; save(); render(); recentChips(); };
  $("#lab-cut").onchange = e => { S.cut = e.target.checked; save(); render(); };
  $("#lab-clear").onclick = () => { S.recent = []; save(); recentChips(); };
  new ResizeObserver(render).observe(wrap);
  recentChips(); render();
  if (location.hash === "#labels") setTab("labels");   // opened straight on the Labels tab (simple.js)
  window.LFFLabels = { download, render, layout, pdf: () => pdf(layout(S)), state: () => S };
})();
