/* jshint esversion: 11 */
/* global p5, noise, noiseSeed, createCanvas, background, fill, noStroke, stroke, strokeWeight,
          beginShape, endShape, curveVertex, vertex, CLOSE, TWO_PI, HALF_PI, PI, push, pop,
          translate, rotate, scale, cos, sin, map, width, height, millis, frameCount, pixelDensity,
          resizeCanvas, windowResized, image, textFont, textAlign, textStyle, textSize, text,
          CENTER, BASELINE, NORMAL, drawingContext, saveCanvas, clear, Path2D */

// ============================================================================
// STATE
// ============================================================================
//
// Two top-level tools, switchable via the segmented control:
//   - `composer` — preset-only social asset builder
//   - `blob`     — animated tomato (blob + 8-corner star) generator
//
// Asset Composer is preset-driven: the user picks one of 5 layouts, which
// fully determines logo position+size, star placement, and text layout. Free
// composition is intentionally not exposed.
//
// Blob is its own thing — animated, seamlessly looped, with one combo size
// slider that scales blob+star together. Static exports are transparent with
// the star punched out as a hole; animated exports use a solid bg color so
// the star reads as a cutout against it.

const state = {
    tool: 'composer',                  // 'composer' | 'blob'

    canvasWidth: 1080,
    canvasHeight: 1350,

    // ---------- Asset Composer ----------
    assetPreset: 'product-lockup',
    // Size tiers, overridable via the Sizes panel. Picking a preset resets
    // these to the preset's declared defaults.
    logoTier: 'S',
    starTier: 'S',
    textTier: 'S',
    textLine1: 'BATCH 07',
    textLine2: 'ÇANAKKALE    HARVEST,    TÜRKİYE.',
    mode: 'yellow-red',                // bg mode for the composer

    // ---------- Blob (Tomato) ----------
    blobSize: 0.40,                    // combo size — blob + inside star scale together
    wobble: 0.10,
    noiseScale: 0.9,
    segments: 96,
    seed: 42,
    motion: 'wobble',
    speed: 0.3,
    duration: 6,
    blobBg: 'transparent',             // 'transparent' | 'yellow'
};

// Blob is always brand red. Background is either transparent (with the star
// punched out as a true alpha hole) or solid brand yellow (with the star
// rendered in the same yellow so it reads as a cutout against the red blob).
const BLOB_FILL_COLOR = '#ED2024';
const BLOB_BG_YELLOW  = '#F4C60C';

// Star is always 8 corners with a fixed inner ratio per brand rules.
const STAR_POINTS = 8;
const STAR_INNER_RATIO = 0.42;
// Inside-blob star size is locked to a fraction of the blob radius.
const STAR_INSIDE_RATIO = 0.22;

// ============================================================================
// SIZE SCALES — four tiers per element, each step ≈ golden ratio (1.618).
// ============================================================================
//
//   logo  sizes are fraction of canvas WIDTH
//   star  sizes are fraction of canvas MIN DIMENSION
//   text  sizes are fraction of canvas MIN DIMENSION (height of line 1)
//
// Presets pick a default tier per element; the user can override each tier
// independently via the segmented controls in the Sizes panel.
const sizeScales = {
    logo: { XS: 0.13, S: 0.21, M: 0.34, L: 0.55 },
    star: { XS: 0.025, S: 0.040, M: 0.065, L: 0.105 },
    text: { XS: 0.020, S: 0.032, M: 0.052, L: 0.084 },
};
const SIZE_TIERS = ['XS', 'S', 'M', 'L'];

// ============================================================================
// LAYOUT SPECS — the only allowed compositions for the Asset Composer.
// ============================================================================
//
// Sizes are fractions of the canvas (logo: width; star: min dim; text: min dim).
// These mirror the reference PNGs the user provided.
// Every measurement is a fraction of canvas size. Sizes set here were read
// off the five reference PNGs and should reproduce those layouts faithfully.
// Logo `marginX`/`marginY` override the default 5% edge padding — required
// for the Mark presets where the wordmark hugs the canvas edge.
// Each preset declares a default tier per element. Sizes are resolved at
// draw time via `sizeScales` so everything steps by the golden ratio.
const layoutSpecs = {
    'product-lockup': {
        label: 'Product Lockup',
        description: 'Small logo top · 3 stars middle · text bottom',
        logo: { position: 'TC', tier: 'S', marginY: 0.05 },
        stars: { layout: 'row-center', count: 3, tier: 'S', spacing: 0.25 },
        text: { show: true, position: 'bottom', tier: 'S', marginY: 0.055 },
    },
    'hero-wordmark': {
        label: 'Hero Wordmark',
        description: 'Large logo center · stars top & bottom · text under logo',
        logo: { position: 'MC', tier: 'L' },
        stars: { layout: 'row-both', count: 3, tier: 'S', spacing: 0.25, padding: 0.075 },
        text: { show: true, position: 'below-logo', tier: 'XS', gapAfterLogo: 0.03 },
    },
    'mark-top-center': {
        label: 'Mark · Top Center',
        description: 'Logo only, top center',
        logo: { position: 'TC', tier: 'S', marginY: 0.04 },
        stars: { layout: 'none' },
        text: { show: false },
    },
    'mark-top-left': {
        label: 'Mark · Top Left',
        description: 'Logo only, top left · tight to edge',
        logo: { position: 'TL', tier: 'S', marginX: 0.025, marginY: 0.04 },
        stars: { layout: 'none' },
        text: { show: false },
    },
    'mark-top-right': {
        label: 'Mark · Top Right',
        description: 'Logo only, top right · tight to edge',
        logo: { position: 'TR', tier: 'S', marginX: 0.025, marginY: 0.04 },
        stars: { layout: 'none' },
        text: { show: false },
    },
};

// Resolve a layout spec against either user-selected tiers (live draw) or
// the preset's own declared tiers (for thumbnails and defaults). Returns a
// new spec object with numeric `size` fields populated.
function resolveSpec(spec, overrides) {
    const o = overrides || {};
    const logoTier = o.logoTier || spec.logo.tier;
    const starsTier = o.starTier || spec.stars.tier;
    const textTier = o.textTier || spec.text.tier;
    return {
        label: spec.label,
        description: spec.description,
        logo: { ...spec.logo, size: sizeScales.logo[logoTier] },
        stars: spec.stars.layout === 'none'
            ? { ...spec.stars }
            : { ...spec.stars, size: sizeScales.star[starsTier] },
        text: !spec.text.show
            ? { ...spec.text }
            : { ...spec.text, size: sizeScales.text[textTier] },
    };
}

// ============================================================================
// BACKGROUND MODES
// ============================================================================
//
// `fg` drives stars + text (and blob in Blob tool). Logo is always native
// brand red. For image modes, `bg` is the fallback solid color when no
// media has been uploaded; otherwise the uploaded media fills the canvas.
const modes = {
    'yellow-red':   { bg: '#F4C60C', fg: '#ED2024', bgType: 'solid', label: 'Yellow · Red text' },
    'image-white':  { bg: '#F4C60C', fg: '#FFFFFF', bgType: 'image', label: 'Image · White text' },
    'image-yellow': { bg: '#F4C60C', fg: '#F4C60C', bgType: 'image', label: 'Image · Yellow text' },
};

