# The Torque Warden: prompts

Redesign of the Gemini original, 2026-10-28. **Approved: `approved/torquewarden.png`**
(a copy of `candidates/torquewarden-C.png`). 1536×1024, transparent, face found at
0.91. Not yet in the app, and the "T.W" badge's hand-made mirror image isn't made yet.

## Attachments (new chat)

From `reference-photos/torquewarden/upload/`: `1-style-pugilist.png`,
`1b-style-pugilist-face.png`, `2-photo-front.jpg` and `3-photo-beard.jpg` (cropped to
Moss alone). The user's poster (`5-concept-poster.jpg`) set the camera and pose for B.

## Versions

| Version | How | Result |
|---|---|---|
| A | New chat: style + likeness + "stands perfectly still… NOT a fist toward the camera" | Good likeness and finish; the user said he looked bored, and wanted a lower camera like the poster |
| B | Edit of A: deep, wide crouch, launching down into the floor, floor-level camera; a focused "final-boss" stare | Right pose and face; beard too long and rounded |
| C | Edit of B: beard shorter (top of chest) and angular (squared-off, flat bottom) | **Approved** |

## What worked

- **Neutral without bored:** "neutral and unsmiling, but not bored: intensely focused
  and steely, eyes wide open and sharp, locked on the viewer, brows drawn down hard…
  the cold, unshakable stare of a man who knows he's already won."
- **Camera:** "very low, almost at floor level, looking slightly up at him over the
  Beyblade, so he towers over the frame."
- **Black outfit on a dark TV:** steel-silver trim on the coat plus a silver-white
  spark vortex keeps him readable.

## Left as is

- A small, symmetric crown in the Beyblade's centre.
- Cracked floor rubble along the bottom edge, which gives the launch some weight.

## Badge mirror image (2026-10-28)

`approved/torquewarden-mirrored.png`, made with
`scripts/unflip-text.py … 935 346 941 428 32` (the shield's up axis in the new art).
The plain flip reads "W.T"; the fixed one reads "T.W" with no visible seam. The royale
lab with 8 fighters puts him on the flipped side and uses it.

## Victory images (2026-10-28): approved

Same recipe as the others: a new chat with the old victory image (scene template),
`approved/torquewarden.png` (character) and the Pugilist head close-up (rendering).
Both came out right first time.

- The attachments landed in a different order, so the prompt named each image by
  what it shows ("THE ARENA IMAGE…", "THE CUT-OUT ILLUSTRATION…") rather than by
  position. That's the safer way to write these prompts.
- Expression: "not smiling: a fierce, triumphant roar with the mouth open", which
  suits his stern character better than a grin.
- Victory images are never flipped, so the T.W badge on them needs no mirror image.
