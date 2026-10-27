/* Lou's photo filter — applied automatically to every photo that comes into the tools.

   Built from the Lou's photography brief (45° full-plate shots, a 3000K kitchen light,
   f/2.8–f/4 "portrait" depth of field). It runs once when a photo is added and returns
   ready-made canvases, so drawing and video export stay fast:

     1. White balance  — reads the photo's colour cast from its midtones, neutralises most
                         of it, then adds one consistent warm "3000K kitchen" tone, so cool
                         daylight shots and orange evening shots land in the same place.
     2. Exposure        — sets black and white points from the photo itself (gently, never a
                         full stretch) and adds a soft contrast curve.
     3. Colour          — a vibrance lift that favours dull colours, so food looks fresh
                         without going neon.
     4. Portrait look   — optional: sharp around the plate, falling off into a soft blur that
                         is stronger towards the top of the frame, like a 45° shot at f/2.8–f/4.
                         Simulated (the browser can't see depth), assuming a centred plate.

   LFFPhoto.process(img) -> { graded, soft }   two canvases the size of the (capped) photo
*/
(function () {
  const MAX = 2400;                       // long side cap, same as the editor's import
  const WARM = [1.075, 1.0, 0.84];         // the "3000K kitchen" tone, applied after neutralising
  const WB_STRENGTH = 0.7;                // how much of the original cast is removed (0..1)

  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  function toCanvas(img) {
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    const k = Math.min(1, MAX / Math.max(w0, h0));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  function grade(data) {
    const n = data.length / 4;
    // --- stats: midtone channel means (grey world) + luminance histogram
    let sr = 0, sg = 0, sb = 0, cnt = 0;
    const hist = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
      hist[l]++;
      if (l > 38 && l < 218) { sr += r; sg += g; sb += b; cnt++; }
    }
    if (!cnt) cnt = 1;
    const mr = sr / cnt || 1, mg = sg / cnt || 1, mb = sb / cnt || 1, m = (mr + mg + mb) / 3;
    const lim = v => Math.min(1.35, Math.max(0.75, v));
    const gr = lim(1 + (m / mr - 1) * WB_STRENGTH) * WARM[0];
    const gg = lim(1 + (m / mg - 1) * WB_STRENGTH) * WARM[1];
    const gb = lim(1 + (m / mb - 1) * WB_STRENGTH) * WARM[2];
    // --- levels from percentiles (gentle: limited stretch)
    const pct = p => { let acc = 0; const target = n * p; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v / 255; } return 1; };
    const lo = Math.min(0.1, pct(0.005)), hi = Math.max(0.8, pct(0.995));   // never stretch more than ~1.3x
    const outLo = 0.02, outHi = 0.97, span = Math.max(0.2, hi - lo);
    // --- per-pixel
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] / 255 * gr, g = data[i + 1] / 255 * gg, b = data[i + 2] / 255 * gb;
      r = outLo + (r - lo) / span * (outHi - outLo);
      g = outLo + (g - lo) / span * (outHi - outLo);
      b = outLo + (b - lo) / span * (outHi - outLo);
      // highlight shoulder: roll off the top instead of clipping white plates and jackets
      const sh = v => v > 0.82 ? 0.82 + (1 - Math.exp(-(v - 0.82) / 0.18)) * 0.18 : v;
      r = clamp01(sh(r)); g = clamp01(sh(g)); b = clamp01(sh(b));
      // soft contrast curve
      const c = 0.16;
      r = r * (1 - c) + c * r * r * (3 - 2 * r);
      g = g * (1 - c) + c * g * g * (3 - 2 * g);
      b = b * (1 - c) + c * b * b * (3 - 2 * b);
      // vibrance: lift dull colours more than saturated ones
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const v = 1 + 0.28 * (1 - (mx - mn));
      r = clamp01(l + (r - l) * v); g = clamp01(l + (g - l) * v); b = clamp01(l + (b - l) * v);
      data[i] = r * 255; data[i + 1] = g * 255; data[i + 2] = b * 255;
    }
  }

  // separable box blur, three passes ~ gaussian; works on a quarter-size copy for speed
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let ch = 0; ch < 4; ch++) {
      for (let y = 0; y < h; y++) {          // horizontal
        let acc = 0; const row = y * w;
        for (let x = -r; x <= r; x++) acc += src[(row + Math.min(w - 1, Math.max(0, x))) * 4 + ch];
        for (let x = 0; x < w; x++) {
          tmp[(row + x) * 4 + ch] = acc / (2 * r + 1);
          acc += src[(row + Math.min(w - 1, x + r + 1)) * 4 + ch] - src[(row + Math.max(0, x - r)) * 4 + ch];
        }
      }
      for (let x = 0; x < w; x++) {          // vertical
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * 4 + ch];
        for (let y = 0; y < h; y++) {
          out[(y * w + x) * 4 + ch] = acc / (2 * r + 1);
          acc += tmp[(Math.min(h - 1, y + r + 1) * w + x) * 4 + ch] - tmp[(Math.max(0, y - r) * w + x) * 4 + ch];
        }
      }
    }
    return out;
  }

  function softBackground(gradedCanvas) {
    const W = gradedCanvas.width, H = gradedCanvas.height;
    const q = 4, w = Math.max(1, Math.round(W / q)), h = Math.max(1, Math.round(H / q));
    const small = document.createElement("canvas"); small.width = w; small.height = h;
    const sx = small.getContext("2d"); sx.drawImage(gradedCanvas, 0, 0, w, h);
    let px = sx.getImageData(0, 0, w, h);
    let f = Float32Array.from(px.data);
    const r = Math.max(2, Math.round(Math.max(w, h) * 0.009));
    for (let pass = 0; pass < 3; pass++) f = boxBlur(f, w, h, r);
    for (let i = 0; i < f.length; i++) px.data[i] = f[i];
    sx.putImageData(px, 0, 0);
    const blurred = document.createElement("canvas"); blurred.width = W; blurred.height = H;
    const bx = blurred.getContext("2d"); bx.imageSmoothingQuality = "high"; bx.drawImage(small, 0, 0, W, H);

    // depth mask: 0 = sharp (the plate), 1 = fully soft. Centred focus ellipse, with the
    // falloff pulled towards the top of the frame (the far side of a 45° table).
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const ox = out.getContext("2d"); ox.drawImage(gradedCanvas, 0, 0);
    const sharp = ox.getImageData(0, 0, W, H), soft = bx.getImageData(0, 0, W, H);
    const cx = 0.5, cy = 0.58, rx = 0.36, ry = 0.3;
    for (let y = 0; y < H; y++) {
      const ny = y / H, dy = (ny - cy) / ry, top = smooth(0.5, 0.05, ny) * 0.6;
      for (let x = 0; x < W; x++) {
        const dx = (x / W - cx) / rx, d = Math.sqrt(dx * dx + dy * dy);
        const t = clamp01(smooth(0.9, 1.9, d) + top * smooth(0.55, 1.15, d)) * 0.78;
        if (t <= 0) continue;
        const i = (y * W + x) * 4;
        sharp.data[i] += (soft.data[i] - sharp.data[i]) * t;
        sharp.data[i + 1] += (soft.data[i + 1] - sharp.data[i + 1]) * t;
        sharp.data[i + 2] += (soft.data[i + 2] - sharp.data[i + 2]) * t;
      }
    }
    ox.putImageData(sharp, 0, 0);
    return out;
  }

  function process(img) {
    const graded = toCanvas(img);
    const g = graded.getContext("2d");
    const px = g.getImageData(0, 0, graded.width, graded.height);
    grade(px.data);
    g.putImageData(px, 0, 0);
    return { graded, soft: softBackground(graded) };
  }

  window.LFFPhoto = { process };
})();
