"""Genere l'icone de l'app (build/icon.ico) : tuile arrondie bleu nuit, bordure
et monogramme 'S' cyan -- coherent avec le theme de l'app (cyan sur #0F1526).

Lance : python scripts/make-icon.py   (necessite Pillow)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 256
NAVY = (15, 21, 38, 255)      # #0F1526
CYAN = (34, 211, 238, 255)    # #22D3EE

root = Path(__file__).resolve().parent.parent
build = root / "build"
build.mkdir(exist_ok=True)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Tuile arrondie : fond bleu nuit + fine bordure cyan.
margin, radius = 10, 54
d.rounded_rectangle(
    [margin, margin, SIZE - margin, SIZE - margin],
    radius=radius, fill=NAVY, outline=CYAN, width=6,
)

# Monogramme "S" centre.
try:
    font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 168)
except OSError:
    font = ImageFont.load_default()

text = "S"
bbox = d.textbbox((0, 0), text, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
x = (SIZE - tw) / 2 - bbox[0]
y = (SIZE - th) / 2 - bbox[1]
d.text((x, y), text, font=font, fill=CYAN)

img.save(build / "icon.ico", format="ICO",
         sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
img.save(build / "icon.png")
print("icone ecrite ->", build / "icon.ico")
