/* Lou's Fancy Foods — New design (templates) + Library.
   Runs after simple.js and uses its design state (S, photo, frame, sync …).

   New design: the templates are starting points for the editor. Each one sets the layout,
   colours, text boxes and logo; templates that use a photo keep the photo you already have.

   Library: every design is saved automatically (a moment after each change) in this browser's
   IndexedDB, with its photo and a thumbnail, so it can be reopened, duplicated or deleted.
   It lives on this computer only — nothing is uploaded. */

const STARTERS = [
  { key: "photo", title: "Photo post", sub: "Your photo, a line of text and the logo", photo: true,
    set: { layout: "full", bg: "esp", logo: "combination", logoSize: "M", logoPos: "bottom", logoColor: "cream",
           texts: [{ text: "Fresh out of\nthe kitchen", size: "M", y: 0.12, color: "cream" }] } },
  { key: "announce", title: "Announcement", sub: "One big headline and the logo", photo: false,
    set: { layout: "full", bg: "esp", logo: "combination", logoSize: "M", logoPos: "bottom", logoColor: "cream",
           texts: [{ text: "Chicken\nand rice,\nmade this\nmorning.", size: "XL", y: 0.16, color: "cream" }] } },
  { key: "product", title: "Product", sub: "Photo on top, the name underneath", photo: true,
    set: { layout: "split", bg: "cream", logo: "combination", logoSize: "S", logoPos: "bottom", logoColor: "esp",
           texts: [{ text: "Chicken\nand rice", size: "XL", y: 0.6, color: "esp" }] } },
  { key: "story", title: "Story", sub: "Photo on top, words underneath", photo: true,
    set: { size: "story", layout: "split", bg: "olive", logo: "lous", logoSize: "S", logoPos: "bottom", logoColor: "cream",
           texts: [{ text: "Fresh out of\nthe kitchen.", size: "L", y: 0.63, color: "cream" }] } },
  { key: "logo", title: "Logo", sub: "On a colour or on your photo · draws itself on in video", photo: true,
    set: { layout: "full", bg: "esp", logo: "combination", logoSize: "L", logoPos: "middle", logoColor: "cream", texts: [] } },
  { key: "seal", title: "Brand line", sub: "The LFF monogram and a short line", photo: false,
    set: { layout: "full", bg: "cream", logo: "lff", logoSize: "M", logoPos: "middle", logoColor: "esp",
           texts: [{ text: "Every day is all there is", size: "XS", y: 0.64, color: "esp" }] } },
];