// ============================================================================
// LOGO (vector via Path2D)
// ============================================================================
const LOGO_BRAND_COLOR = '#ed2024';
const LOGO_NATIVE_WIDTH = 712.25;
const LOGO_NATIVE_HEIGHT = 595.78;
let logoPath2Ds = null;

// ============================================================================
// UPLOADED MEDIA (image or video)
// ============================================================================
let uploadedMedia = null;        // HTMLImageElement | HTMLVideoElement
let uploadedMediaType = null;    // 'image' | 'video'
let uploadedMediaDataUrl = null; // base64 (image only) — for SVG export
let uploadedMediaUrl = null;     // object URL (video) — for cleanup

// ============================================================================
// p5 LIFECYCLE
// ============================================================================
let canvasEl;
let container;
let startTime = 0;

function setup() {
    container = document.getElementById('canvas-container');
    canvasEl = createCanvas(state.canvasWidth, state.canvasHeight);
    canvasEl.parent(container);
    pixelDensity(2);
    noStroke();
    startTime = millis();

    buildLogoPaths();
    buildModeTiles('mode-tiles', 'mode');
    buildLayoutTiles();
    wireControls();
    applyToolVisibility();
    fitCanvasToContainer();
    noiseSeed(state.seed);
}

function buildLogoPaths() {
    const pathEls = document.querySelectorAll('#brand-logo path');
    logoPath2Ds = Array.from(pathEls).map(el => new Path2D(el.getAttribute('d')));
}

function windowResized() {
    fitCanvasToContainer();
}

function draw() {
    if (state.tool === 'composer') drawComposer();
    else drawBlobTool();
}

// ============================================================================
// COMPOSER DRAW
// ============================================================================
function drawComposer() {
    const m = modes[state.mode];
    if (m.bgType === 'image' && uploadedMedia) {
        drawCoverMedia();
    } else {
        background(m.bg);
    }

    const rawSpec = layoutSpecs[state.assetPreset];
    if (!rawSpec) return;
    const spec = resolveSpec(rawSpec, {
        logoTier: state.logoTier,
        starTier: state.starTier,
        textTier: state.textTier,
    });

    if (spec.stars.layout && spec.stars.layout !== 'none') {
        drawStarsForSpec(spec.stars, m.fg);
    }
    drawLogoForSpec(spec.logo);
    if (spec.text.show) {
        drawTextForSpec(spec, m.fg);
    }
}

// ---- composer: stars driven by spec ----
function drawStarsForSpec(starsSpec, fillColor) {
    const minDim = Math.min(width, height);
    const r = minDim * starsSpec.size;
    const inner = r * STAR_INNER_RATIO;
    const count = starsSpec.count || 1;
    const spacing = starsSpec.spacing != null ? starsSpec.spacing : 0.18;
    const pad = starsSpec.padding != null ? starsSpec.padding : 0.05;

    const xs = computeRowXs(width, r, count, spacing);
    const ys = computeRowYs(height, minDim, r, pad, starsSpec.layout);

    fill(fillColor);
    for (const y of ys) {
        for (const x of xs) {
            push();
            translate(x, y);
            drawStar(0, 0, r, inner, STAR_POINTS);
            pop();
        }
    }
}

function computeRowXs(W, r, count, spacing) {
    if (count === 1) return [W / 2];
    const gap = W * spacing;
    const starWidth = r * 2;
    const rowWidth = count * starWidth + (count - 1) * gap;
    const startCenter = (W - rowWidth) / 2 + r;
    const xs = [];
    for (let i = 0; i < count; i++) xs.push(startCenter + i * (starWidth + gap));
    return xs;
}

function computeRowYs(H, minDim, r, pad, layout) {
    const padPx = minDim * pad;
    const ys = [];
    if (layout === 'row-center') ys.push(H / 2);
    if (layout === 'row-top') ys.push(padPx + r);
    if (layout === 'row-bottom') ys.push(H - padPx - r);
    if (layout === 'row-both') { ys.push(padPx + r); ys.push(H - padPx - r); }
    return ys;
}

// ---- composer: logo driven by spec ----
function logoRectForSpec(logoSpec, W, H) {
    // W / H default to the live canvas but can be passed for SVG export at
    // an explicit canvas size.
    const cw = W != null ? W : width;
    const ch = H != null ? H : height;
    const targetW = cw * logoSpec.size;
    const aspect = LOGO_NATIVE_HEIGHT / LOGO_NATIVE_WIDTH;
    const targetH = targetW * aspect;
    const marginX = cw * (logoSpec.marginX != null ? logoSpec.marginX : 0.05);
    const marginY = ch * (logoSpec.marginY != null ? logoSpec.marginY : 0.05);
    const pos = logoSpec.position;
    let x, y;
    if (pos[1] === 'L') x = marginX;
    else if (pos[1] === 'R') x = cw - marginX - targetW;
    else x = (cw - targetW) / 2;
    if (pos[0] === 'T') y = marginY;
    else if (pos[0] === 'B') y = ch - marginY - targetH;
    else y = (ch - targetH) / 2;
    return { x, y, w: targetW, h: targetH };
}

// In solid (yellow) mode the logo stays its native brand red; in image modes
// it shifts to the active text color (white or yellow) so the wordmark stays
// legible against the user-supplied photo / video.
function activeLogoColor() {
    const m = modes[state.mode];
    return m.bgType === 'image' ? m.fg : LOGO_BRAND_COLOR;
}

function drawLogoForSpec(logoSpec) {
    if (!logoPath2Ds || !logoPath2Ds.length) return;
    const r = logoRectForSpec(logoSpec);
    const s = r.w / LOGO_NATIVE_WIDTH;
    const ctx = drawingContext;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.scale(s, s);
    ctx.fillStyle = activeLogoColor();
    for (const p of logoPath2Ds) ctx.fill(p);
    ctx.restore();
}

// ---- composer: text driven by spec ----
function textBaselinesForSpec(spec, W, H) {
    const textSpec = spec.text;
    const cw = W != null ? W : width;
    const ch = H != null ? H : height;
    const minDim = Math.min(cw, ch);
    const size1 = minDim * textSpec.size;
    const size2 = minDim * textSpec.size * 0.9;
    const gap = size1 * 0.6;
    const marginY = ch * (textSpec.marginY != null ? textSpec.marginY : 0.08);

    let y1, y2;
    if (textSpec.position === 'top') {
        y1 = marginY + size1;
        y2 = y1 + gap + size2;
    } else if (textSpec.position === 'middle') {
        const total = size1 + gap + size2;
        y1 = ch / 2 - total / 2 + size1;
        y2 = y1 + gap + size2;
    } else if (textSpec.position === 'below-logo') {
        const logoR = logoRectForSpec(spec.logo, cw, ch);
        const gapAfter = ch * (textSpec.gapAfterLogo != null ? textSpec.gapAfterLogo : 0.03);
        y1 = logoR.y + logoR.h + gapAfter + size1;
        y2 = y1 + gap + size2;
    } else {
        y2 = ch - marginY;
        y1 = y2 - gap - size2;
    }
    return { y1, y2, size1, size2 };
}

