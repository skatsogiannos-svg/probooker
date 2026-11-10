"""Generate the Staff-First Booking App Store icon (1200x1200px) without external image dependencies."""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

SIZE = 1200
PUBLIC_DIR = Path(__file__).resolve().parents[1] / "public"
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
OUT_PNG = PUBLIC_DIR / "icon.png"

def clamp(value: float) -> int:
    return max(0, min(255, round(value)))

def inside_round_rect(x: float, y: float, left: float, top: float, right: float, bottom: float, radius: float) -> bool:
    cx = min(max(x, left + radius), right - radius)
    cy = min(max(y, top + radius), bottom - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2

def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

pixels = bytearray()

# Center coordinates
CENTER_X = 600
CENTER_Y = 600

# Calendar bounding box: 320 to 880 (width 560), 280 to 920 (height 640)
CAL_LEFT, CAL_TOP, CAL_RIGHT, CAL_BOTTOM = 280, 260, 920, 940
CAL_RADIUS = 70

# Header bar top: 260 to 390
HEADER_BOTTOM = 390

# Person mark:
# Head circle: center (600, 520), radius 80
HEAD_CX, HEAD_CY, HEAD_R = 600, 525, 80

# Shoulders: center (600, 770), ellipse rx=160, ry=110
SHOULDER_CX, SHOULDER_CY, SHOULDER_RX, SHOULDER_RY = 600, 770, 160, 110

# Star / Check badge on top-right of calendar: center (840, 360), radius 60
BADGE_CX, BADGE_CY, BADGE_R = 830, 370, 55

for y in range(SIZE):
    for x in range(SIZE):
        # Background gradient: Rich deep royal blue to dark slate
        t_bg = (x * 0.4 + y * 0.6) / SIZE
        bg_r = 16 + 22 * t_bg
        bg_g = 36 + 48 * t_bg
        bg_b = 85 + 75 * t_bg

        # Base background color
        r, g, b = bg_r, bg_g, bg_b

        # Calendar card drop shadow
        if inside_round_rect(x, y - 25, CAL_LEFT - 10, CAL_TOP, CAL_RIGHT + 10, CAL_BOTTOM, CAL_RADIUS + 10):
            r = r * 0.65
            g = g * 0.65
            b = b * 0.65

        # Inside Calendar Card
        if inside_round_rect(x, y, CAL_LEFT, CAL_TOP, CAL_RIGHT, CAL_BOTTOM, CAL_RADIUS):
            if y <= HEADER_BOTTOM:
                # Calendar Header: Vibrant teal-indigo accent
                t_head = (x - CAL_LEFT) / (CAL_RIGHT - CAL_LEFT)
                r = 14 + 16 * t_head
                g = 145 + 30 * t_head
                b = 210 + 25 * t_head
            else:
                # Calendar Body: Clean soft off-white
                r, g, b = 250, 252, 255

                # Person icon inside calendar:
                # 1. Head circle
                dist_head_sq = (x - HEAD_CX) ** 2 + (y - HEAD_CY) ** 2
                if dist_head_sq <= HEAD_R ** 2:
                    r, g, b = 30, 58, 138  # Deep navy

                # 2. Body / Shoulders
                elif y >= 640 and y <= 830:
                    norm_x = (x - SHOULDER_CX) / SHOULDER_RX
                    norm_y = (y - SHOULDER_CY) / SHOULDER_RY
                    if norm_x ** 2 + norm_y ** 2 <= 1.0:
                        r, g, b = 30, 58, 138

            # Calendar Binder Rings at top (x=440 and x=760, y from 220 to 290)
            for ring_x in (440, 760):
                if inside_round_rect(x, y, ring_x - 22, 215, ring_x + 22, 295, 20):
                    r, g, b = 220, 230, 245

        # Check / Appointment Badge
        dist_badge_sq = (x - BADGE_CX) ** 2 + (y - BADGE_CY) ** 2
        if dist_badge_sq <= (BADGE_R + 8) ** 2:
            r, g, b = 255, 255, 255  # White border
        if dist_badge_sq <= BADGE_R ** 2:
            # Teal / Emerald check badge
            r, g, b = 16, 185, 129
            # Draw Checkmark inside badge
            # check coordinates roughly: (810, 370) -> (825, 385) -> (855, 355)
            # Simple check geometry
            dx, dy = x - BADGE_CX, y - BADGE_CY
            # Checkmark stroke approximation
            if (-20 <= dx <= 0 and dy == round(dx + 12)) or (-20 <= dx <= 0 and dy == round(dx + 13)) or \
               (0 <= dx <= 25 and dy == round(-dx + 12)) or (0 <= dx <= 25 and dy == round(-dx + 13)) or \
               (-20 <= dx <= 0 and dy == round(dx + 11)) or (0 <= dx <= 25 and dy == round(-dx + 11)):
                r, g, b = 255, 255, 255

        pixels.extend((clamp(r), clamp(g), clamp(b), 255))

raw = b"".join(b"\x00" + pixels[y * SIZE * 4 : (y + 1) * SIZE * 4] for y in range(SIZE))
png = b"\x89PNG\r\n\x1a\n"
png += png_chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
png += png_chunk(b"IDAT", zlib.compress(raw, 9))
png += png_chunk(b"IEND", b"")

OUT_PNG.write_bytes(png)
print(f"Generated {OUT_PNG} ({len(png)} bytes, {SIZE}x{SIZE})")
