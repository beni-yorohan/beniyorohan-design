/* Lou's Fancy Foods — New design (templates).
   Runs after simple.js and uses its design state (S, photo, frame, sync …).
   The templates are starting points for the editor: each one sets the layout, colours,
   text boxes and logo; templates that use a photo keep the photo you already have. */

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

(() => {
  // a picture of a template with the current photo (or none), for its card
  function snapshot(state, pic, w) {
    const keep = { S, photo, photoFx, BOX };
    S = state; photo = pic ? keep.photo : null; photoFx = pic ? keep.photoFx : null;
    const [W, H] = SIZES[S.size], c = document.createElement("canvas"), k = w / W;
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    try { frame(c, k, null); return c.toDataURL("image/jpeg", 0.82); }
    finally { S = keep.S; photo = keep.photo; photoFx = keep.photoFx; BOX = keep.BOX; }
  }
  const build = st => Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), st.set, { texts: st.set.texts.map(t => newText(t)), cur: 0 });

  function start(st) {
    const state = build(st), pic = st.photo ? photoSrc : null;
    if (pic) { state.px = S.px; state.py = S.py; state.pz = S.pz; }   // keep how the photo was framed
    S = state;
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
    savePhoto(pic); photo = null; photoFx = null;
    HIST.undo = []; HIST.redo = []; HIST.last = JSON.stringify(S); syncUndo();
    setPhoto(pic);
    $("#starters").hidden = true;
  }
  function showStarters() {
    const g = $("#starter-grid");
    g.innerHTML = STARTERS.map((st, i) =>
      `<button class="starter" data-i="${i}"><span class="thumb"><img src="${snapshot(build(st), st.photo, 300)}" alt=""></span><b>${st.title}</b><span>${st.sub}</span></button>`).join("");
    g.querySelectorAll(".starter").forEach(b => b.onclick = () => start(STARTERS[+b.dataset.i]));
    $("#starters-note").textContent = photo ? "Templates with a photo use the photo you have now." : "";
    $("#starters").hidden = false;
  }

  $("#new-design").onclick = showStarters;
  $("#starters-close").onclick = () => $("#starters").hidden = true;
  $("#starters").addEventListener("click", e => { if (e.target === $("#starters")) $("#starters").hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("#starters").hidden = true; });

  let first = true; try { first = !localStorage.getItem(STORE); } catch (e) {}
  if (first) document.fonts.ready.then(showStarters);   // first visit: start from a template
})();