function drawTextForSpec(spec, fillColor) {
    const { y1, y2, size1, size2 } = textBaselinesForSpec(spec);
    push();
    fill(fillColor);
    noStroke();
    textFont('Acumin Condensed Medium');
    textAlign(CENTER, BASELINE);
    textStyle(NORMAL);
    if (state.textLine1) { textSize(size1); text(state.textLine1, width / 2, y1); }
    if (state.textLine2) { textSize(size2); text(state.textLine2, width / 2, y2); }
    pop();
}

// ============================================================================
// BLOB DRAW
// ============================================================================
function drawBlobTool() {
    const isTransparent = state.blobBg === 'transparent';
    if (isTransparent) {
        clear();                  // alpha canvas — page yellow shows through
    } else {
        background(BLOB_BG_YELLOW); // solid brand yellow
    }

    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const baseR = minDim * state.blobSize;

    const secs = (millis() - startTime) / 1000;
    const loopT = (secs * state.speed) % state.duration / state.duration;
    const phaseTau = loopT * TWO_PI;

    let scl = 1;
    let rot = 0;
    let noiseT = 0;
    if (state.motion === 'wobble' || state.motion === 'combo') noiseT = loopT;
    if (state.motion === 'rotate' || state.motion === 'combo') rot = phaseTau * 0.25;

    push();
    translate(cx, cy);

    // Blob rotates with the motion
    push();
    rotate(rot);
    scale(scl);
    fill(BLOB_FILL_COLOR);
    drawBlob(0, 0, baseR, state.wobble, state.noiseScale, state.segments, noiseT, state.seed);
    pop();

    // Star stays static (no rotation) regardless of motion type
    const insideR = baseR * STAR_INSIDE_RATIO;
    if (isTransparent) {
        drawingContext.save();
        drawingContext.globalCompositeOperation = 'destination-out';
        fill(255);
        drawStar(0, 0, insideR, insideR * STAR_INNER_RATIO, STAR_POINTS);
        drawingContext.restore();
    } else {
        fill(BLOB_BG_YELLOW);
        drawStar(0, 0, insideR, insideR * STAR_INNER_RATIO, STAR_POINTS);
    }
    pop();
}

// ============================================================================
// MEDIA UPLOAD (image OR video) — full-canvas cover background
// ============================================================================
function drawCoverMedia() {
    if (!uploadedMedia) return;
    const ctx = drawingContext;
    const isVid = uploadedMediaType === 'video';
    const mw = isVid ? uploadedMedia.videoWidth : uploadedMedia.naturalWidth;
    const mh = isVid ? uploadedMedia.videoHeight : uploadedMedia.naturalHeight;
    if (!mw || !mh) return;
    const canvasRatio = width / height;
    const mediaRatio = mw / mh;
    let sx, sy, sw, sh;
    if (mediaRatio > canvasRatio) {
        sh = mh; sw = sh * canvasRatio; sx = (mw - sw) / 2; sy = 0;
    } else {
        sw = mw; sh = sw / canvasRatio; sx = 0; sy = (mh - sh) / 2;
    }
    ctx.drawImage(uploadedMedia, sx, sy, sw, sh, 0, 0, width, height);
}

function wireMediaUpload() {
    const fileInput = document.getElementById('media-file');
    const dropZone = document.getElementById('media-drop');
    const canvasArea = document.getElementById('canvas-container');

    if (fileInput) {
        fileInput.addEventListener('change', e => {
            const file = e.target.files && e.target.files[0];
            if (file) handleMediaFile(file);
        });
    }
    const dragTargets = [dropZone, canvasArea].filter(Boolean);
    for (const el of dragTargets) {
        el.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.classList.remove('drag-over');
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleMediaFile(file);
        });
    }
}

function handleMediaFile(file) {
    if (!file || !file.type) {
        setStatus('Unsupported file.', true);
        return;
    }
    if (file.type.startsWith('image/')) handleImage(file);
    else if (file.type.startsWith('video/')) handleVideo(file);
    else setStatus('Pick an image or video file.', true);
}

function handleImage(file) {
    const reader = new FileReader();
    reader.onload = e => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
            cleanupMedia();
            uploadedMedia = img;
            uploadedMediaType = 'image';
            uploadedMediaDataUrl = dataUrl;
            onMediaLoaded(`Image · ${img.naturalWidth}×${img.naturalHeight}`);
        };
        img.onerror = () => setStatus('Could not decode that image.', true);
        img.src = dataUrl;
    };
    reader.onerror = () => setStatus('Could not read that file.', true);
    reader.readAsDataURL(file);
}

function handleVideo(file) {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.src = url;
    v.onloadedmetadata = () => {
        cleanupMedia();
        uploadedMedia = v;
        uploadedMediaType = 'video';
        uploadedMediaDataUrl = null;   // video can't inline in SVG; we snapshot at export time
        uploadedMediaUrl = url;
        v.play().catch(() => {});
        onMediaLoaded(`Video · ${v.videoWidth}×${v.videoHeight}`);
    };
    v.onerror = () => setStatus('Could not decode that video.', true);
}

function cleanupMedia() {
    if (uploadedMediaUrl) {
        URL.revokeObjectURL(uploadedMediaUrl);
        uploadedMediaUrl = null;
    }
    if (uploadedMedia && uploadedMediaType === 'video') {
        try { uploadedMedia.pause(); } catch (e) {}
    }
}

// Clear the currently uploaded image/video, reset the drop zone label, and
// revert the Asset Composer to Yellow · Red text so the composition stays
// legible (image modes use white/yellow text, which would be invisible on
// the solid yellow fallback bg).
function removeUploadedMedia() {
    if (!uploadedMedia) {
        setStatus('No image or video uploaded.', true);
        return;
    }
    cleanupMedia();
    uploadedMedia = null;
    uploadedMediaType = null;
    uploadedMediaDataUrl = null;
    const dz = document.getElementById('media-drop');
    if (dz) dz.classList.remove('loaded');
    const lbl = document.getElementById('media-drop-label');
    if (lbl) lbl.textContent = 'Drop image or video, or click to upload';
    const fileInput = document.getElementById('media-file');
    if (fileInput) fileInput.value = '';
    state.mode = 'yellow-red';
    syncModeTile('mode-tiles', state.mode);
    setStatus('Image/video removed — reverted to Yellow · Red text.');
}

function onMediaLoaded(label) {
    const dz = document.getElementById('media-drop');
    if (dz) dz.classList.add('loaded');
    const lbl = document.getElementById('media-drop-label');
    if (lbl) lbl.textContent = `Loaded · ${label}`;
    if (modes[state.mode].bgType !== 'image') {
        state.mode = 'image-white';
        syncModeTile('mode-tiles', state.mode);
    }
    setStatus('Loaded. Background mode set to Image · White text.');
}

function syncModeTile(hostId, currentValue) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.querySelectorAll('.mode-tile').forEach(t => {
        t.classList.toggle('active', t.dataset.name === currentValue);
    });
}

