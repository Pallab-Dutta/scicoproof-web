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
    "favicon-16x16.png":   16,
    "favicon-32x32.png":   32,
    "apple-touch-icon.png": 180,
}

for name, px in sizes.items():
    render(px).save(HERE / name, format="PNG")
    print(f"  {name} ({px}×{px})")

ico_frames = [render(s) for s in (16, 32, 48)]
ico_frames[0].save(
    HERE / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=ico_frames[1:],
)
print("  favicon.ico (16, 32, 48)")
print("Done.")
