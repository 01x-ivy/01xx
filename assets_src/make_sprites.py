# -*- coding: utf-8 -*-
"""程序化手绘像素素材：4 张食物 tile + 梦芝 Q 版立绘 + 梦芝照片像素化版本。
输出统一 NEAREST 放大、透明背景的 PNG 到 ../src/assets/。
"""
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "src", "assets"))
os.makedirs(OUT, exist_ok=True)

TILE = 32      # 食物逻辑像素
FOOD_SCALE = 3  # 导出 96x96
PORTRAIT_W, PORTRAIT_H = 48, 64
PORTRAIT_SCALE = 3   # 导出 144x192


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def px(d, x, y, c):
    d.point((x, y), fill=c)


def rect(d, x0, y0, x1, y1, c):
    d.rectangle([x0, y0, x1, y1], fill=c)


def ell(d, x0, y0, x1, y1, c, outline=None, width=1):
    d.ellipse([x0, y0, x1, y1], fill=c, outline=outline, width=width)


def line(d, pts, c, w=1):
    d.line(pts, fill=c, width=w)


def poly(d, pts, c, outline=None):
    d.polygon(pts, fill=c, outline=outline)


def save(img, scale, name):
    big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    path = os.path.join(OUT, name)
    big.save(path)
    print("saved", name, big.size)


# ---------- 0 鸡腿饭（KPRO 现烤鸡腿肉饭：白碗+烤鸡腿排+溏心蛋+紫米饭+青菜+圣女果） ----------
def draw_jitui():
    im = new(TILE, TILE); d = ImageDraw.Draw(im)
    BOWL = (232, 236, 240, 255); BOWL_D = (196, 204, 214, 255); RIM = (250, 252, 253, 255)
    # 碗体（上宽下窄）
    poly(d, [(3, 12), (29, 12), (26, 28), (6, 28)], BOWL)
    poly(d, [(3, 12), (29, 12), (28, 15), (4, 15)], RIM)
    # 碗内底阴影
    rect(d, 5, 14, 27, 24, (216, 222, 230, 255))
    # 紫米饭（右上）
    ell(d, 17, 12, 28, 21, (86, 52, 78, 255))
    for (x, y) in [(19,14),(22,13),(25,15),(20,17),(24,18),(27,16),(22,19)]:
        px(d, x, y, (120, 74, 104, 255))
    px(d, 23, 14, (150, 96, 128, 255))
    # 青菜（左下）
    ell(d, 5, 19, 13, 25, (46, 122, 58, 255))
    ell(d, 8, 18, 15, 24, (70, 158, 74, 255))
    line(d, [(6,23),(12,21)], (30, 92, 46, 255), 1)
    # 圣女果（左中）
    ell(d, 4, 15, 8, 19, (222, 62, 50, 255))
    px(d, 5, 16, (255, 130, 110, 255))
    # 笋片（左下浅黄）
    poly(d, [(6, 24), (10, 22), (12, 25), (8, 27)], (222, 206, 156, 255))
    # 溏心蛋（上中偏左，两半）
    ell(d, 9, 9, 16, 15, (250, 246, 232, 255))
    ell(d, 11, 10, 15, 14, (242, 158, 44, 255))
    ell(d, 17, 9, 23, 15, (250, 246, 232, 255))
    ell(d, 18, 10, 22, 14, (242, 158, 44, 255))
    # 烤鸡腿排（中间主体，斜切三片）
    CH = (176, 92, 40, 255); CH_L = (214, 132, 60, 255); CH_D = (128, 60, 28, 255); EDGE = (238, 206, 150, 255)
    poly(d, [(9, 16), (24, 15), (26, 18), (11, 20)], CH)
    poly(d, [(10, 19), (25, 18), (26, 22), (11, 24)], CH_L)
    poly(d, [(11, 23), (24, 22), (23, 26), (12, 27)], CH)
    # 烤纹
    line(d, [(12,17),(22,16)], CH_D, 1)
    line(d, [(13,20),(24,19)], CH_D, 1)
    line(d, [(13,24),(22,23)], CH_D, 1)
    # 边缘高光（皮下脂肪）
    line(d, [(11,20),(11,23)], EDGE, 1)
    line(d, [(24,18),(24,22)], EDGE, 1)
    # 碗沿高光
    line(d, [(5,13),(27,13)], (255,255,255,180), 1)
    rect(d, 6, 27, 26, 28, BOWL_D)
    return im