// ============================================================================
// GEOMETRY (blob, star — unchanged)
// ============================================================================
function blobPoints(baseR, wobble, noiseScale, segments, loopT, seed) {
    const pts = [];
    const seedOffset = seed * 0.137;
    const timeAngle = (loopT || 0) * Math.PI * 2;
    const timeRadius = 1.25;
    const tx = Math.cos(timeAngle) * timeRadius;
    const ty = Math.sin(timeAngle) * timeRadius;
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const nx = Math.cos(a) * noiseScale + seedOffset + 100 + tx;
        const ny = Math.sin(a) * noiseScale + seedOffset + 100 + ty;
        const n = noise(nx, ny);
        const r = baseR * (1 + wobble * (n - 0.5) * 2);
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return pts;
}

function drawBlob(cx, cy, baseR, wobble, noiseScale, segments, loopT, seed) {
    const pts = blobPoints(baseR, wobble, noiseScale, segments, loopT, seed);
    beginShape();
    curveVertex(cx + pts[segments - 1][0], cy + pts[segments - 1][1]);
    for (let i = 0; i < segments; i++) curveVertex(cx + pts[i][0], cy + pts[i][1]);
    curveVertex(cx + pts[0][0], cy + pts[0][1]);
    curveVertex(cx + pts[1][0], cy + pts[1][1]);
    endShape(CLOSE);
}

function drawStar(cx, cy, outer, inner, points) {
    const step = PI / points;
    beginShape();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -HALF_PI + i * step;
        vertex(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    endShape(CLOSE);
}

function blobPathCommands(baseR, wobble, noiseScale, segments, loopT, seed) {
    const pts = blobPoints(baseR, wobble, noiseScale, segments, loopT, seed);
    const n = pts.length;
    const tension = 0.5;
    let d = '';
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        if (i === 0) d += `M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} `;
        const c1x = p1[0] + (p2[0] - p0[0]) * tension / 3;
        const c1y = p1[1] + (p2[1] - p0[1]) * tension / 3;
        const c2x = p2[0] - (p3[0] - p1[0]) * tension / 3;
        const c2y = p2[1] - (p3[1] - p1[1]) * tension / 3;
        d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} `;
    }
    return d + 'Z';
}

function starPathCommands(outer, inner, points, rotationDeg) {
    const step = PI / points;
    const rot = (rotationDeg * PI) / 180;
    let d = '';
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -HALF_PI + i * step + rot;
        const x = r * Math.cos(a);
        const y = r * Math.sin(a);
        d += (i === 0 ? 'M ' : 'L ') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
    }
    return d + 'Z';
}

// ============================================================================
// CANVAS SIZING
// ============================================================================
function fitCanvasToContainer() {
    if (!canvasEl) return;
    const hw = container.clientWidth - 48 * 2;
    const hh = container.clientHeight - 48 * 2;
    const k = Math.min(hw / width, hh / height, 1);
    canvasEl.elt.style.width = width * k + 'px';
    canvasEl.elt.style.height = height * k + 'px';
}

function applyCanvasSize(w, h) {
    state.canvasWidth = w;
    state.canvasHeight = h;
    resizeCanvas(w, h);
    pixelDensity(2);
    fitCanvasToContainer();
}

// ============================================================================
// TOOL SWITCH + UI VISIBILITY
// ============================================================================
function applyToolVisibility() {
    document.body.classList.toggle('tool-composer', state.tool === 'composer');
    document.body.classList.toggle('tool-blob', state.tool === 'blob');
    // Highlight the active segment
    document.querySelectorAll('.tool-switch .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === state.tool);
    });
}

// ============================================================================
// TILES
// ============================================================================
function buildLayoutTiles() {
    const host = document.getElementById('layout-tiles');
    if (!host) return;
    host.innerHTML = '';
    Object.entries(layoutSpecs).forEach(([name, spec]) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'layout-tile' + (name === state.assetPreset ? ' active' : '');
        tile.dataset.name = name;
        tile.innerHTML = `
            <span class="thumb">${layoutThumbSVG(spec)}</span>
            <span class="label">
                <span class="label-title">${spec.label}</span>
                <span class="label-sub">${spec.description}</span>
            </span>
        `;
        tile.addEventListener('click', () => {
            state.assetPreset = name;
            // Reset tier overrides to this preset's declared defaults so each
            // preset comes up exactly as designed; user can still adjust after.
            state.logoTier = spec.logo.tier;
            if (spec.stars.tier) state.starTier = spec.stars.tier;
            if (spec.text.tier) state.textTier = spec.text.tier;
            host.querySelectorAll('.layout-tile').forEach(t => t.classList.toggle('active', t.dataset.name === name));
            applyPresetVisibility(spec);
            syncSizeSegments();
        });
        host.appendChild(tile);
    });
    // Initial visibility
    applyPresetVisibility(layoutSpecs[state.assetPreset]);
    syncSizeSegments();
}

// Hide the parts of the Sizes panel and the Text inputs that don't apply
// to the active preset (Mark presets have no stars, no text — the rows for
// those elements get hidden so the controls match what's actually rendered).
function applyPresetVisibility(spec) {
    const tg = document.getElementById('text-group');
    if (tg) tg.style.display = spec.text.show ? '' : 'none';
    const starsRow = document.querySelector('.size-row[data-row="stars"]');
    if (starsRow) starsRow.style.display = (spec.stars.layout && spec.stars.layout !== 'none') ? '' : 'none';
    const textRow = document.querySelector('.size-row[data-row="text"]');
    if (textRow) textRow.style.display = spec.text.show ? '' : 'none';
}

// Push current state tiers into the Sizes panel's segmented controls.
function syncSizeSegments() {
    const map = { logoTier: 'logo', starTier: 'star', textTier: 'text' };
    Object.entries(map).forEach(([stateKey, dataRow]) => {
        const seg = document.querySelector(`.size-seg[data-target="${stateKey}"]`);
        if (!seg) return;
        seg.querySelectorAll('.seg-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.size === state[stateKey]);
        });
    });
}

// Compact SVG thumbnail of a preset for the tile — uses the same spec math
// as the canvas draw so thumbnails stay accurate automatically. Uses the
// preset's own default tiers (not the user's overrides) so the tile keeps
// representing the canonical layout.
function layoutThumbSVG(rawSpec) {
    const spec = resolveSpec(rawSpec);
    const W = 60, H = 75; // 4:5 portrait mini
    const parts = [];
    parts.push(`<rect width="${W}" height="${H}" fill="#FFF8D6" stroke="rgba(237,32,36,0.4)" stroke-width="1"/>`);

    // Logo (honors per-preset margin overrides)
    const logoSpec = spec.logo;
    const logoW = W * logoSpec.size;
    const logoH = logoW * (LOGO_NATIVE_HEIGHT / LOGO_NATIVE_WIDTH);
    const marginX = W * (logoSpec.marginX != null ? logoSpec.marginX : 0.05);
    const marginY = H * (logoSpec.marginY != null ? logoSpec.marginY : 0.05);
    const pos = logoSpec.position;
    let lx, ly;
    if (pos[1] === 'L') lx = marginX;
    else if (pos[1] === 'R') lx = W - marginX - logoW;
    else lx = (W - logoW) / 2;
    if (pos[0] === 'T') ly = marginY;
    else if (pos[0] === 'B') ly = H - marginY - logoH;
    else ly = (H - logoH) / 2;
    parts.push(`<rect x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${logoW.toFixed(1)}" height="${logoH.toFixed(1)}" fill="#ED2024"/>`);

    // Stars
    if (spec.stars.layout && spec.stars.layout !== 'none') {
        const r = Math.min(W, H) * spec.stars.size;
        const pad = (spec.stars.padding != null ? spec.stars.padding : 0.05) * Math.min(W, H);
        const xs = computeRowXs(W, r, spec.stars.count, spec.stars.spacing);
        const layout = spec.stars.layout;
        const ys = [];
        if (layout === 'row-center') ys.push(H / 2);
        if (layout === 'row-top') ys.push(pad + r);
        if (layout === 'row-bottom') ys.push(H - pad - r);
        if (layout === 'row-both') { ys.push(pad + r); ys.push(H - pad - r); }
        for (const y of ys) for (const x of xs) {
            parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#ED2024"/>`);
        }
    }

    // Text block — two thin red bars positioned via the same math as the canvas
    if (spec.text.show) {
        const { y1, y2 } = textBaselinesForSpec(spec, W, H);
        const barH1 = Math.max(1.2, Math.min(W, H) * spec.text.size * 0.7);
        const barH2 = barH1 * 0.9;
        const barW = W * 0.55;
        const bx = (W - barW) / 2;
        parts.push(`<rect x="${bx.toFixed(1)}" y="${(y1 - barH1).toFixed(1)}" width="${barW.toFixed(1)}" height="${barH1.toFixed(1)}" fill="#ED2024"/>`);
        parts.push(`<rect x="${(bx + barW * 0.1).toFixed(1)}" y="${(y2 - barH2).toFixed(1)}" width="${(barW * 0.8).toFixed(1)}" height="${barH2.toFixed(1)}" fill="#ED2024"/>`);
    }

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

function buildModeTiles(hostId, stateKey) {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';
    Object.entries(modes).forEach(([name, m]) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'mode-tile' + (name === state[stateKey] ? ' active' : '');
        tile.dataset.name = name;

        let previewHTML;
        if (m.bgType === 'solid') {
            previewHTML = `<span class="preview solid" style="background:${m.bg};color:${m.fg}">Aa</span>`;
        } else {
            previewHTML = `<span class="preview image"><span class="dot" style="background:${m.fg}"></span></span>`;
        }
        tile.innerHTML = `${previewHTML}<span class="tile-label">${m.label}</span>`;
        tile.addEventListener('click', () => {
            state[stateKey] = name;
            host.querySelectorAll('.mode-tile').forEach(t => t.classList.toggle('active', t.dataset.name === name));
        });
        host.appendChild(tile);
    });
}

