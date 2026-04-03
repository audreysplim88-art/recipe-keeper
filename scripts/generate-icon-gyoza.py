#!/usr/bin/env python3
"""Generate Dodol gyoza D-shaped app icon.

The gyoza is drawn sideways so its silhouette reads as a "D":
  - flat left edge  = the vertical stroke of D
  - rounded, pleated right edge = the arc of D
"""
from PIL import Image, ImageDraw, ImageFilter
import math

SIZE = 1024
OUT = "/Users/audrey/Projects/Test/recipe-keeper/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

# ── Palette ────────────────────────────────────────────────────────────────
BG          = (146,  64,  14)   # amber-800  #92400e
BODY_TOP    = (255, 250, 228)   # warm cream (upper highlight)
BODY_MID    = (248, 232, 185)   # gentle mid-tone
BODY_BTM    = (232, 198, 128)   # golden tan underside
OUTLINE_COL = ( 75,  38,   5)   # very dark brown
RIDGE_COL   = (195, 150,  70)   # mid-golden ridge
PLEAT_COL   = (148, 100,  35)   # pleat lines

# ── Canvas ─────────────────────────────────────────────────────────────────
img  = Image.new("RGB", (SIZE, SIZE))
draw = ImageDraw.Draw(img)
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=224, fill=BG)

# ── D-shape geometry ────────────────────────────────────────────────────────
# Half-ellipse: flat left edge at x=LX, arc centre also at (LX, CY).
# Slightly shifted right so the D reads centred in the amber square.
LX = 270      # flat left edge x
CY = 512      # vertical centre
A  = 330      # horizontal radius  → rightmost x = LX+A = 600
B  = 318      # vertical radius    → height = 2B = 636 px (y 194…830)

def arc_pt(deg, a=A, b=B):
    t = math.radians(deg)
    return (LX + a * math.cos(t), CY + b * math.sin(t))

def arc_poly(deg_start, deg_end, n, a=A, b=B):
    return [arc_pt(deg_start + (deg_end - deg_start) * i / n, a, b)
            for i in range(n + 1)]

# ── Build body polygons ─────────────────────────────────────────────────────
# Gyoza tips are slightly pinched — pull the top/bottom arc ends inward
# by reducing the arc radius near ±90°.  We interpolate:
def tapered_arc_pt(deg):
    """Arc point with tips that taper toward the flat edge (gyoza pinch)."""
    t     = math.radians(deg)
    # taper: 1.0 at equator, ~0.62 at poles
    taper = 1.0 - 0.38 * abs(math.sin(t)) ** 1.6
    return (LX + A * taper * math.cos(t),
            CY + B * math.sin(t))

# Full body polygon
body_pts = [(LX, CY - B), (LX, CY + B)]
body_pts += [tapered_arc_pt(90 - 180 * i / 300) for i in range(301)]
body_pts = [(int(x), int(y)) for x, y in body_pts]

# ── Paint ──────────────────────────────────────────────────────────────────
# 1. Fill entire body cream
draw.polygon(body_pts, fill=BODY_TOP)

# 2. Overlay bottom-half shadow as a MASK-blended layer (avoids hard banding)
shadow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow_layer)

# Shadow polygon: same arc but only the lower half (90°→−90° from BOTTOM side)
shadow_pts  = [(LX, CY), (LX, CY + B)]
shadow_pts += [tapered_arc_pt(90 - 180 * i / 300) for i in range(301)]
shadow_pts  = [(int(x), int(y)) for x, y in shadow_pts]
sd.polygon(shadow_pts, fill=(*BODY_BTM, 180))   # semi-transparent golden tan
shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(22))

img_rgba = img.convert("RGBA")
img_rgba = Image.alpha_composite(img_rgba, shadow_layer)
img = img_rgba.convert("RGB")
draw = ImageDraw.Draw(img)

# ── Outline ─────────────────────────────────────────────────────────────────
W = 12

# Flat left edge
draw.line([(LX, CY - B), (LX, CY + B)], fill=OUTLINE_COL, width=W)

# Arc outline (following the tapered shape)
arc_ol = [(int(x), int(y))
           for x, y in (tapered_arc_pt(90 - 180 * i / 360) for i in range(361))]
for i in range(len(arc_ol) - 1):
    draw.line([arc_ol[i], arc_ol[i + 1]], fill=OUTLINE_COL, width=W)

# Close corners
draw.line([arc_ol[0],  (LX, CY + B)], fill=OUTLINE_COL, width=W)
draw.line([arc_ol[-1], (LX, CY - B)], fill=OUTLINE_COL, width=W)

# ── Crimp ridge: follows inside the tapered arc ─────────────────────────────
def ridge_pt(deg):
    t     = math.radians(deg)
    taper = 1.0 - 0.45 * abs(math.sin(t)) ** 1.8
    ra    = A * taper - 26
    rb    = B - 14
    return (int(LX + ra * math.cos(t)), int(CY + rb * math.sin(t)))

ridge_pts = [ridge_pt(82 - 164 * i / 220) for i in range(221)]
for i in range(len(ridge_pts) - 1):
    draw.line([ridge_pts[i], ridge_pts[i + 1]], fill=RIDGE_COL, width=18)

# ── Pleat marks: short strokes from ridge outward ───────────────────────────
N_PLEATS = 10
for k in range(N_PLEATS):
    frac = (k + 0.5) / N_PLEATS
    deg  = 78 - 156 * frac
    t    = math.radians(deg)
    taper = 1.0 - 0.45 * abs(math.sin(t)) ** 1.8

    # Inner end
    ix = int(LX + (A * taper - 58) * math.cos(t))
    iy = int(CY + (B - 30) * math.sin(t))

    # Outer end (just inside outline)
    ox = int(LX + (A * taper - 9) * math.cos(t))
    oy = int(CY + (B - 5) * math.sin(t))

    draw.line([(ix, iy), (ox, oy)], fill=PLEAT_COL, width=8)

# ── Save ────────────────────────────────────────────────────────────────────
img.save(OUT)
print(f"Saved → {OUT}")