# ---------- 1 塔斯汀中国汉堡（现烤堡胚+生菜+鸡排+芝麻） ----------
def draw_burger():
    im = new(TILE, TILE); d = ImageDraw.Draw(im)
    # 阴影
    ell(d, 4, 26, 28, 30, (0, 0, 0, 40))
    BUN = (222, 158, 78, 255); BUN_L = (244, 196, 112, 255); BUN_D = (176, 112, 52, 255)
    # 上堡胚（圆顶）
    ell(d, 4, 7, 28, 19, BUN)
    # 顶部高光
    ell(d, 7, 9, 24, 15, BUN_L)
    # 芝麻
    for (x, y) in [(10,11),(14,9),(18,12),(22,10),(13,14),(20,15),(25,13)]:
        ell(d, x, y, x+1, y+1, (255, 244, 214, 255))
    # 底部边缘
    rect(d, 4, 16, 28, 17, BUN_D)
    # 生菜（波浪绿）
    LET = (94, 168, 62, 255); LET_D = (58, 120, 46, 255)
    poly(d, [(3, 17), (6, 19), (9, 17), (12, 20), (16, 17), (20, 20), (24, 17), (28, 19), (29, 22), (3, 22)], LET)
    for x in [5, 9, 13, 17, 21, 25]:
        px(d, x, 19, LET_D)
    # 鸡排/肉饼（棕）
    poly(d, [(4, 21), (28, 21), (27, 25), (5, 25)], (150, 78, 40, 255))
    line(d, [(6,22),(26,22)], (186, 108, 56, 255), 1)
    line(d, [(7,24),(25,24)], (110, 54, 30, 255), 1)
    # 番茄/酱
    rect(d, 5, 23, 27, 24, (206, 62, 44, 255))
    # 下堡胚
    poly(d, [(4, 25), (28, 25), (27, 28), (5, 28)], BUN)
    rect(d, 5, 27, 27, 28, BUN_D)
    line(d, [(6,26),(26,26)], BUN_L, 1)
    return im


# ---------- 2 煲仔仔（广荣发煲仔饭：砂锅+米饭+腊味+蛋+葱花） ----------
def draw_baozai():
    im = new(TILE, TILE); d = ImageDraw.Draw(im)
    POT = (176, 104, 60, 255); POT_L = (208, 138, 82, 255); POT_D = (128, 70, 40, 255)
    # 双耳
    rect(d, 1, 14, 5, 17, POT_D); rect(d, 27, 14, 31, 17, POT_D)
    rect(d, 2, 14, 4, 16, POT_L); rect(d, 28, 14, 30, 16, POT_L)
    # 锅体
    poly(d, [(4, 12), (28, 12), (26, 28), (6, 28)], POT)
    poly(d, [(4, 12), (28, 12), (27, 15), (5, 15)], POT_L)
    line(d, [(7, 16),(25, 16)], POT_D, 1)
    # 锅口内（米饭）
    ell(d, 6, 10, 26, 20, (240, 232, 210, 255))
    # 米饭颗粒
    for (x, y) in [(8,12),(11,11),(14,13),(18,11),(22,12),(24,14),(10,16),(15,17),(20,16),(23,18)]:
        px(d, x, y, (255, 250, 236, 255))
    # 腊味/腊肠（红棕圆片）
    for (cx, cy) in [(11, 14), (16, 13), (20, 15)]:
        ell(d, cx-2, cy-2, cx+2, cy+2, (150, 56, 44, 255))
        ell(d, cx-1, cy-1, cx+1, cy+1, (196, 92, 66, 255))
    # 溏心蛋（中间偏右，白+黄）
    ell(d, 15, 15, 23, 21, (250, 246, 232, 255))
    ell(d, 17, 16, 21, 20, (244, 170, 52, 255))
    # 青菜
    ell(d, 7, 17, 11, 20, (60, 138, 60, 255))
    # 葱花
    for (x, y) in [(9,19),(13,18),(22,18),(24,12),(12,12),(19,12),(8,15),(25,16)]:
        px(d, x, y, (86, 168, 72, 255))
    # 蒸汽
    line(d, [(13, 5),(12, 3),(14, 1)], (255, 255, 255, 150), 1)
    line(d, [(20, 6),(21, 4),(19, 2)], (255, 255, 255, 130), 1)
    # 锅底阴影
    rect(d, 7, 27, 25, 28, POT_D)
    return im


