"""Finds the face in each starting fighter's cut-out and writes it into
web/static/starter-fighters/fighters.json as "face": {"x", "y", "h"}: the
face's centre and height, as fractions of the image's width and height (see
web/src/lib/fighters.ts). Screens that crop the cut-out keep the face in view.

It uses YuNet, OpenCV's small face detector. It does better on these
painted fighters than the anime-face cascades do: in testing it found the
right face first on all 12 starters. The model (~230 KB) is downloaded on
first use.

Setup, once (any folder; OpenCV 5 dropped the face detector API this uses):
    python -m venv .venv
    .venv/Scripts/pip install "opencv-python-headless<5" numpy

Then, from tournament-app/:
    .venv/Scripts/python scripts/find-faces.py           # only fighters without a face
    .venv/Scripts/python scripts/find-faces.py --all     # redo every one
    .venv/Scripts/python scripts/find-faces.py --sheet faces.jpg   # contact sheet to check by eye

Starters already in an event's library get the face from "Add starting
fighters" on the Fighters page (it fills in missing details). A wrong one can
be fixed there by clicking the face.
"""

import argparse
import json
import os
import sys
import urllib.request

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
STARTERS = os.path.join(HERE, "..", "web", "static", "starter-fighters")
MODEL_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
MODEL = os.path.join(os.path.expanduser("~"), ".cache", "beyfest", "face_detection_yunet_2023mar.onnx")


def model_path() -> str:
    if not os.path.exists(MODEL):
        os.makedirs(os.path.dirname(MODEL), exist_ok=True)
        print(f"Downloading the face model to {MODEL}")
        urllib.request.urlretrieve(MODEL_URL, MODEL)
    return MODEL


def load(path: str) -> np.ndarray:
    """The image as BGR, with any transparency flattened onto mid grey (the
    detector doesn't do alpha, and black would hide dark hair)."""
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"can't read {path}")
    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.shape[2] == 4:
        a = img[:, :, 3:4] / 255.0
        img = (img[:, :, :3] * a + 128 * (1 - a)).astype(np.uint8)
    return img


def find_face(img: np.ndarray, model: str):
    """The most confident face as (score, x, y, w, h) in pixels, or None.
    Tried at two sizes: the faces here are between a tenth and a third of the
    picture's height, and YuNet likes them big but not huge."""
    h, w = img.shape[:2]
    best = None
    for size in (640, 1024):
        small = cv2.resize(img, (size, round(size * h / w)))
        det = cv2.FaceDetectorYN.create(model, "", (small.shape[1], small.shape[0]), 0.5, 0.3, 50)
        _, faces = det.detect(small)
        for f in faces if faces is not None else []:
            k = w / size
            hit = tuple(float(v) for v in (f[14], f[0] * k, f[1] * k, f[2] * k, f[3] * k))
            if best is None or hit[0] > best[0]:
                best = hit
    return best


def one_line(v) -> str:
    """JSON on one line, objects spaced { "like": "this" } as the file is."""
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{json.dumps(k)}: {one_line(x)}" for k, x in v.items()) + " }"
    return json.dumps(v, ensure_ascii=False)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--all", action="store_true", help="redo fighters that already have a face")
    ap.add_argument("--sheet", help="also save a contact sheet with the faces boxed, to check by eye")
    args = ap.parse_args()

    model = model_path()
    list_path = os.path.join(STARTERS, "fighters.json")
    with open(list_path, encoding="utf-8") as fh:
        starters = json.load(fh)

    tiles = []
    changed = 0
    for s in starters:
        if not s.get("image"):
            continue
        img = load(os.path.join(STARTERS, s["image"]))
        ih, iw = img.shape[:2]
        if s.get("face") and not args.all:
            face = s["face"]
        else:
            hit = find_face(img, model)
            if not hit:
                print(f"{s['name']}: no face found; set it on the Fighters page")
                continue
            score, x, y, w, h = hit
            face = {"x": round((x + w / 2) / iw, 3), "y": round((y + h / 2) / ih, 3), "h": round(h / ih, 3)}
            print(f"{s['name']}: {face} (confidence {score:.2f})")
            if s.get("face") != face:
                s["face"] = face
                changed += 1
        if args.sheet:
            cx, cy, r = face["x"] * iw, face["y"] * ih, face["h"] * ih / 2
            cv2.circle(img, (round(cx), round(cy)), round(r), (0, 215, 255), max(4, iw // 200))
            tile = cv2.resize(img, (480, 320))
            cv2.putText(tile, s["name"], (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
            tiles.append(tile)

    if changed:
        # One starter per line, as the file is laid out by hand.
        lines = ",\n".join("  " + one_line(s) for s in starters)
        with open(list_path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write("[\n" + lines + "\n]\n")
        print(f"Wrote {changed} face(s) to {os.path.relpath(list_path)}")
    else:
        print("No changes.")

    if args.sheet and tiles:
        while len(tiles) % 4:
            tiles.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(tiles[i : i + 4]) for i in range(0, len(tiles), 4)]
        cv2.imwrite(args.sheet, np.vstack(rows))
        print(f"Contact sheet: {args.sheet}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