// ============================================================================
// CONTROLS WIRING
// ============================================================================
function wireControls() {
    const bind = (id, key, parse = parseFloat, fmt = v => (+v).toFixed(2)) => {
        const el = document.getElementById(id);
        const val = document.querySelector(`[data-val="${id}"]`);
        if (!el) return;
        el.addEventListener('input', () => {
            state[key] = parse(el.value);
            if (val) val.textContent = fmt(el.value);
        });
        if (val) val.textContent = fmt(el.value);
    };

    // Tool switch
    document.querySelectorAll('.tool-switch .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.tool = btn.dataset.tool;
            applyToolVisibility();
        });
    });

    // Blob background toggle (transparent / yellow)
    const blobBgSeg = document.getElementById('blob-bg-seg');
    if (blobBgSeg) {
        blobBgSeg.querySelectorAll('.seg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.blobBg = btn.dataset.bg;
                blobBgSeg.querySelectorAll('.seg-btn').forEach(b => {
                    b.classList.toggle('active', b === btn);
                });
            });
        });
    }

    // Composer text
    const t1 = document.getElementById('text-line1');
    const t2 = document.getElementById('text-line2');
    if (t1) t1.addEventListener('input', e => { state.textLine1 = e.target.value; });
    if (t2) t2.addEventListener('input', e => { state.textLine2 = e.target.value; });

    // Media upload
    wireMediaUpload();

    // Remove media button
    const removeBtn = document.getElementById('media-remove');
    if (removeBtn) removeBtn.addEventListener('click', removeUploadedMedia);

    // Size tier segmented controls
    document.querySelectorAll('.size-seg').forEach(seg => {
        const target = seg.dataset.target;
        seg.querySelectorAll('.seg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state[target] = btn.dataset.size;
                seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
            });
        });
    });

    // Blob params
    bind('blob-size', 'blobSize');
    bind('blob-wobble', 'wobble');
    bind('blob-noise-scale', 'noiseScale');
    bind('blob-segments', 'segments', parseInt, v => parseInt(v, 10));
    bind('blob-seed', 'seed', parseInt, v => parseInt(v, 10));
    const seedEl = document.getElementById('blob-seed');
    if (seedEl) seedEl.addEventListener('input', e => noiseSeed(parseInt(e.target.value, 10)));

    // Motion
    const motionType = document.getElementById('motion-type');
    if (motionType) motionType.addEventListener('change', e => { state.motion = e.target.value; });
    bind('motion-speed', 'speed');
    bind('motion-duration', 'duration', parseFloat, v => (+v).toFixed(1));

    // Canvas size
    const cp = document.getElementById('canvas-preset');
    const wInput = document.getElementById('canvas-w');
    const hInput = document.getElementById('canvas-h');
    if (cp) cp.addEventListener('change', () => {
        if (cp.value === 'custom') return;
        const [w, h] = cp.value.split('x').map(n => parseInt(n, 10));
        wInput.value = w; hInput.value = h;
        applyCanvasSize(w, h);
    });
    const updateCustom = () => {
        cp.value = 'custom';
        applyCanvasSize(parseInt(wInput.value, 10), parseInt(hInput.value, 10));
    };
    if (wInput) wInput.addEventListener('change', updateCustom);
    if (hInput) hInput.addEventListener('change', updateCustom);

    // Export
    document.getElementById('export-png').addEventListener('click', exportPNG);
    document.getElementById('export-svg').addEventListener('click', exportSVG);
    const webmBtn = document.getElementById('export-webm');
    const mp4Btn = document.getElementById('export-mp4');
    if (webmBtn) webmBtn.addEventListener('click', () => {
        if (window._matosRecording) window.stopMatosRecording();
        else window.startMatosRecording('webm');
    });
    if (mp4Btn) mp4Btn.addEventListener('click', () => {
        if (window._matosRecording) window.stopMatosRecording();
        else window.startMatosRecording('mp4');
    });
    const lottieBtn = document.getElementById('export-lottie');
    if (lottieBtn) lottieBtn.addEventListener('click', exportLottie);
    const gifBtn = document.getElementById('export-gif');
    if (gifBtn) gifBtn.addEventListener('click', exportGIF);

    window.addEventListener('resize', fitCanvasToContainer);
}

// ============================================================================
// EXPORT — branches by tool
// ============================================================================
function exportPNG() {
    if (state.tool === 'blob') exportBlobPNGStatic();
    else exportComposerPNG();
}

function exportSVG() {
    if (state.tool === 'blob') exportBlobSVGStatic();
    else exportComposerSVG();
}

function exportComposerPNG() {
    setStatus('Rendering PNG…');
    saveCanvas(canvasEl, `matos_${state.assetPreset}_${timestamp()}`, 'png');
    setStatus('PNG saved.');
}