# ---------- 3 福鼎肉片（酸辣汤：白肉片+红椒+香菜+清汤） ----------
def draw_fuding():
    im = new(TILE, TILE); d = ImageDraw.Draw(im)
    BOWL = (236, 240, 244, 255); BOWL_D = (198, 208, 218, 255)
    poly(d, [(3, 12), (29, 12), (26, 28), (6, 28)], BOWL)
    poly(d, [(3, 12), (29, 12), (28, 15), (4, 15)], (252, 253, 255, 255))
    # 汤（红亮酸辣汤，和鸡腿饭的浅色系拉开区分）
    ell(d, 5, 13, 27, 24, (184, 82, 54, 255))
    ell(d, 6, 14, 26, 23, (206, 106, 70, 255))
    # 汤面红油光
    line(d, [(8,16),(14,15)], (240, 150, 100, 255), 1)
    line(d, [(19,20),(24,19)], (240, 150, 100, 255), 1)
    line(d, [(10,21),(15,21)], (228, 128, 86, 255), 1)
    # 肉片（灰白不规则薄片，在红汤上更醒目）
    MEAT = (246, 234, 220, 255); MEAT_D = (216, 196, 176, 255)
    poly(d, [(7, 16), (12, 15), (14, 18), (11, 20), (7, 19)], MEAT)
    poly(d, [(15, 17), (20, 16), (22, 19), (19, 21), (15, 20)], MEAT)
    poly(d, [(10, 21), (14, 20), (16, 23), (12, 24)], MEAT)
    line(d, [(8,17),(13,17)], MEAT_D, 1)
    line(d, [(16,18),(21,18)], MEAT_D, 1)
    # 红椒丝/辣油
    for (x, y) in [(9,15),(13,22),(21,16),(24,21),(17,22),(12,14)]:
        rect(d, x, y, x+2, y+1, (214, 66, 46, 255))
    # 香菜/葱花
    for (x, y) in [(6,18),(15,15),(23,18),(19,23),(26,16),(9,22)]:
        px(d, x, y, (74, 154, 66, 255))
    # 碗沿
    line(d, [(5,13),(27,13)], (255,255,255,190), 1)
    rect(d, 6, 27, 26, 28, BOWL_D)
    return im


