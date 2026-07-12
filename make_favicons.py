#!/usr/bin/env python3
"""Generate favicon files from favicon.svg.

Usage:
    python make_favicons.py

Requires: cairosvg, Pillow
    pip install cairosvg Pillow
"""
import io, pathlib
import cairosvg
from PIL import Image

HERE = pathlib.Path(__file__).parent
SVG  = HERE / "favicon.svg"

def render(size: int) -> Image.Image:
    png = cairosvg.svg2png(url=str(SVG), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")

sizes = {
    "favicon-16x16.png":    16,
    "favicon-32x32.png":    32,
    # Google Search shows a site's favicon only from a square that is a multiple
    # of 48px (it rescales to 48x48). Ship 48/96/192 so it has one to use.
    "favicon-48x48.png":    48,
    "favicon-96x96.png":    96,
    "favicon-192x192.png": 192,
    "apple-touch-icon.png": 180,
}

for name, px in sizes.items():
    render(px).save(HERE / name, format="PNG")
    print(f"  {name} ({px}×{px})")

render(48).save(
    HERE / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
)
print("  favicon.ico (16, 32, 48)")
print("Done.")
