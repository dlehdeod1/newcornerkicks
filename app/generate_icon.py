"""킥킥 앱 아이콘 생성 스크립트 v3 — 축구공만, 텍스트 없음"""
from PIL import Image, ImageDraw
import math

SIZE = 1024
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 배경: 초록 그라데이션
for y in range(SIZE):
    t = y / SIZE
    r = int(38 + (22 - 38) * t)
    g = int(195 + (170 - 195) * t)
    b = int(105 + (80 - 105) * t)
    draw.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

# 축구공 — 중앙, 크게
cx, cy = SIZE // 2, SIZE // 2
ball_r = SIZE * 0.34

# 공 그림자
shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.ellipse(
    [cx - ball_r * 0.75, cy + ball_r * 0.88, cx + ball_r * 0.75, cy + ball_r * 1.1],
    fill=(0, 40, 0, 40)
)
img = Image.alpha_composite(img, shadow)
draw = ImageDraw.Draw(img)

# 공 본체
draw.ellipse(
    [cx - ball_r, cy - ball_r, cx + ball_r, cy + ball_r],
    fill=(255, 255, 255, 250)
)

# 공 하이라이트 (좌상단 빛 반사)
hl = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
hl_draw = ImageDraw.Draw(hl)
hlx, hly = cx - ball_r * 0.28, cy - ball_r * 0.28
hl_r = ball_r * 0.4
hl_draw.ellipse([hlx - hl_r, hly - hl_r, hlx + hl_r, hly + hl_r], fill=(255, 255, 255, 70))
img = Image.alpha_composite(img, hl)
draw = ImageDraw.Draw(img)

# 오각형 함수
def draw_pentagon(d, cx, cy, r, fill, outline=None, width=0):
    points = []
    for i in range(5):
        angle = math.radians(-90 + i * 72)
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    d.polygon(points, fill=fill, outline=outline, width=width)
    return points

# 중앙 오각형
pent_r = ball_r * 0.24
center_pts = draw_pentagon(draw, cx, cy, pent_r, fill=(40, 45, 55, 220), outline=(30, 35, 45, 200))

# 주변 오각형 5개
outer_pentagons = []
for i in range(5):
    angle = math.radians(-90 + i * 72)
    px = cx + ball_r * 0.58 * math.cos(angle)
    py = cy + ball_r * 0.58 * math.sin(angle)
    pts = draw_pentagon(draw, px, py, pent_r * 0.72, fill=(55, 60, 72, 185), outline=(45, 50, 60, 160))
    outer_pentagons.append((px, py, pts))

# 연결선: 중앙 꼭짓점 → 바깥 오각형 중심
line_color = (70, 75, 85, 110)
for i in range(5):
    draw.line([center_pts[i], (outer_pentagons[i][0], outer_pentagons[i][1])], fill=line_color, width=4)

# 연결선: 바깥 오각형 꼭짓점 → 공 가장자리 방향
for i in range(5):
    opx, opy, opts = outer_pentagons[i]
    for j in [1, 4]:  # 바깥쪽 꼭짓점 2개
        vx, vy = opts[j]
        edge_angle = math.atan2(vy - cy, vx - cx)
        ex = cx + ball_r * 0.93 * math.cos(edge_angle)
        ey = cy + ball_r * 0.93 * math.sin(edge_angle)
        draw.line([(vx, vy), (ex, ey)], fill=(90, 95, 105, 80), width=3)

# 공 테두리 (미세)
draw.ellipse(
    [cx - ball_r, cy - ball_r, cx + ball_r, cy + ball_r],
    outline=(200, 205, 210, 60), width=2
)

# 저장
img.save("assets/icon/app_icon.png", "PNG")
print(f"Icon saved: assets/icon/app_icon.png ({SIZE}x{SIZE})")

# Foreground (투명 배경)
fg = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
fd = ImageDraw.Draw(fg)
fd.ellipse([cx - ball_r, cy - ball_r, cx + ball_r, cy + ball_r], fill=(255, 255, 255, 250))
center_pts2 = draw_pentagon(fd, cx, cy, pent_r, fill=(40, 45, 55, 220), outline=(30, 35, 45, 200))
outers2 = []
for i in range(5):
    angle = math.radians(-90 + i * 72)
    px = cx + ball_r * 0.58 * math.cos(angle)
    py = cy + ball_r * 0.58 * math.sin(angle)
    pts = draw_pentagon(fd, px, py, pent_r * 0.72, fill=(55, 60, 72, 185), outline=(45, 50, 60, 160))
    outers2.append((px, py, pts))
for i in range(5):
    fd.line([center_pts2[i], (outers2[i][0], outers2[i][1])], fill=line_color, width=4)
for i in range(5):
    opx, opy, opts = outers2[i]
    for j in [1, 4]:
        vx, vy = opts[j]
        edge_angle = math.atan2(vy - cy, vx - cx)
        ex = cx + ball_r * 0.93 * math.cos(edge_angle)
        ey = cy + ball_r * 0.93 * math.sin(edge_angle)
        fd.line([(vx, vy), (ex, ey)], fill=(90, 95, 105, 80), width=3)
fg.save("assets/icon/app_icon_foreground.png", "PNG")
print("Foreground saved")