# ---------- 梦芝 Q 版像素立绘（圆眼镜+白星星发夹+浅蓝系带上衣+双拳） ----------
def draw_mengzhi_chibi():
    W, H = PORTRAIT_W, PORTRAIT_H
    im = new(W, H); d = ImageDraw.Draw(im)
    SKIN = (250, 214, 186, 255); SKIN_S = (234, 190, 162, 255)
    HAIR = (46, 40, 52, 255); HAIR_L = (74, 64, 80, 255)
    SHIRT = (206, 228, 232, 255); SHIRT_S = (168, 202, 212, 255); SHIRT_D = (140, 178, 192, 255)
    RIBBON = (246, 240, 214, 255)
    GLASS = (176, 122, 84, 255); GLASS_L = (214, 168, 120, 255)
    STAR = (252, 252, 255, 255); STAR_E = (206, 216, 226, 255)
    # 阴影
    ell(d, 8, 58, 40, 63, (0, 0, 0, 35))
    # 头发后层（长发披肩）
    poly(d, [(10, 12), (14, 8), (34, 8), (38, 12), (40, 34), (38, 50), (34, 52), (14, 52), (10, 50), (8, 34)], HAIR)
    # 身体/上衣
    poly(d, [(12, 40), (36, 40), (40, 58), (40, 62), (8, 62), (8, 58)], SHIRT)
    poly(d, [(12, 40), (36, 40), (38, 50), (10, 50)], SHIRT_S)
    # 领口
    poly(d, [(20, 40), (28, 40), (24, 45)], (250, 246, 234, 255))
    # 系带
    line(d, [(24, 44),(24, 50)], RIBBON, 2)
    line(d, [(22, 45),(21, 55)], RIBBON, 1)
    line(d, [(26, 45),(27, 55)], RIBBON, 1)
    ell(d, 23, 42, 25, 44, RIBBON)
    # 双袖/手臂举起
    poly(d, [(8, 44), (13, 42), (12, 54), (7, 55)], SHIRT)
    poly(d, [(40, 44), (35, 42), (36, 54), (41, 55)], SHIRT)
    # 双拳（举起）
    ell(d, 6, 32, 14, 40, SKIN); ell(d, 34, 32, 42, 40, SKIN)
    # 拳头分指
    line(d, [(8, 34),(8, 37)], SKIN_S, 1); line(d, [(11, 34),(11, 37)], SKIN_S, 1)
    line(d, [(36, 34),(36, 37)], SKIN_S, 1); line(d, [(39, 34),(39, 37)], SKIN_S, 1)
    ell(d, 7, 33, 9, 35, (255, 230, 210, 255))
    ell(d, 39, 33, 41, 35, (255, 230, 210, 255))
    # 脸
    ell(d, 14, 14, 34, 38, SKIN)
    # 刘海
    poly(d, [(13, 20), (16, 12), (32, 12), (35, 20), (31, 17), (28, 20), (24, 16), (20, 20), (17, 17)], HAIR)
    # 鬓角
    poly(d, [(13, 18), (15, 18), (15, 36), (12, 34)], HAIR)
    poly(d, [(35, 18), (33, 18), (33, 36), (36, 34)], HAIR)
    # 圆框眼镜
    ell(d, 17, 22, 25, 30, None, GLASS, 1)
    ell(d, 25, 22, 33, 30, None, GLASS, 1)
    line(d, [(25, 26),(25, 26)], GLASS, 1)
    line(d, [(14, 25),(17, 25)], GLASS, 1)
    line(d, [(33, 25),(36, 25)], GLASS, 1)
    # 镜框高光
    ell(d, 18, 23, 20, 24, GLASS_L)
    ell(d, 26, 23, 28, 24, GLASS_L)
    # 眼睛
    ell(d, 20, 25, 22, 27, HAIR); ell(d, 28, 25, 30, 27, HAIR)
    px(d, 20, 25, (255, 255, 255, 255)); px(d, 28, 25, (255, 255, 255, 255))
    # 眉毛
    line(d, [(19, 22),(23, 22)], HAIR_L, 1); line(d, [(27, 22),(31, 22)], HAIR_L, 1)
    # 腮红
    ell(d, 16, 30, 19, 32, (244, 172, 164, 255))
    ell(d, 31, 30, 34, 32, (244, 172, 164, 255))
    # 微笑嘴
    line(d, [(23, 32),(24, 33),(26, 33),(27, 32)], (196, 108, 104, 255), 1)
    # 白色星星发夹（额前一排）
    def star(cx, cy, r):
        pts = []
        import math
        for i in range(10):
            ang = -math.pi/2 + i*math.pi/5
            rr = r if i % 2 == 0 else r*0.45
            pts.append((cx + rr*math.cos(ang), cy + rr*math.sin(ang)))
        poly(d, pts, STAR)
    star(19, 13, 4)
    star(27, 12, 3)
    star(33, 15, 2)
    star(15, 15, 2)
    # 头发高光
    line(d, [(16, 14),(20, 12)], HAIR_L, 1)
    line(d, [(30, 12),(33, 14)], HAIR_L, 1)
    return im


# ---------- 梦芝照片 -> 像素化版本（裁掉上下黑边，取人物区域） ----------
def pixelize_photo():
    src = os.path.join(HERE, "mengzhi.jpg")
    im = Image.open(src).convert("RGB")
    w, h = im.size
    # 人物主体：裁掉上下黑边与两侧，取肩部以上
    crop = im.crop((int(w*0.10), int(h*0.14), int(w*0.90), int(h*0.62)))
    # 缩到低分辨率再放大，形成像素块
    small = crop.resize((36, 48), Image.LANCZOS)
    # 轻微量化颜色，强化像素感
    q = small.quantize(colors=48, method=Image.MEDIANCUT).convert("RGBA")
    # 把近白背景去掉（透明化），保留人物
    data = q.getdata()
    out = []
    for (r, g, b, a) in data:
        if r > 238 and g > 238 and b > 238:
            out.append((0, 0, 0, 0))
        else:
            out.append((r, g, b, 255))
    q.putdata(out)
    return q


if __name__ == "__main__":
    save(draw_jitui(), FOOD_SCALE, "food_jitui.png")
    save(draw_burger(), FOOD_SCALE, "food_burger.png")
    save(draw_baozai(), FOOD_SCALE, "food_baozai.png")
    save(draw_fuding(), FOOD_SCALE, "food_fuding.png")
    save(draw_mengzhi_chibi(), PORTRAIT_SCALE, "mengzhi_chibi.png")
    photo = pixelize_photo()
    photo.resize((36*4, 48*4), Image.NEAREST).save(os.path.join(OUT, "mengzhi_photo_pixel.png"))
    print("saved mengzhi_photo_pixel.png", (36*4, 48*4))
    print("OUT =", OUT)