const LIB = (() => {
  const ID_KEY = STORE + "-id";
  let db = null, timer = null, lastPhoto = {};   // lastPhoto[id] = the photo already written for that design
  let id = null; try { id = localStorage.getItem(ID_KEY); } catch (e) {}
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const setId = v => { id = v; try { v ? localStorage.setItem(ID_KEY, v) : localStorage.removeItem(ID_KEY); } catch (e) {} };

  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const r = indexedDB.open("lff-library", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("designs", { keyPath: "id" }); r.result.createObjectStore("photos"); };
      r.onsuccess = () => res(db = r.result); r.onerror = () => rej(r.error);
    });
  }
  function run(stores, mode, fn) {
    return open().then(d => new Promise((res, rej) => {
      const t = d.transaction(stores, mode); let out;
      const req = fn(t);
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
  }
  const all = () => run(["designs"], "readonly", t => t.objectStore("designs").getAll());
  const getPhoto = k => run(["photos"], "readonly", t => t.objectStore("photos").get(k));

  // a picture of the design (or any state) — used for the Library cards and the template cards
  function snapshot(state, pic, w) {
    const keep = { S, photo, photoFx, BOX };
    S = state; if (pic !== undefined) { photo = pic ? keep.photo : null; photoFx = pic ? keep.photoFx : null; }
    const [W, H] = SIZES[S.size], c = document.createElement("canvas"), k = w / W;
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    try { frame(c, k, null); return c.toDataURL("image/jpeg", 0.82); }
    finally { S = keep.S; photo = keep.photo; photoFx = keep.photoFx; BOX = keep.BOX; }
  }
  const nameOf = st => { const t = (st.texts || []).map(x => x.text.split("\n").join(" ").trim()).find(Boolean);
    return t ? (t.length > 32 ? t.slice(0, 31) + "…" : t) : st.logoOn ? "Logo" : "Design"; };

  async function write() {
    if (!id) setId(newId());
    const rec = { id, name: nameOf(S), updated: Date.now(), state: JSON.parse(JSON.stringify(S)), thumb: snapshot(S, undefined, 260) };
    const pic = photoSrc || null;
    await run(["designs", "photos"], "readwrite", t => {
      t.objectStore("designs").put(rec);
      if (lastPhoto[id] !== pic) { pic ? t.objectStore("photos").put(pic, id) : t.objectStore("photos").delete(id); }
    });
    lastPhoto[id] = pic;
    if (!$("#lib").hidden) showLibrary();
  }
  // called after every change: save a moment later
  function touch() { clearTimeout(timer); timer = setTimeout(() => write().catch(e => console.warn("Library save failed", e)), 700); }

  function resetHistory() { HIST.undo = []; HIST.redo = []; HIST.last = JSON.stringify(S); syncUndo(); }
  function load(state, pic) {
    S = state; S.cur = Math.min(S.cur || 0, Math.max(0, S.texts.length - 1));
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
    savePhoto(pic); photo = null; photoFx = null;
    resetHistory(); setPhoto(pic || null);
  }

  /* ---------- New design ---------- */
  function start(st) {
    clearTimeout(timer);
    const fresh = JSON.parse(JSON.stringify(DEFAULTS));
    const state = Object.assign(fresh, st.set, { texts: st.set.texts.map(t => newText(t)), cur: 0 });
    if (photo && st.photo) { state.px = S.px; state.py = S.py; state.pz = S.pz; }   // keep how the photo was framed
    setId(newId());                                   // a new Library entry (saved once you change something)
    if (!st.photo) lastPhoto[id] = null;
    load(state, st.photo ? photoSrc : null);
    $("#starters").hidden = true;
  }
  function showStarters() {
    const g = $("#starter-grid");
    g.innerHTML = STARTERS.map((st, i) => {
      const state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), st.set, { texts: st.set.texts.map(t => newText(t)) });
      return `<button class="starter" data-i="${i}"><span class="thumb"><img src="${snapshot(state, st.photo, 300)}" alt=""></span><b>${st.title}</b><span>${st.sub}</span></button>`;
    }).join("");
    g.querySelectorAll(".starter").forEach(b => b.onclick = () => start(STARTERS[+b.dataset.i]));
    $("#starters-note").textContent = photo ? "Templates with a photo use the photo you have now." : "";
    $("#starters").hidden = false;
  }

  /* ---------- Library ---------- */
  const ago = t => { const s = (Date.now() - t) / 1000;
    if (s < 60) return "Just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago";
    return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" }); };
  async function showLibrary() {
    $("#lib").hidden = false;
    const grid = $("#lib-grid");
    let list = [];
    try { list = (await all()).sort((a, b) => b.updated - a.updated); }
    catch (e) { grid.innerHTML = `<p class="lib-empty">The Library can't be used in this browser window (private mode?).</p>`; return; }
    if (!list.length) { grid.innerHTML = `<p class="lib-empty">Nothing here yet. Your designs show up here as soon as you start editing.</p>`; return; }
    grid.innerHTML = list.map(r => `<div class="lib-card${r.id === id ? " current" : ""}" data-id="${r.id}">
        <button class="lib-open" data-act="open"><span class="thumb"><img src="${r.thumb}" alt=""></span></button>
        <div class="lib-meta"><b>${r.name.replace(/</g, "&lt;")}</b><span>${r.id === id ? "Open now" : ago(r.updated)} · ${r.state.size === "story" ? "Story" : "Post"}</span></div>
        <div class="lib-acts"><button data-act="dup">Duplicate</button><button data-act="del">Delete</button></div>
      </div>`).join("");
    grid.querySelectorAll("[data-act]").forEach(b => b.onclick = async () => {
      const rid = b.closest(".lib-card").dataset.id, rec = list.find(r => r.id === rid);
      if (b.dataset.act === "open") {
        if (rid !== id) { clearTimeout(timer); const pic = await getPhoto(rid); setId(rid); lastPhoto[rid] = pic || null; load(rec.state, pic || null); }
        $("#lib").hidden = true;
      } else if (b.dataset.act === "dup") {
        const pic = await getPhoto(rid), nid = newId();
        await run(["designs", "photos"], "readwrite", t => {
          t.objectStore("designs").put({ ...rec, id: nid, name: rec.name, updated: Date.now() });
          if (pic) t.objectStore("photos").put(pic, nid);
        });
        toast("Duplicated"); showLibrary();
      } else if (b.dataset.act === "del") {
        if (!confirm(`Delete “${rec.name}” from the Library? This can't be undone.`)) return;
        await run(["designs", "photos"], "readwrite", t => { t.objectStore("designs").delete(rid); t.objectStore("photos").delete(rid); });
        if (rid === id) setId(null);   // keep editing; it's saved again as a new design on the next change
        showLibrary();
      }
    });
  }

  // restore the photo from the Library if this browser couldn't keep it in localStorage
  async function restorePhoto() {
    if (photoSrc || !id) return;
    try { const pic = await getPhoto(id); if (pic) { lastPhoto[id] = pic; savePhoto(pic); setPhoto(pic); } } catch (e) {}
  }

  $("#new-design").onclick = showStarters;
  $("#library").onclick = showLibrary;
  $("#starters-close").onclick = () => $("#starters").hidden = true;
  $("#lib-close").onclick = () => $("#lib").hidden = true;
  [$("#starters"), $("#lib")].forEach(m => m.addEventListener("click", e => { if (e.target === m) m.hidden = true; }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") { $("#starters").hidden = true; $("#lib").hidden = true; } });

  return { touch, showStarters, restorePhoto, snapshot };
})();
window.LIB = LIB;   // simple.js checks window.LIB (a top-level const isn't a window property)

(function () {
  let first = true; try { first = !localStorage.getItem(STORE); } catch (e) {}
  LIB.restorePhoto();
  if (first) document.fonts.ready.then(() => LIB.showStarters());
})();
