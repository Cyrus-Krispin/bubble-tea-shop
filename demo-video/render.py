"""Render captured product screens as a floating-browser talk video."""

from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "scenes.json").read_text())
OUT = ROOT / "output" / "bubble-tea-shop-demo.mp4"
OUT.parent.mkdir(parents=True, exist_ok=True)

WIDTH, HEIGHT, FPS = 1920, 1080, 24
TILE_WIDTH, BAR_HEIGHT = 1510, 58
CONTENT_HEIGHT = round(TILE_WIDTH * MANIFEST["viewport"]["height"] / MANIFEST["viewport"]["width"])
TILE_HEIGHT = BAR_HEIGHT + CONTENT_HEIGHT
TILE_X, TILE_Y = (WIDTH - TILE_WIDTH) // 2, 106

INK = (32, 40, 59)
PAPER = (255, 250, 236)
PINK = (243, 168, 171)
YELLOW = (255, 225, 154)
BLUE = (169, 203, 245)
GREEN = (189, 232, 204)

HAND = "/System/Library/Fonts/Supplemental/Chalkboard.ttc"
SANS = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
TITLE_FONT = ImageFont.truetype(HAND, 44)
DETAIL_FONT = ImageFont.truetype(HAND, 31)
CHROME_FONT = ImageFont.truetype(SANS, 20)
SMALL_FONT = ImageFont.truetype(SANS, 17)


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def paint_background() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw.ellipse((-230, -240, 650, 620), fill=(255, 243, 213))
    draw.ellipse((1490, 720, 2200, 1430), fill=(246, 228, 235))
    draw.arc((-85, 275, 315, 675), 22, 280, fill=PINK, width=5)
    draw.arc((1690, 60, 2010, 380), 115, 345, fill=BLUE, width=5)
    for x, y, color in [(112, 88, PINK), (1800, 160, GREEN), (1780, 900, YELLOW)]:
        draw.ellipse((x - 9, y - 9, x + 9, y + 9), fill=color, outline=INK, width=2)
    return image


BACKGROUND = paint_background()


