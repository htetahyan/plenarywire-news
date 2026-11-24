#!/usr/bin/env python3
"""Builds the PlenaryWire logo SVGs from config/brand.json + the bundled OFL fonts.
Text is converted to outlines, so the logo never depends on a web font.
Needs: fonttools + brotli (python3 -m venv /tmp/fv && /tmp/fv/bin/pip install fonttools brotli)."""
import json, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
brand = json.load(open(os.path.join(ROOT, "config/brand.json")))
C = brand["colors"]
OUT = os.path.join(ROOT, "assets/brand")
os.makedirs(OUT, exist_ok=True)

def outline(font_file, wght, text, size, x0, baseline, tracking=0.0):
    f = TTFont(os.path.join(ROOT, "assets/fonts", font_file))
    f = instantiateVariableFont(f, {"wght": wght})
    gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm
    s = size / upm
    pen = SVGPathPen(gs, ntos=lambda v: ("%.1f" % v).rstrip("0").rstrip("."))
    bp = BoundsPen(gs)
    x = x0
    kern = {}
    for ch in text:
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (s, 0, 0, -s, x, baseline))
        gs[g].draw(tp)
        gs[g].draw(TransformPen(bp, (s, 0, 0, -s, x, baseline)))
        x += f["hmtx"][g][0] * s + tracking * size
    return pen.getCommands(), x, bp.bounds

# --- Mark: rounded tile, a "P" whose bowl transmits two signal arcs (the wire). 64x64 grid.
def mark(prefix="pw"):
    return f'''<defs><linearGradient id="{prefix}-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C['markTop']}"/><stop offset="1" stop-color="{C['markBottom']}"/></linearGradient></defs>
<rect width="64" height="64" rx="15" fill="url(#{prefix}-g)"/>
<path d="M21 47V17h11.5a9.5 9.5 0 0 1 0 19H21" fill="none" stroke="#fff" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M44.8 17.9a15 15 0 0 1 0 17.2M49.3 14.7a20.5 20.5 0 0 1 0 23.6" fill="none" stroke="{C['signal']}" stroke-width="3.4" stroke-linecap="round"/>
<circle cx="32.5" cy="26.5" r="2.6" fill="{C['signal']}"/>'''

open(os.path.join(OUT, "plenarywire-mark.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="{brand["name"]}"><title>{brand["name"]}</title>{mark()}</svg>\n')

# --- Wordmark: "Plenary" in Newsreader 700 (ink) + "Wire" in Newsreader 800 (accent), outlined.
P, x1, b1 = outline("newsreader-latin-wght.woff2", 700, brand["wordmark"]["primary"], 46, 80, 46, -0.01)
W, x2, b2 = outline("newsreader-latin-wght.woff2", 800, brand["wordmark"]["accent"], 46, x1 + 1, 46, -0.01)
width = round(x2 + 4)
json.dump({"viewBox": f"0 0 {width} 64", "markWidth": 64, "primary": P, "accent": W, "wordX": 80, "width": width},
          open(os.path.join(ROOT, "config/logo-paths.json"), "w"))

def logo(ink, accent, dark_ink=None, dark_accent=None):
    style = ""
    if dark_ink:
        style = f'<style>.i{{fill:{ink}}}.a{{fill:{accent}}}@media (prefers-color-scheme:dark){{.i{{fill:{dark_ink}}}.a{{fill:{dark_accent}}}}}</style>'
        fi, fa = 'class="i"', 'class="a"'
    else:
        fi, fa = f'fill="{ink}"', f'fill="{accent}"'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 64" role="img" aria-label="{brand["name"]}"><title>{brand["name"]}</title>{style}{mark()}<path {fi} d="{P}"/><path {fa} d="{W}"/></svg>\n'

open(os.path.join(OUT, "plenarywire-logo.svg"), "w").write(logo(C["ink"], C["accent"], C["inkDark"], C["accentDark"]))
open(os.path.join(OUT, "plenarywire-logo-light.svg"), "w").write(logo(C["ink"], C["accent"]))
open(os.path.join(OUT, "plenarywire-logo-dark.svg"), "w").write(logo(C["inkDark"], C["accentDark"]))
print("logo built", width, "x 64 ->", OUT)
