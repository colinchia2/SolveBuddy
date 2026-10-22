# Read a Star Battle screenshot (thick region borders, red x marks, black stars) into regions + marks.
# Usage: python -I read_starbattle.py <image> <n>
import sys, json
import numpy as np
from PIL import Image

path, n = sys.argv[1], int(sys.argv[2])
img = np.asarray(Image.open(path).convert("RGB")).astype(int)
R, G, B = img[..., 0], img[..., 1], img[..., 2]
dark = (R < 90) & (G < 90) & (B < 90)
red = (R > 150) & (G < 90) & (B < 90)

# The board's outer frame: the bounding box of dark pixels' long runs.
rows_dark = dark.sum(1); cols_dark = dark.sum(0)
ys = np.where(rows_dark > dark.shape[1] * 0.5)[0]; xs = np.where(cols_dark > dark.shape[0] * 0.5)[0]
top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
cw = (right - left) / n; ch = (bottom - top) / n
xline = [left + cw * i for i in range(n + 1)]; yline = [top + ch * i for i in range(n + 1)]

def thickness_v(x, y0, y1):
    # dark run width across a vertical line at x, sampled over the middle of the segment
    ws = []
    for y in np.linspace(y0 + (y1 - y0) * 0.3, y0 + (y1 - y0) * 0.7, 7).astype(int):
        xi = int(round(x)); w = 0
        for dx in range(-8, 9):
            if 0 <= xi + dx < dark.shape[1] and dark[y, xi + dx]: w += 1
        ws.append(w)
    return np.median(ws)

def thickness_h(y, x0, x1):
    ws = []
    for x in np.linspace(x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7, 7).astype(int):
        yi = int(round(y)); w = 0
        for dy in range(-8, 9):
            if 0 <= yi + dy < dark.shape[0] and dark[yi + dy, x]: w += 1
        ws.append(w)
    return np.median(ws)

vt = [[thickness_v(xline[c + 1], yline[r], yline[r + 1]) for c in range(n - 1)] for r in range(n)]
ht = [[thickness_h(yline[r + 1], xline[c], xline[c + 1]) for c in range(n)] for r in range(n - 1)]
allw = sorted([w for row in vt for w in row] + [w for row in ht for w in row])
cut = (min(allw) + max(allw)) / 2  # thin vs thick

# Flood-fill regions across thin borders.
lab = [[None] * n for _ in range(n)]; nxt = 0
for r in range(n):
    for c in range(n):
        if lab[r][c] is not None: continue
        stack = [(r, c)]; lab[r][c] = nxt
        while stack:
            a, b = stack.pop()
            for da, db, wall in [(0, 1, lambda a, b: vt[a][b] if b < n - 1 else 99), (0, -1, lambda a, b: vt[a][b - 1] if b > 0 else 99),
                                 (1, 0, lambda a, b: ht[a][b] if a < n - 1 else 99), (-1, 0, lambda a, b: ht[a - 1][b] if a > 0 else 99)]:
                if wall(a, b) > cut: continue
                x, y = a + da, b + db
                if 0 <= x < n and 0 <= y < n and lab[x][y] is None:
                    lab[x][y] = nxt; stack.append((x, y))
        nxt += 1
letters = "ABCDEFGHIJKL"
regions = ["".join(letters[lab[r][c]] for c in range(n)) for r in range(n)]

# Marks: red pixels in the cell = x; lots of dark pixels in the cell centre = star.
marks = {}
for r in range(n):
    for c in range(n):
        y0, y1 = int(yline[r] + ch * 0.25), int(yline[r] + ch * 0.75); x0, x1 = int(xline[c] + cw * 0.25), int(xline[c] + cw * 0.75)
        area = (y1 - y0) * (x1 - x0)
        if red[y0:y1, x0:x1].sum() > area * 0.04: marks[f"{r},{c}"] = 1
        elif dark[y0:y1, x0:x1].sum() > area * 0.15: marks[f"{r},{c}"] = 2
print(json.dumps({"regions": regions, "marks": marks, "count": nxt, "cut": cut, "minmax": [min(allw), max(allw)]}))