def browser_tile(screenshot: Image.Image, focus: dict | None = None, zoom: float = 1.0) -> Image.Image:
    window = Image.new("RGBA", (TILE_WIDTH, TILE_HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(window)
    draw.rectangle((0, 0, TILE_WIDTH, BAR_HEIGHT), fill=(255, 253, 247, 255))
    for x, color in [(31, PINK), (59, YELLOW), (87, GREEN)]:
        draw.ellipse((x - 9, 20, x + 9, 38), fill=color, outline=INK, width=2)
    draw.text((121, 17), "Bubble Tea Shop", font=CHROME_FONT, fill=INK)
    draw.rounded_rectangle((TILE_WIDTH - 212, 13, TILE_WIDTH - 25, 45), radius=16, fill=(244, 243, 239))
    draw.text((TILE_WIDTH - 190, 20), "LOCAL DEMO", font=SMALL_FONT, fill=(92, 97, 110))
    shot = screenshot
    if focus and zoom > 1:
        enlarged_width = round(TILE_WIDTH * zoom)
        enlarged_height = round(CONTENT_HEIGHT * zoom)
        enlarged = shot.resize((enlarged_width, enlarged_height), Image.Resampling.LANCZOS)
        point_x = focus["x"] / MANIFEST["viewport"]["width"] * TILE_WIDTH
        point_y = focus["y"] / MANIFEST["viewport"]["height"] * CONTENT_HEIGHT
        crop_x = min(enlarged_width - TILE_WIDTH, max(0, round(point_x * (zoom - 1))))
        crop_y = min(enlarged_height - CONTENT_HEIGHT, max(0, round(point_y * (zoom - 1))))
        shot = enlarged.crop((crop_x, crop_y, crop_x + TILE_WIDTH, crop_y + CONTENT_HEIGHT))
    window.paste(shot, (0, BAR_HEIGHT))
    draw = ImageDraw.Draw(window)
    draw.line((0, BAR_HEIGHT, TILE_WIDTH, BAR_HEIGHT), fill=(207, 204, 195), width=2)
    mask = Image.new("L", (TILE_WIDTH, TILE_HEIGHT), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, TILE_WIDTH - 1, TILE_HEIGHT - 1), radius=23, fill=255)
    window.putalpha(mask)
    return window


SCENES = MANIFEST["scenes"]
SCREENSHOTS = [Image.open(ROOT / "frames" / scene["file"]).convert("RGB")
               .resize((TILE_WIDTH, CONTENT_HEIGHT), Image.Resampling.LANCZOS) for scene in SCENES]
TILES = [browser_tile(screenshot) for screenshot in SCREENSHOTS]

shadow = Image.new("RGBA", (TILE_WIDTH + 100, TILE_HEIGHT + 100), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(
    (50, 42, TILE_WIDTH + 49, TILE_HEIGHT + 41), radius=25, fill=(32, 40, 59, 110)
)
SHADOW = shadow.filter(ImageFilter.GaussianBlur(32))


def pointer_position(pointer: dict | None) -> tuple[float, float] | None:
    if pointer is None:
        return None
    scale = TILE_WIDTH / MANIFEST["viewport"]["width"]
    return TILE_X + pointer["x"] * scale, TILE_Y + BAR_HEIGHT + pointer["y"] * scale


def draw_cursor(draw: ImageDraw.ImageDraw, x: float, y: float, click: float) -> None:
    tip = (round(x), round(y))
    polygon = [tip, (x + 2, y + 35), (x + 10, y + 27), (x + 19, y + 47),
               (x + 27, y + 43), (x + 18, y + 24), (x + 31, y + 23)]
    shadow_points = [(a + 3, b + 4) for a, b in polygon]
    draw.polygon(shadow_points, fill=(12, 16, 25), outline=(12, 16, 25), width=3)
    draw.polygon(polygon, fill=(255, 255, 255), outline=INK, width=3)
    if click > 0:
        radius = 17 + click * 26
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=PINK, width=5)


def render_frame(index: int, scene_index: int, local_time: float) -> Image.Image:
    scene = SCENES[scene_index]
    duration = scene["duration"]
    frame = BACKGROUND.copy().convert("RGBA")
    tile_y = TILE_Y + round(5 * math.sin(index / 26))
    frame.alpha_composite(SHADOW, (TILE_X - 50, tile_y - 42))
    tile = TILES[scene_index]
    if scene.get("pointer"):
        phase = local_time / duration
        zoom_in = ease((phase - 0.28) / 0.25)
        zoom_out = 1 - ease((phase - 0.73) / 0.20)
        amount = min(zoom_in, zoom_out) * 0.75
        if amount > 0:
            tile = browser_tile(SCREENSHOTS[scene_index], scene["pointer"], 1 + 0.025 * amount)
    frame.alpha_composite(tile, (TILE_X, tile_y))

    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle((TILE_X, 31, TILE_X + 62, 78), radius=11, fill=PINK, outline=INK, width=2)
    draw.text((TILE_X + 13, 43), f"{scene_index + 1:02d}", font=CHROME_FONT, fill=INK)
    draw.text((TILE_X + 80, 27), scene["title"], font=TITLE_FONT, fill=INK)
    draw.text((TILE_X + 3, 1019), scene["detail"], font=DETAIL_FONT, fill=INK)
    progress_width = int(TILE_WIDTH * (index + 1) / TOTAL_FRAMES)
    draw.rounded_rectangle((TILE_X, 999, TILE_X + TILE_WIDTH, 1005), radius=3, fill=(222, 216, 204))
    draw.rounded_rectangle((TILE_X, 999, TILE_X + progress_width, 1005), radius=3, fill=PINK)

    end = pointer_position(scene.get("pointer"))
    if end:
        previous_end = pointer_position(SCENES[scene_index - 1].get("pointer")) if scene_index else None
        start = previous_end if previous_end and scene_index not in (7, 10) else (TILE_X + 430, tile_y + 340)
        move = ease((local_time / duration - 0.10) / 0.52)
        x = start[0] + (end[0] - start[0]) * move
        y = start[1] + (end[1] - start[1]) * move - 20 * math.sin(math.pi * move)
        pulse = max(0.0, 1.0 - abs(local_time / duration - 0.73) / 0.11)
        draw_cursor(draw, x, y + (tile_y - TILE_Y), pulse)

    if index < 10:
        frame.putalpha(Image.new("L", (WIDTH, HEIGHT), round(255 * ease(index / 10))))
        underlay = Image.new("RGBA", (WIDTH, HEIGHT), PAPER + (255,))
        underlay.alpha_composite(frame)
        frame = underlay
    return frame.convert("RGB")


FRAME_COUNTS = [round(scene["duration"] * FPS) for scene in SCENES]
TOTAL_FRAMES = sum(FRAME_COUNTS)
command = [
    "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-", "-an",
    "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", str(OUT),
]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
try:
    frame_index = 0
    for scene_index, count in enumerate(FRAME_COUNTS):
        for local_index in range(count):
            image = render_frame(frame_index, scene_index, local_index / FPS)
            process.stdin.write(image.tobytes())
            frame_index += 1
        print(f"Rendered {scene_index + 1}/{len(SCENES)}: {SCENES[scene_index]['title']}", flush=True)
finally:
    process.stdin.close()

if process.wait() != 0:
    raise RuntimeError("ffmpeg failed to encode the demo video")
print(f"Saved {OUT} ({TOTAL_FRAMES / FPS:.1f}s)")
