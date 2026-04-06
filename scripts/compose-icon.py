#!/usr/bin/env python3
"""Compose the user-made Gyoza.png onto an amber rounded-square background.

The source PNG has a solid white/grey background (no alpha), so we first
remove it by flood-filling from the corners with transparency.
"""
from PIL import Image, ImageDraw
from collections import deque

SIZE = 1024
SRC = "/Users/audrey/Projects/Test/recipe-keeper/Gyoza.png"
OUT = "/Users/audrey/Projects/Test/recipe-keeper/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

BG = (146, 64, 14)  # amber-800

# ── Load source and remove white background ────────────────────────────────
gyoza = Image.open(SRC).convert("RGBA")
w, h = gyoza.size
pixels = gyoza.load()

def is_bg(r, g, b, a):
    """Is this pixel close to white/grey background?"""
    return r > 230 and g > 230 and b > 230 and (max(r,g,b) - min(r,g,b)) < 20

# Flood fill from all four corners
visited = set()
queue = deque()
for seed in [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1),
             (w//2, 0), (w//2, h-1), (0, h//2), (w-1, h//2)]:
    queue.append(seed)

while queue:
    x, y = queue.popleft()
    if (x, y) in visited or x < 0 or x >= w or y < 0 or y >= h:
        continue
    r, g, b, a = pixels[x, y]
    if not is_bg(r, g, b, a):
        continue
    visited.add((x, y))
    pixels[x, y] = (r, g, b, 0)  # make transparent
    for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
        nx, ny = x+dx, y+dy
        if (nx, ny) not in visited:
            queue.append((nx, ny))

print(f"Made {len(visited)} background pixels transparent")

# Trim to content
bbox = gyoza.getchannel("A").getbbox()
if bbox:
    gyoza = gyoza.crop(bbox)
    print(f"Trimmed to {gyoza.size}")

# ── Create amber rounded-square background ─────────────────────────────────
icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(icon)
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=224, fill=BG)

# Scale gyoza to ~72% of icon height
target_h = int(SIZE * 0.72)
aspect = gyoza.width / gyoza.height
target_w = int(target_h * aspect)
gyoza_resized = gyoza.resize((target_w, target_h), Image.LANCZOS)

# Center on icon
x = (SIZE - target_w) // 2
y = (SIZE - target_h) // 2

icon.paste(gyoza_resized, (x, y), gyoza_resized)

# Flatten to RGB
final = Image.new("RGB", (SIZE, SIZE), BG)
final.paste(icon, mask=icon)
final.save(OUT)
print(f"Saved → {OUT}  ({target_w}×{target_h} at ({x},{y}))")
