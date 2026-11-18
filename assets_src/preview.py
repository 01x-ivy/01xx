# -*- coding: utf-8 -*-
"""把生成的素材拼到一张联系表上，方便肉眼验收。"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.normpath(os.path.join(HERE, "..", "src", "assets"))
files = ["food_jitui.png", "food_burger.png", "food_baozai.png", "food_fuding.png",
         "mengzhi_chibi.png", "mengzhi_photo_pixel.png"]
labels = ["jitui", "burger", "baozai", "fuding", "chibi", "photo"]

CW, CH = 200, 240
sheet = Image.new("RGBA", (CW*3, CH*2), (36, 27, 46, 255))
d = ImageDraw.Draw(sheet)
for i, (f, lab) in enumerate(zip(files, labels)):
    im = Image.open(os.path.join(A, f)).convert("RGBA")
    # 棋盘底衬托透明
    bg = Image.new("RGBA", im.size, (60, 48, 72, 255))
    for y in range(0, im.height, 12):
        for x in range(0, im.width, 12):
            if (x//12 + y//12) % 2 == 0:
                d2 = ImageDraw.Draw(bg)
                d2.rectangle([x, y, x+11, y+11], fill=(78, 62, 92, 255))
    bg.alpha_composite(im)
    col, row = i % 3, i // 3
    ox, oy = col*CW + (CW-im.width)//2, row*CH + 20
    sheet.alpha_composite(bg, (ox, oy))
    d.text((col*CW + 10, row*CH + 4), lab, fill=(246, 231, 193, 255))
out = os.path.join(HERE, "preview.png")
sheet.convert("RGB").save(out)
print("saved", out, sheet.size)
