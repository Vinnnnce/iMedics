#!/usr/bin/env python3
"""Generates the Medic1905 app icon + splash (PUBG-style dark tactical
design, amber accents) for Android, iOS and Windows builds."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "app-assets")
os.makedirs(OUT, exist_ok=True)

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
BLACK = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

BG = (11, 14, 19, 255)        # #0b0e13
PANEL = (18, 22, 29, 255)     # #12161d
AMBER = (240, 167, 31, 255)   # #f0a71f
AMBER_DARK = (201, 134, 13, 255)
WHITE = (232, 236, 243, 255)
LINE = (42, 50, 66, 255)      # #2a3242


def rounded_poly(draw, pts, radius, fill):
    draw.polygon(pts, fill=fill)


def draw_icon(size=1024):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size

    # Angular dark panel with cut corners (PUBG style)
    cut = int(s * 0.09)
    d.polygon([(0, 0), (s - cut, 0), (s, cut), (s, s - cut), (s - cut, s), (cut, s), (0, s - cut)],
              fill=BG)
    # inner frame line
    m = int(s * 0.045)
    d.polygon([(m, m), (s - cut - m // 2, m), (s - m, cut + m), (s - m, s - cut - m),
               (s - cut - m // 2, s - m), (cut + m, s - m), (m, s - cut - m)],
              outline=LINE, width=max(2, s // 128))

    # Medical cross (angular)
    cx, cy = s * 0.5, s * 0.40
    arm_len = s * 0.15
    arm_w = s * 0.068
    cross = [
        (cx - arm_w, cy - arm_len), (cx + arm_w, cy - arm_len),
        (cx + arm_w, cy - arm_w), (cx + arm_len, cy - arm_w),
        (cx + arm_len, cy + arm_w), (cx + arm_w, cy + arm_w),
        (cx + arm_w, cy + arm_len), (cx - arm_w, cy + arm_len),
        (cx - arm_w, cy + arm_w), (cx - arm_len, cy + arm_w),
        (cx - arm_len, cy - arm_w), (cx - arm_w, cy - arm_w),
    ]
    d.polygon(cross, fill=AMBER)

    # subtle highlight edge on cross
    d.line([(cx - arm_w, cy - arm_len), (cx + arm_w, cy - arm_len)], fill=AMBER_DARK, width=max(2, s // 200))

    # "1905" wordmark
    f = ImageFont.truetype(BLACK, int(s * 0.155))
    text = "1905"
    bbox = d.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    d.text(((s - tw) / 2 - bbox[0], s * 0.68), text, font=f, fill=WHITE)
    # small "MEDIC" above
    f2 = ImageFont.truetype(BOLD, int(s * 0.072))
    t2 = "MEDIC"
    b2 = d.textbbox((0, 0), t2, font=f2)
    tw2 = b2[2] - b2[0]
    d.text(((s - tw2) / 2 - b2[0], s * 0.615), t2, font=f2, fill=(168, 178, 196, 255))

    img.save(os.path.join(OUT, "icon.png"))
    # square (no alpha) variant for stores
    sq = Image.new("RGB", (size, size), BG[0:3])
    sq.paste(img, (0, 0), img)
    sq.save(os.path.join(OUT, "icon-square.png"))
    print("icon.png written")


def draw_splash(w=2732, h=2732):
    img = Image.new("RGB", (w, h), BG[0:3])
    d = ImageDraw.Draw(img)
    # subtle scanlines
    for y in range(0, h, 8):
        d.line([(0, y), (w, y)], fill=(12, 15, 21), width=2)
    # center emblem: cross
    cx, cy = w / 2, h / 2 - h * 0.06
    arm_len = h * 0.11
    arm_w = h * 0.042
    cross = [
        (cx - arm_w, cy - arm_len), (cx + arm_w, cy - arm_len),
        (cx + arm_w, cy - arm_w), (cx + arm_len, cy - arm_w),
        (cx + arm_len, cy + arm_w), (cx + arm_w, cy + arm_w),
        (cx + arm_w, cy + arm_len), (cx - arm_w, cy + arm_len),
        (cx - arm_w, cy + arm_w), (cx - arm_len, cy + arm_w),
        (cx - arm_len, cy - arm_w), (cx - arm_w, cy - arm_w),
    ]
    d.polygon(cross, fill=AMBER)
    # wordmark
    f = ImageFont.truetype(BLACK, int(h * 0.062))
    t1 = "MEDIC"
    b1 = d.textbbox((0, 0), t1, font=f)
    d.text(((w - (b1[2] - b1[0])) / 2 - b1[0], h * 0.56), t1, font=f, fill=(139, 149, 167))
    f2 = ImageFont.truetype(BLACK, int(h * 0.115))
    t2 = "1905"
    b2 = d.textbbox((0, 0), t2, font=f2)
    d.text(((w - (b2[2] - b2[0])) / 2 - b2[0], h * 0.615), t2, font=f2, fill=WHITE)
    f3 = ImageFont.truetype(BOLD, int(h * 0.028))
    t3 = "MEDICAL SIMULATOR"
    b3 = d.textbbox((0, 0), t3, font=f3)
    d.text(((w - (b3[2] - b3[0])) / 2 - b3[0], h * 0.76), t3, font=f3, fill=AMBER)
    # loading bar
    bar_w, bar_h = w * 0.34, h * 0.008
    bx, by = (w - bar_w) / 2, h * 0.82
    d.rounded_rectangle([bx, by, bx + bar_w, by + bar_h], radius=bar_h / 2, fill=PANEL, outline=LINE, width=3)
    d.rounded_rectangle([bx + 4, by + 4, bx + bar_w * 0.62, by + bar_h - 4], radius=bar_h / 2, fill=AMBER)
    img.save(os.path.join(OUT, "splash.png"))
    print("splash.png written")


if __name__ == "__main__":
    draw_icon()
    draw_splash()
