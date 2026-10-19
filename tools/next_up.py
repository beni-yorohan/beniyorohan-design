"""Write the Koto-style "next up" block into every project page.

The homepage grid is the single source of truth: project order, titles, labels and
card media all come from index.html, so the chain always matches the cards. Run it
again whenever a card is added, removed or reordered:

    python3 tools/next_up.py

Each page gets three marked regions (replaced on every run, safe to repeat):
    /* next-up:css */ ... /* /next-up:css */      inside the page's <style>
    <!-- next-up --> ... <!-- /next-up -->         where the old .project-nav was
    <!-- next-up:js --> ... <!-- /next-up:js -->   before </body>
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CARD = re.compile(
    r'<div class="project-card fade-in">\s*<a href="/projects/(?P<slug>[a-z0-9-]+)">\s*'
    r'<div class="project-thumb(?P<cls>[^"]*)">(?P<media>[\s\S]*?)</div>\s*'
    r'<div class="project-info">\s*<div class="project-title">(?P<title>[^<]+)</div>\s*'
    r'<div class="project-subtitle">(?P<label>[^<]+)</div>')

# 2–3 sentences per project for the "next up" handoff, in studio voice.
# Every linked homepage card needs an entry; the script refuses to run without one.
BLURBS = {
    "rayka-black": "An ultra-heavy display typeface that began as a single capital R, cut by hand from black paper. Every other character descends from that one object — traced, spaced and engineered into a 58-glyph font with Turkish support.",
    "solidworks-socials": "Dassault Systèmes’ education brand, refined across its social channels: tighter guidelines, rebuilt templates and the campaign for the SOLIDWORKS Freemium launch. The work grew into a custom asset-creation tool, and the team became a BY Design client.",
    "matos-organic-tomato-juice": "An organic tomato juice brand built around one idea: Radical Ripeness. Logo, packaging, typography, colour, social and print, all designed to feel bold, unapologetic and rooted in real agriculture.",
    "comi-app": "A swipe-style roommate matching app for universities, with a commercial version built to scale beyond the campus. The brand sits between cool and trust — casual enough for students, credible enough for schools and parents.",
    "patico-bar": "A listening bar in Cihangir, Istanbul, serving Sephardic flavors through contemporary Mediterranean culture. The identity covers the wordmark, a custom typeface, a three-colour palette and every surface the bar touches.",
    "ganchos-sans": "A contemporary sans-serif built from Solitreo, the handwritten script Sephardic Jews used for centuries to write Ladino. A year of archival research and interviews, translated into a typeface, a 112-page book, posters and a woven rug.",
    "patico-geometric": "The display typeface drawn for Patico Bar. Its angular capitals take their cue from the Bosphorus Bridge and the architecture of Cihangir, and carry the bar’s logo, menus and social posts.",
    "flavors-of-solitude": "A three-album curation organized around bitter, sweet and plain — three registers of being alone, built from a move from Istanbul to Boston. Three 12-inch records, a hand-crafted leather record bag and a companion catalog book.",
    "dadi-khool-magazine": "A self-published editorial magazine — part family tribute, part playful study of dad culture as a kind of vernacular style. Editorial direction, typography, layout, image treatment and print production across the April and May 2026 issues.",
    "moms-club": "A women-focused wellness and social space in Istanbul — part café, part fitness studio, part community hub. An identity of earthy colour and hand-drawn everyday rituals, from a street-facing light box to a coffee-cup sleeve.",
    "type-bird-series": "A browser-based flock simulator that turns punctuation into living creatures: every comma, slash and bracket becomes a bird, governed by real flocking algorithms. A creative-coding experiment between type design and generative art.",
    "start-today": "A type installation at MassArt, set in artificial turf on a garden bed. Pixelated letterforms meet organic material — the digital and the natural sharing a single form.",
}

CSS = r'''
        /* next-up:css */
        /* ---- Next up (after Koto): the next project hands over at the end of the page ---- */
        .next-up {
            margin-top: 140px;
            padding: 0 var(--side-padding);
        }

        .next-up-bar {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 24px;
            padding-bottom: 28px;
        }

        .next-up-label,
        .next-up-all,
        .next-up-count,
        .next-up-start {
            font-family: 'OT Brut Mono', monospace;
            font-size: 14px;
            font-weight: 400;
            line-height: 1;
            text-decoration: none;
        }

        .next-up-label,
        .next-up-count { color: var(--text-secondary); }

        .next-up-meta { display: flex; gap: 18px; align-items: baseline; }

        .next-up-all { color: #ffffff; display: inline-flex; gap: 0.35em; }
        .next-up-all .b { transition: transform 333ms cubic-bezier(0.22, 1, 0.36, 1); }
        .next-up-all:hover .b:first-child { transform: translateX(-4px); }
        .next-up-all:hover .b:last-child { transform: translateX(4px); }

        .next-up-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
            gap: 24px;
            align-items: end;
        }

        .next-up-text {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-self: stretch;
            gap: 64px;
        }

        .next-up-title {
            font-family: var(--font-body);
            font-size: 30px;
            font-weight: 500;
            line-height: 1.1;
            letter-spacing: -0.01em;
            color: var(--text-primary);
            text-decoration: none;
            display: block;
            transition: opacity 0.25s ease;
        }

        .next-up-title span { display: block; }
        .next-up-title span + span { color: var(--text-secondary); }
        .next-up-title:hover { opacity: 0.6; }

        /* the blurb reads in the writeup voice: OT Brut, short column */
        .next-up-blurb {
            max-width: 460px;
            margin-top: 20px;
            font-family: 'OT Brut', Georgia, serif;
            font-size: 20px;
            font-weight: 400;
            line-height: 1.25;
            letter-spacing: -0.005em;
            color: var(--text-primary);
        }

        .next-up-contact p {
            font-family: var(--font-body);
            font-size: 13px;
            font-weight: 500;
            line-height: 1.2;
            color: var(--text-primary);
        }

        .next-up-contact p span { display: block; color: var(--text-secondary); }

        .next-up-start {
            display: inline-block;
            margin-top: 14px;
            color: #ffffff;
            transition: opacity 0.25s ease;
        }

        .next-up-start:hover { opacity: 0.6; }

        /* The preview grows out of its bottom-right corner as you reach the end of the page */
        .next-up-media {
            display: block;
            position: relative;
            aspect-ratio: 4 / 5;
            overflow: hidden;
            background: #111111;
            clip-path: inset(var(--nu-inset, 88%) 0 0 var(--nu-inset, 88%));
            will-change: clip-path;
        }

        .next-up-media video,
        .next-up-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            transform: scale(var(--nu-scale, 1.12));
            transform-origin: 100% 100%;
        }

        .next-up-media.matos-thumb {
            background-color: #FFD600;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .next-up-media.matos-thumb img { width: 55%; height: auto; object-fit: contain; }

        @media (max-width: 680px) {
            .next-up { margin-top: 96px; }
            .next-up-grid { grid-template-columns: 1fr; gap: 20px; }
            .next-up-text { display: contents; }   /* phones: title, preview, then the prompt */
            .next-up-title { order: 1; font-size: 24px; }
            .next-up-lead { display: contents; }
            .next-up-blurb { order: 1; margin-top: 0; font-size: 18px; }
            .next-up-media { order: 2; }
            .next-up-contact { order: 3; margin-top: 16px; }
        }

        @media (prefers-reduced-motion: reduce) {
            .next-up-media { clip-path: none; }
            .next-up-media video, .next-up-media img { transform: none; }
        }
        /* /next-up:css */
'''

JS = r'''
    <!-- next-up:js -->
    <script>
        // Next up: the preview's clip opens from the bottom-right corner as the block scrolls
        // into view (eased, scroll-linked, rAF-throttled), and the video only plays while visible.
        (() => {
            const media = document.querySelector('.next-up-media');
            if (!media) return;
            const video = media.querySelector('video');
            const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
            const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);
            let ticking = false;
            function update() {
                ticking = false;
                if (reduce) return;
                const r = media.getBoundingClientRect();
                const vh = window.innerHeight;
                const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75)));
                const e = smooth(p);
                media.style.setProperty('--nu-inset', ((1 - e) * 88).toFixed(2) + '%');
                media.style.setProperty('--nu-scale', (1 + (1 - e) * 0.12).toFixed(4));
            }
            window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
            window.addEventListener('resize', update);
            update();
            if (video && 'IntersectionObserver' in window) {
                new IntersectionObserver((entries) => {
                    entries.forEach((en) => {
                        if (en.isIntersecting) { video.muted = true; video.play().catch(() => {}); }
                        else video.pause();
                    });
                }).observe(media);
            }
        })();
    </script>
    <!-- /next-up:js -->
'''


def cards():
    src = (ROOT / "index.html").read_text()
    out = []
    for m in CARD.finditer(src):
        media = m.group("media").strip()
        # homepage paths are relative to the site root
        media = re.sub(r'(src|poster)="assets/', r'\1="/assets/', media)
        # the next-up preview plays only when visible, so it shouldn't autoload
        media = media.replace(' autoplay', '').replace('preload="auto"', 'preload="none"')
        if 'preload=' not in media:
            media = media.replace('<video ', '<video preload="none" ', 1)
        out.append({"slug": m.group("slug"), "cls": m.group("cls").strip(), "media": media,
                    "title": m.group("title").strip(), "label": m.group("label").strip()})
    return out


def block(nxt, count):
    cls = ("next-up-media " + nxt["cls"].replace("-thumb", "-thumb")).strip()
    title = nxt["title"]
    label = nxt["label"]
    if nxt["slug"] not in BLURBS:
        raise SystemExit(f"tools/next_up.py: add a 2–3 sentence BLURBS entry for {nxt['slug']}")
    blurb = html.escape(BLURBS[nxt["slug"]], quote=False)
    return f'''    <!-- next-up -->
    <section class="next-up" aria-label="Next project">
        <div class="next-up-bar fade-in">
            <span class="next-up-label">next up</span>
            <div class="next-up-meta">
                <a href="/" class="next-up-all"><span class="b">[</span>all projects<span class="b">]</span></a>
                <span class="next-up-count">({count})</span>
            </div>
        </div>
        <div class="next-up-grid">
            <div class="next-up-text">
                <div class="next-up-lead fade-in">
                    <a href="/projects/{nxt["slug"]}" class="next-up-title"><span>{title}</span><span>{label}</span></a>
                    <p class="next-up-blurb">{blurb}</p>
                </div>
                <div class="next-up-contact fade-in">
                    <p>Want to start a project?<span>Tell us about your brand and what you’re looking for.</span></p>
                    <a href="/brand-discovery.html" class="next-up-start">start a project &#8599;</a>
                </div>
            </div>
            <a href="/projects/{nxt["slug"]}" class="{cls}" aria-label="Next project: {html.escape(html.unescape(title), quote=True)}">
                {nxt["media"]}
            </a>
        </div>
    </section>
    <!-- /next-up -->'''


def replace_region(s, start, end, new, fallback):
    if start in s:
        a = s.index(start)
        b = s.index(end, a) + len(end)
        return s[:a] + new.strip("\n") + s[b:]
    return fallback(s, new)


def main():
    cs = cards()
    if len(cs) < 2:
        sys.exit("found fewer than two linked cards on the homepage")
    n = len(cs)
    for i, c in enumerate(cs):
        page = ROOT / "projects" / c["slug"] / "index.html"
        if not page.exists():
            print("skip (no page):", c["slug"]); continue
        s = page.read_text()
        nxt = cs[(i + 1) % n]

        def put_css(s, new):
            j = s.rfind("</style>", 0, s.find("</head>"))
            return s[:j] + new.lstrip("\n") + "    " + s[j:]

        def put_block(s, new):
            m = re.search(r'    <div class="project-nav">[\s\S]*?</div>\n', s)
            if not m:
                raise SystemExit(f"{c['slug']}: no .project-nav to replace")
            return s[:m.start()] + new + "\n" + s[m.end():]

        def put_js(s, new):
            j = s.rfind("</body>")
            return s[:j] + new.lstrip("\n") + s[j:]

        s = replace_region(s, "        /* next-up:css */", "/* /next-up:css */", CSS, put_css)
        s = replace_region(s, "    <!-- next-up -->", "<!-- /next-up -->", block(nxt, n), put_block)
        s = replace_region(s, "    <!-- next-up:js -->", "<!-- /next-up:js -->", JS, put_js)
        page.write_text(s)
        print(f"{c['slug']:28s} -> {nxt['slug']}")


if __name__ == "__main__":
    main()
