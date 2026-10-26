"""Mirror a cut-out, then turn one patch of lettering back so it reads right.

In the mirrored picture, each pixel of the patch is taken from the original
reflected across the lettering's own up axis (a line through two points on
the cover). Two reflections = the lettering un-mirrored but still lying at
the cover's (mirrored) angle. A feathered band along the axis blends it in.

Needs OpenCV, as scripts/find-faces.py does. The result goes in
web/static/starter-fighters/ and is named as the starter's "imageMirrored"
in fighters.json (see the imageMirrored field, migration 1710001900).

usage: unflip-text.py in.png out.png ax ay bx by halfwidth [preview.png]
  (ax, ay) -> (bx, by): the lettering's up axis in the ORIGINAL picture,
  top to bottom; halfwidth: how far either side of the axis to fix (px).

The Cheatseeker's "RULE BOOK" (its crest is left mirrored; the hand covers
part of it, and it reads fine either way):
  python scripts/unflip-text.py web/static/starter-fighters/cheatseeker.png     web/static/starter-fighters/cheatseeker-mirrored.png 1010 55 1057 180 55
"""
import sys
import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
ax, ay, bx, by, half = map(float, sys.argv[3:8])
O = cv2.imread(src, cv2.IMREAD_UNCHANGED)
H, W = O.shape[:2]
F = O[:, ::-1].copy()  # the plain mirror image

# Unit vector along the axis, and its normal.
d = np.array([bx - ax, by - ay])
length = np.linalg.norm(d)
d /= length
n = np.array([-d[1], d[0]])

# For every output pixel p: q = where the mirror took it from in the original;
# s = q reflected across the axis line.
ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
qx, qy = (W - 1) - xs, ys
rx, ry = qx - ax, qy - ay
along = rx * d[0] + ry * d[1]
across = rx * n[0] + ry * n[1]
sx = ax + along * d[0] - across * n[0]
sy = ay + along * d[1] - across * n[1]
fixed = cv2.remap(O, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

# The band to replace: within `half` of the axis, between its two ends,
# feathered over 10 px so there's no seam.
feather = 10.0
side = np.clip((half - np.abs(across)) / feather, 0, 1)
ends = np.clip(np.minimum(along, length - along) / feather, 0, 1)
m = (side * ends)[..., None]
res = (fixed.astype(np.float32) * m + F.astype(np.float32) * (1 - m)).round().astype(np.uint8)
cv2.imwrite(out, res)

if len(sys.argv) > 8:
    # Before/after of the book, on grey, side by side.
    def flat(img):
        a = img[:, :, 3:4] / 255.0
        return (img[:, :, :3] * a + 128 * (1 - a)).astype(np.uint8)
    x0, x1 = int(W - 1 - max(ax, bx) - half * 2.5), int(W - 1 - min(ax, bx) + half * 2.5)
    y0, y1 = max(0, int(min(ay, by) - half * 1.5)), int(max(ay, by) + half * 2.5)
    a, b = flat(F)[y0:y1, x0:x1], flat(res)[y0:y1, x0:x1]
    k = 500 / a.shape[0]
    a, b = (cv2.resize(t, None, fx=k, fy=k) for t in (a, b))
    cv2.imwrite(sys.argv[8], np.hstack([a, np.full((a.shape[0], 8, 3), 255, np.uint8), b]))