// ---------- Composer SVG ----------
function exportComposerSVG() {
    setStatus('Rendering SVG…');
    const m = modes[state.mode];
    const W = state.canvasWidth;
    const H = state.canvasHeight;
    const minDim = Math.min(W, H);

    const rawSpec = layoutSpecs[state.assetPreset];
    const spec = resolveSpec(rawSpec, {
        logoTier: state.logoTier,
        starTier: state.starTier,
        textTier: state.textTier,
    });
    const parts = [];

    // Stars
    if (spec.stars.layout && spec.stars.layout !== 'none') {
        parts.push(svgStarsForSpec(W, H, minDim, spec.stars, m.fg));
    }
    // Logo
    parts.push(svgLogoForSpec(W, H, spec.logo));
    // Text
    if (spec.text.show) {
        parts.push(svgTextForSpec(W, H, spec, m.fg));
    }

    // Background: image (cover) for image modes, solid otherwise.
    let bgLayer;
    if (m.bgType === 'image' && uploadedMedia) {
        const dataUrl = mediaSnapshotDataUrl();
        bgLayer = `<image href="${dataUrl}" xlink:href="${dataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
        bgLayer = `<rect width="100%" height="100%" fill="${m.bg}"/>`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bgLayer}
  ${parts.join('\n  ')}
</svg>`;
    saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `matos_${state.assetPreset}_${timestamp()}.svg`);
    setStatus('SVG saved.');
}

function svgStarsForSpec(W, H, minDim, starsSpec, fillColor) {
    const r = minDim * starsSpec.size;
    const inner = r * STAR_INNER_RATIO;
    const xs = computeRowXs(W, r, starsSpec.count, starsSpec.spacing);
    const ys = computeRowYs(H, minDim, r, starsSpec.padding != null ? starsSpec.padding : 0.05, starsSpec.layout);
    const d = starPathCommands(r, inner, STAR_POINTS, 0);
    const items = [];
    for (const y of ys) for (const x of xs) {
        items.push(`<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><path d="${d}" fill="${fillColor}"/></g>`);
    }
    return items.join('\n  ');
}

function svgLogoForSpec(W, H, logoSpec) {
    const r = logoRectForSpec(logoSpec, W, H);
    const s = r.w / LOGO_NATIVE_WIDTH;
    const color = activeLogoColor();
    const paths = Array.from(document.querySelectorAll('#brand-logo path'))
        .map(p => `<path d="${p.getAttribute('d')}" fill="${color}"/>`)
        .join('\n    ');
    return `<g transform="translate(${r.x.toFixed(2)} ${r.y.toFixed(2)}) scale(${s.toFixed(5)})">
    ${paths}
  </g>`;
}

function svgTextForSpec(W, H, spec, fillColor) {
    const { y1, y2, size1, size2 } = textBaselinesForSpec(spec, W, H);
    const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fontFamily = "'Acumin Condensed Medium', 'Arial Narrow', sans-serif";
    const parts = [];
    if (state.textLine1) {
        parts.push(`<text x="${W / 2}" y="${y1.toFixed(2)}" fill="${fillColor}" text-anchor="middle" font-family="${fontFamily}" font-size="${size1.toFixed(2)}" font-weight="500" font-stretch="75%">${escape(state.textLine1)}</text>`);
    }
    if (state.textLine2) {
        parts.push(`<text x="${W / 2}" y="${y2.toFixed(2)}" fill="${fillColor}" text-anchor="middle" font-family="${fontFamily}" font-size="${size2.toFixed(2)}" font-weight="500" font-stretch="75%">${escape(state.textLine2)}</text>`);
    }
    return parts.join('\n  ');
}

// Snapshot the current uploaded media frame as a base64 data URL for SVG embed.
// For images, prefer the original data URL (no quality loss). For videos, draw
// the current frame to an offscreen canvas and export as PNG.
function mediaSnapshotDataUrl() {
    if (uploadedMediaType === 'image' && uploadedMediaDataUrl) {
        return uploadedMediaDataUrl;
    }
    if (uploadedMediaType === 'video' && uploadedMedia) {
        const off = document.createElement('canvas');
        off.width = uploadedMedia.videoWidth || 1920;
        off.height = uploadedMedia.videoHeight || 1080;
        const ctx = off.getContext('2d');
        try {
            ctx.drawImage(uploadedMedia, 0, 0, off.width, off.height);
            return off.toDataURL('image/png');
        } catch (e) {
            return '';
        }
    }
    return '';
}

// ---------- Blob: PNG static (transparent + cutout star) ----------
function exportBlobPNGStatic() {
    setStatus('Rendering transparent PNG…');
    const dpr = 2;
    const W = state.canvasWidth;
    const H = state.canvasHeight;
    const off = document.createElement('canvas');
    off.width = W * dpr;
    off.height = H * dpr;
    const ctx = off.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = W / 2, cy = H / 2;
    const minDim = Math.min(W, H);
    const baseR = minDim * state.blobSize;

    const secs = (millis() - startTime) / 1000;
    const loopT = (secs * state.speed) % state.duration / state.duration;
    const noiseT = (state.motion === 'wobble' || state.motion === 'combo') ? loopT : 0;

    const blobD = blobPathCommands(baseR, state.wobble, state.noiseScale, state.segments, noiseT, state.seed);
    const insideR = baseR * STAR_INSIDE_RATIO;
    const starD = starPathCommands(insideR, insideR * STAR_INNER_RATIO, STAR_POINTS, 0);

    const isTransparent = state.blobBg === 'transparent';
    if (!isTransparent) {
        ctx.fillStyle = BLOB_BG_YELLOW;
        ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = BLOB_FILL_COLOR;
    ctx.fill(new Path2D(blobD));
    if (isTransparent) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fill(new Path2D(starD));
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.fillStyle = BLOB_BG_YELLOW;
        ctx.fill(new Path2D(starD));
    }
    ctx.restore();

    off.toBlob(blob => {
        if (!blob) return setStatus('PNG export failed.', true);
        saveBlob(blob, `matos-tomato_${timestamp()}.png`);
        setStatus(`PNG saved (${isTransparent ? 'transparent bg' : 'yellow bg'}).`);
    }, 'image/png');
}

