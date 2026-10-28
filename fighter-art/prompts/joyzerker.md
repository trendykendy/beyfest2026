# The Joyzerker: prompts

Redesign of the Gemini original, 2026-10-28. **Approved: `approved/joyzerker.png`**
(a copy of `candidates/joyzerker-F-transparent.png`). 1536×1024, transparent, face
found at 0.89. Not yet in the app.

## Attachments (new chat)

From `reference-photos/joyzerker/upload/`: `1b-style-pugilist-face.png`,
`1-style-pugilist.png`, and three photos of Vhar cropped to him alone
(`2-photo-front-smile.jpg`, `3-photo-laugh.jpg`, `4-photo-front.jpg`). No pose
reference, since there was no earlier approved version.

## Versions

| Version | How | Result |
|---|---|---|
| A | New chat: style block + likeness text + arms-wide launch pose | Good face and style, but fell back to the fist-at-camera lunge |
| B | Edit of A: "NOT a fist toward the camera… both arms flung wide" | Right pose; the user said the face was "too real, like a filter", and it was missing his joy/rage split |
| C | Edit of B: more stylised + split face, following the user's poster | Split face worked, but only on the face and not centred |
| D | Edit of C: split centred, continued down the whole body | Clothes still mostly black |
| E1, E2 | Edit of D: green/purple as the dominant colour of each half | E1 picked; **both had a grey checkerboard painted in** (RGB, no alpha) |
| F | Remove BG on E1 | **Approved**: same picture, real transparency |

## What worked

- **Split face and body, from the user's poster** (`5-concept-poster.jpg`). Ask for:
  the split "exactly down the vertical centre line: between the eyes, down the
  middle of the nose, mouth and beard", continued "through the neck, the middle of
  the T-shirt and down between the legs". Name what goes on each side.
- **Dominant colours:** "mainly bright green (several shades), black only as trim,
  seams and shadow"; the same for purple.
- **A pose fix by negation:** "must NOT be a fist punched toward the camera" plus a
  concrete description of where each hand is in the frame.

## Lessons

- Without a pose reference, ChatGPT reaches for the fist-at-camera lunge. Say no to
  it explicitly in the first prompt.
- Photos give a strong likeness on the first try; the face then needs pushing toward
  anime ("bigger expressive eyes, simplified nose and mouth, bold clumps").
- After any edit, check the file for real alpha: a grey checkerboard can be painted in.

## Victory images (2026-10-28): approved

Same recipe as the Breycist: a new chat with the old victory image (scene template),
`approved/joyzerker.png` (character) and the Pugilist head close-up (rendering). The
prompt spelled out the split (centre line, which colour and eye goes on each half)
and asked for the big screens to show the split face too.

- **Belt (`approved/victory-joyzerker.png`):** first try. The arms stayed rather
  muscular from the old template.
- **Royale (`approved/royale-victory-joyzerker.png`):** first try, with "heavy-set,
  thick arms, no visible veins". The split stops at the waist (plain black trousers)
  and the purple-side arm isn't shaded purple; the user accepted it.

The attachments were sent once without a prompt; that's harmless, since the prompt
can follow as the next message ("the three images above, in order…").
