#!/usr/bin/env python3
"""Generate Dodol gyoza D-shaped app icon (v5).

Clean smooth D body + crescent pleat folds along the curved edge
+ golden pan-fried strip along the flat left edge.
"""
from PIL import Image, ImageDraw, ImageFilter
import math

SIZE = 1024
OUT = "/Users/audrey/Projects/Test/recipe-keeper/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

# ── Palette ────────────────────────────────────────────────────────────────
BG           = (146,  64,  14)
BODY         = (250, 238, 208)
BODY_LOWER   = (228, 200, 148)
OUTLINE      = ( 75,  42,   8)
FOLD_FACE    = (246, 233, 198)
FOLD_SHADOW  = (190, 162, 110)
FOLD_LINE    = (162, 132,  85)
PAN_FRY      = (210, 170,  95)     # golden pan-fried strip on flat edge

# ── Canvas ─────────────────────────────────────────────────────────────────
img  = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=224, fill=BG)

# ── Smooth D body ──────────────────────────────────────────────────────────
CX = 195       # flat left edge — pushed left for bigger shape
CY = 512       # vertical center
A  = 395       # horizontal semi-axis (rightmost at 590)
B  = 365       # vertical semi-axis  (top 147, bottom 877)

def ept(deg):
    r = math.radians(deg)
    return (CX + A * math.cos(r), CY + B * math.sin(r))

N = 500
body = [(CX, CY - B), (CX, CY + B)]
body += [ept(90 - 180 * i / N) for i in range(N + 1)]
body_int = [(int(x), int(y)) for x, y in body]

draw.polygon(body_int, fill=BODY)

# Lower body shadow (blurred)
lower = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
ld = ImageDraw.Draw(lower)
lp = [(CX, CY + 20), (CX, CY + B)]
lp += [ept(90 - 90 * i / 250) for i in range(251)]
lp = [(int(x), int(y)) for x, y in lp]
ld.polygon(lp, fill=(*BODY_LOWER, 180))
lower = lower.filter(ImageFilter.GaussianBlur(30))
img = Image.alpha_composite(img, lower)
draw = ImageDraw.Draw(img)

# ── Pan-fried golden strip along the flat left edge ────────────────────────
fry = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
fd = ImageDraw.Draw(fry)
strip_w = 30
fd.rectangle([CX, CY - B + 15, CX + strip_w, CY + B - 15],
             fill=(*PAN_FRY, 130))
fry = fry.filter(ImageFilter.GaussianBlur(14))
img = Image.alpha_composite(img, fry)
draw = ImageDraw.Draw(img)

# ── Pleat folds ────────────────────────────────────────────────────────────
NUM_FOLDS  = 9
FOLD_SPAN  = 18     # angular width of each fold (degrees)
FOLD_DEPTH = 65     # how far inward each crescent extends

for k in range(NUM_FOLDS):
    t = (k + 0.5) / NUM_FOLDS
    center_deg = 78 - 156 * t      # spread from +78° to −78°

    inner_a = A - FOLD_DEPTH
    inner_b = B - FOLD_DEPTH * 0.5

    deg_lo = center_deg + FOLD_SPAN / 2
    deg_hi = center_deg - FOLD_SPAN / 2

    steps = 50
    # Outer arc (lo → hi)
    crescent = []
    for s in range(steps + 1):
        d = deg_lo + (deg_hi - deg_lo) * s / steps
        crescent.append(ept(d))
    # Inner arc (hi → lo)
    for s in range(steps + 1):
        d = deg_hi + (deg_lo - deg_hi) * s / steps
        r = math.radians(d)
        crescent.append((CX + inner_a * math.cos(r),
                         CY + inner_b * math.sin(r)))
    ci = [(int(x), int(y)) for x, y in crescent]

    fl = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    fld = ImageDraw.Draw(fl)

    # Shadow (offset downward)
    shadow_ci = [(x, y + 7) for x, y in ci]
    fld.polygon(shadow_ci, fill=(*FOLD_SHADOW, 160))

    # Fold face
    fld.polygon(ci, fill=(*FOLD_FACE, 220))

    fl = fl.filter(ImageFilter.GaussianBlur(3))
    img = Image.alpha_composite(img, fl)
    draw = ImageDraw.Draw(img)

    # Crease line at inner edge
    crease = []
    for s in range(steps + 1):
        d = deg_lo + (deg_hi - deg_lo) * s / steps
        r = math.radians(d)
        crease.append((int(CX + inner_a * math.cos(r)),
                        int(CY + inner_b * math.sin(r))))
    for i in range(len(crease) - 1):
        draw.line([crease[i], crease[i+1]], fill=FOLD_LINE, width=5)

# ── Outline ─────────────────────────────────────────────────────────────────
OW = 12

draw.line([(CX, CY - B), (CX, CY + B)], fill=OUTLINE, width=OW)

arc = [(int(x), int(y)) for x, y in
       [ept(90 - 180 * i / 500) for i in range(501)]]
for i in range(len(arc) - 1):
    draw.line([arc[i], arc[i+1]], fill=OUTLINE, width=OW)

draw.line([arc[0],  (CX, CY + B)], fill=OUTLINE, width=OW)
draw.line([arc[-1], (CX, CY - B)], fill=OUTLINE, width=OW)

# ── Subtle top highlight ───────────────────────────────────────────────────
hl = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
hd = ImageDraw.Draw(hl)
hx, hy = int(CX + A * 0.30), int(CY - B * 0.28)
hd.ellipse([hx - 70, hy - 45, hx + 70, hy + 45], fill=(255, 252, 240, 50))
hl = hl.filter(ImageFilter.GaussianBlur(32))
img = Image.alpha_composite(img, hl)

# ── Save ────────────────────────────────────────────────────────────────────
final = Image.new("RGB", (SIZE, SIZE), BG)
final.paste(img, mask=img)
final.save(OUT)
print(f"Saved → {OUT}")