// ---------- Blob: SVG static (transparent + evenodd cutout) ----------
function exportBlobSVGStatic() {
    setStatus('Rendering transparent SVG…');
    const W = state.canvasWidth;
    const H = state.canvasHeight;
    const cx = W / 2, cy = H / 2;
    const minDim = Math.min(W, H);
    const baseR = minDim * state.blobSize;

    const secs = (millis() - startTime) / 1000;
    const loopT = (secs * state.speed) % state.duration / state.duration;
    const noiseT = (state.motion === 'wobble' || state.motion === 'combo') ? loopT : 0;

    const blobD = blobPathCommands(baseR, state.wobble, state.noiseScale, state.segments, noiseT, state.seed);
    const insideR = baseR * STAR_INSIDE_RATIO;
    const starD = starPathCommands(insideR, insideR * STAR_INNER_RATIO, STAR_POINTS, 0);

    const isTransparent = state.blobBg === 'transparent';
    let body;
    if (isTransparent) {
        // Single path, evenodd → blob with star punched out (true hole)
        const combined = `${blobD} ${starD}`;
        body = `<g transform="translate(${cx} ${cy})">
    <path d="${combined}" fill="${BLOB_FILL_COLOR}" fill-rule="evenodd"/>
  </g>`;
    } else {
        // Yellow rect bg + red blob + yellow star (visual cutout)
        body = `<rect width="100%" height="100%" fill="${BLOB_BG_YELLOW}"/>
  <g transform="translate(${cx} ${cy})">
    <path d="${blobD}" fill="${BLOB_FILL_COLOR}"/>
    <path d="${starD}" fill="${BLOB_BG_YELLOW}"/>
  </g>`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${body}
</svg>`;
    saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `matos-tomato_${timestamp()}.svg`);
    setStatus(`SVG saved (${isTransparent ? 'transparent bg' : 'yellow bg'}).`);
}

// ============================================================================
// EXPORT: GIF (animated — uses gif.js + web worker)
// ============================================================================
//
// Blob tool: renders one full loop of the animation, frame-by-frame, into
// gif.js. Transparency is preserved (1-bit alpha) so the star cutout reads
// against any background it's placed on.
//
// Composer tool: renders a single frame (the current canvas), unless the
// background is a video, in which case we sample frames over `state.duration`
// to capture the video motion.
function exportGIF() {
    if (typeof window.GIF !== 'function') {
        console.error('[GIF] window.GIF is undefined — gif.js failed to load.');
        setStatus('GIF library not loaded. Reload the page.', true);
        return;
    }
    try {
        if (state.tool === 'blob') exportBlobGIF();
        else exportComposerGIF();
    } catch (err) {
        console.error('[GIF] Export threw:', err);
        setStatus(`GIF export failed: ${err.message || err}`, true);
    }
}

function makeGIF(W, H, transparent) {
    const gif = new window.GIF({
        workers: 2,
        quality: 10,
        width: W,
        height: H,
        // Magenta sentinel so gif.js maps those pixels to the transparent index.
        transparent: transparent ? 0xff00ff : null,
        // Local worker avoids CDN / CORS issues that previously caused silent
        // init failures. Served from the same origin as the page.
        workerScript: 'assets/gif.worker.js',
    });
    // Surface any failure paths — by default gif.js emits 'abort' without a
    // visible error.
    gif.on('abort', () => {
        console.error('[GIF] Render aborted');
        setStatus('GIF render aborted.', true);
    });
    return gif;
}

function exportBlobGIF() {
    const fps = 24;
    const W = state.canvasWidth;
    const H = state.canvasHeight;
    const frameCount = Math.max(1, Math.round(state.duration * fps));
    const cx = W / 2, cy = H / 2;
    const minDim = Math.min(W, H);
    const baseR = minDim * state.blobSize;
    const isTransparent = state.blobBg === 'transparent';

    // Transparent GIFs use a magenta sentinel that gif.js maps to the
    // transparent index. Yellow GIFs are fully opaque.
    const gif = makeGIF(W, H, isTransparent);
    setStatus(`Rendering GIF · ${frameCount} frames…`);

    for (let f = 0; f < frameCount; f++) {
        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        const ctx = off.getContext('2d');

        ctx.fillStyle = isTransparent ? '#ff00ff' : BLOB_BG_YELLOW;
        ctx.fillRect(0, 0, W, H);

        const loopT = f / frameCount;
        const noiseT = (state.motion === 'wobble' || state.motion === 'combo') ? loopT : 0;
        const phase = loopT * 2 * Math.PI;
        let scl = 1, rot = 0;
        if (state.motion === 'rotate' || state.motion === 'combo') rot = phase * 0.25;

        const blobD = blobPathCommands(baseR, state.wobble, state.noiseScale, state.segments, noiseT, state.seed);
        const insideR = baseR * STAR_INSIDE_RATIO;
        const starD = starPathCommands(insideR, insideR * STAR_INNER_RATIO, STAR_POINTS, 0);

        // Center origin for both blob and star
        ctx.save();
        ctx.translate(cx, cy);

        // Blob: rotated + scaled with the motion
        ctx.save();
        ctx.rotate(rot);
        ctx.scale(scl, scl);
        ctx.fillStyle = BLOB_FILL_COLOR;
        ctx.fill(new Path2D(blobD));
        ctx.restore();

        // Star: static (no rotation) so it stays anchored upright
        if (isTransparent) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fill(new Path2D(starD));
            ctx.globalCompositeOperation = 'source-over';
        } else {
            ctx.fillStyle = BLOB_BG_YELLOW;
            ctx.fill(new Path2D(starD));
        }
        ctx.restore();

        gif.addFrame(off, { delay: Math.round(1000 / fps), copy: true });
    }

    gif.on('progress', p => setStatus(`Encoding GIF · ${Math.round(p * 100)}%`));
    gif.on('finished', blob => {
        saveBlob(blob, `matos-tomato_${timestamp()}.gif`);
        setStatus(`GIF saved · ${(blob.size / 1024 / 1024).toFixed(1)} MB (${isTransparent ? 'transparent' : 'yellow bg'}).`);
    });
    gif.render();
}

function exportComposerGIF() {
    const W = state.canvasWidth;
    const H = state.canvasHeight;
    const isVideo = uploadedMediaType === 'video' && uploadedMedia;

    // Static composer asset → 1-frame GIF (still useful for drop-in to chats etc.)
    if (!isVideo) {
        const gif = makeGIF(W, H, false);
        gif.addFrame(canvasEl.elt, { delay: 1000, copy: true });
        gif.on('progress', p => setStatus(`Encoding GIF · ${Math.round(p * 100)}%`));
        gif.on('finished', blob => {
            saveBlob(blob, `matos_${state.assetPreset}_${timestamp()}.gif`);
            setStatus(`GIF saved · ${(blob.size / 1024 / 1024).toFixed(1)} MB.`);
        });
        gif.render();
        return;
    }

    // Video bg → sample at fps for `state.duration` seconds and emit one
    // frame per sample. Renders the live canvas (with the video playing)
    // into the GIF.
    const fps = 18; // GIF gets chunky fast; keep it low
    const frameCount = Math.max(1, Math.round(state.duration * fps));
    const gif = makeGIF(W, H, false);
    setStatus(`Sampling ${frameCount} frames from video bg…`);

    let i = 0;
    const tick = () => {
        if (i >= frameCount) {
            gif.on('progress', p => setStatus(`Encoding GIF · ${Math.round(p * 100)}%`));
            gif.on('finished', blob => {
                saveBlob(blob, `matos_${state.assetPreset}_${timestamp()}.gif`);
                setStatus(`GIF saved · ${(blob.size / 1024 / 1024).toFixed(1)} MB.`);
            });
            gif.render();
            return;
        }
        // Snapshot the live canvas at this moment
        const off = document.createElement('canvas');
        off.width = W;
        off.height = H;
        off.getContext('2d').drawImage(canvasEl.elt, 0, 0, W, H);
        gif.addFrame(off, { delay: Math.round(1000 / fps), copy: true });
        i++;
        setTimeout(tick, 1000 / fps);
    };
    tick();
}

// ============================================================================
// EXPORT: Lottie (Blob only — animated)
// ============================================================================
function exportLottie() {
    if (state.tool !== 'blob') {
        setStatus('Lottie export is for the Blob tool.', true);
        return;
    }
    setStatus('Building Lottie…');
    const fps = 30;
    const frameCount = Math.max(2, Math.round(state.duration * fps));
    const W = state.canvasWidth;
    const H = state.canvasHeight;
    const cx = W / 2;
    const cy = H / 2;
    const minDim = Math.min(W, H);
    const baseR = minDim * state.blobSize;
    const segments = state.segments;

    const pathKeyframes = [];
    for (let f = 0; f < frameCount; f++) {
        const loopT = f / frameCount;
        const noiseT = (state.motion === 'wobble' || state.motion === 'combo') ? loopT : 0;
        const pts = blobPoints(baseR, state.wobble, state.noiseScale, segments, noiseT, state.seed);
        const tension = 0.5;
        const vertices = [], inT = [], outT = [];
        for (let i = 0; i < segments; i++) {
            const p0 = pts[(i - 1 + segments) % segments];
            const p1 = pts[i];
            const p2 = pts[(i + 1) % segments];
            vertices.push([p1[0], p1[1]]);
            outT.push([(p2[0] - p0[0]) * tension / 3, (p2[1] - p0[1]) * tension / 3]);
            inT.push([-((p2[0] - p0[0]) * tension / 3), -((p2[1] - p0[1]) * tension / 3)]);
        }
        pathKeyframes.push({ t: f, s: [{ i: inT, o: outT, v: vertices, c: true }], h: 0 });
    }
    pathKeyframes.push({ t: frameCount, s: [pathKeyframes[0].s[0]] });

    const scaleKeyframes = [];
    const rotKeyframes = [];
    // Pulse is no longer a motion option; combo now means wobble + rotate.
    const useScale = false;
    const useRot = state.motion === 'rotate' || state.motion === 'combo';
    if (useScale || useRot) {
        for (let f = 0; f <= frameCount; f++) {
            const loopT = f / frameCount;
            const phase = loopT * 2 * Math.PI;
            if (useScale) {
                const s = 1 + 0.06 * Math.sin(phase);
                scaleKeyframes.push({ t: f, s: [s * 100, s * 100, 100] });
            }
            if (useRot) rotKeyframes.push({ t: f, s: [phase * 0.25 * (180 / Math.PI)] });
        }
    }

    // Inside 8-corner star vertices (static — only the blob path animates)
    const starR = baseR * STAR_INSIDE_RATIO;
    const starVerts = [];
    const step = Math.PI / STAR_POINTS;
    for (let i = 0; i < STAR_POINTS * 2; i++) {
        const r = i % 2 === 0 ? starR : starR * STAR_INNER_RATIO;
        const a = -Math.PI / 2 + i * step;
        starVerts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const zeroT = starVerts.map(() => [0, 0]);

    const isTransparent = state.blobBg === 'transparent';
    const layers = [];

    // Helper layer factories — keeps the per-mode branches readable.
    const staticTransform = (parent) => ({
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [cx, cy, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }
    });
    const rotatingTransform = () => ({
        o: { a: 0, k: 100 },
        r: useRot ? { a: 1, k: rotKeyframes } : { a: 0, k: 0 },
        p: { a: 0, k: [cx, cy, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: useScale ? { a: 1, k: scaleKeyframes } : { a: 0, k: [100, 100, 100] },
    });
    const blobShapeGroup = {
        ty: 'gr', nm: 'BlobGroup',
        it: [
            { ty: 'sh', nm: 'BlobPath', ks: { a: 1, k: pathKeyframes } },
            { ty: 'fl', nm: 'BlobFill', c: { a: 0, k: hexToRgbaArr(BLOB_FILL_COLOR) }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
        ]
    };
    const starShapeGroup = (fillColor) => ({
        ty: 'gr', nm: 'StarGroup',
        it: [
            { ty: 'sh', nm: 'StarPath', ks: { a: 0, k: { i: zeroT, o: zeroT, v: starVerts, c: true } } },
            { ty: 'fl', nm: 'StarFill', c: { a: 0, k: hexToRgbaArr(fillColor) }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }
        ]
    });

    if (isTransparent) {
        // Track matte: an opaque static star above (td=1, hidden) provides
        // an alpha shape that the blob layer below uses INVERTED (tt=2) — so
        // wherever the star is opaque, the blob is erased. Star never rotates.
        layers.push({
            ddd: 0, ind: 0, ty: 4, nm: 'StarMatte', sr: 1, td: 1,
            ks: staticTransform(),
            shapes: [starShapeGroup('#000000')],
            ip: 0, op: frameCount, st: 0, bm: 0
        });
        layers.push({
            ddd: 0, ind: 1, ty: 4, nm: 'Blob', sr: 1, tt: 2,
            ks: rotatingTransform(),
            shapes: [blobShapeGroup],
            ip: 0, op: frameCount, st: 0, bm: 0
        });
    } else {
        // 3 layers: static yellow star (top), rotating red blob (middle),
        // solid yellow bg (bottom). Star covers the blob in its shape, so it
        // reads as a yellow cutout — and stays anchored upright.
        layers.push({
            ddd: 0, ind: 0, ty: 4, nm: 'Star', sr: 1,
            ks: staticTransform(),
            shapes: [starShapeGroup(BLOB_BG_YELLOW)],
            ip: 0, op: frameCount, st: 0, bm: 0
        });
        layers.push({
            ddd: 0, ind: 1, ty: 4, nm: 'Blob', sr: 1,
            ks: rotatingTransform(),
            shapes: [blobShapeGroup],
            ip: 0, op: frameCount, st: 0, bm: 0
        });
        layers.push({
            ddd: 0, ind: 99, ty: 1, nm: 'BG', sr: 1,
            sc: BLOB_BG_YELLOW, sw: W, sh: H,
            ks: {
                o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
                p: { a: 0, k: [W / 2, H / 2, 0] }, a: { a: 0, k: [W / 2, H / 2, 0] },
                s: { a: 0, k: [100, 100, 100] }
            },
            ip: 0, op: frameCount, st: 0, bm: 0
        });
    }

    const lottie = {
        v: '5.7.14', fr: fps, ip: 0, op: frameCount,
        w: W, h: H, nm: 'Matos Tomato', ddd: 0, assets: [], layers
    };
    saveBlob(new Blob([JSON.stringify(lottie)], { type: 'application/json' }), `matos-tomato_${timestamp()}.json`);
    setStatus(`Lottie saved (${frameCount} frames @ ${fps}fps).`);
}

// ============================================================================
// HELPERS
// ============================================================================
function hexToRgbaArr(hex) {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16) / 255;
    const g = parseInt(m.substring(2, 4), 16) / 255;
    const b = parseInt(m.substring(4, 6), 16) / 255;
    return [r, g, b, 1];
}

function saveBlob(blob, filename) {
    if (window.saveAs) { window.saveAs(blob, filename); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function setStatus(msg, isErr = false) {
    const el = document.getElementById('export-status');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', isErr);
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => { el.textContent = ''; el.classList.remove('err'); }, 4000);
}

// Expose for the recording module (recordCanvas.js)
window.matosState = state;
window.matosModes = modes;
window.matosSetStatus = setStatus;
window.matosSaveBlob = saveBlob;
window.matosTimestamp = timestamp;
