# Beyfest fighter art: style guide

The look every starter fighter's **action cut-out** should match. It's based on
**The Buzzsaw** and **The Pugilist**, the two the user picked as the target.
The Joyzerker and the Torque Warden (both made in Gemini) are the examples of
what to avoid.

Victory images (belt overhead) and royale-victory images (trophy raised) are
shared templates by design and are covered at the end.

---

## 1. The look

**Overall:** modern anime "splash art", like a fighting-game or gacha character
card. Bright and polished, but clearly **hand-drawn and inked**, not gritty and
not smooth. The approved Breycist (`approved/breycist.png`) is the worked example.

| Element | Do (Pugilist / approved Breycist) | Avoid |
|---|---|---|
| Line art | Confident black ink lines whose weight varies like a pen or brush, thicker on the outer contour; fine interior lines | Even, uniform outlines (the "filter" look); Western comic inking with scratchy edges (Gemini pair) |
| Shading | Crisp cel-shadow shapes in 2–3 tones, plus sharp-edged specular highlights on skin, hair and gear | Soft airbrushed gradients and blur (the "filter" look); heavy cross-hatching and muddy shadows (Gemini pair) |
| Faces | Adult men with anime-leaning but grounded proportions; real features kept (beards, glasses, hairline); ink lines inside the face (creases, cheekbones, laugh lines); an **exaggerated** expression that fits the character | A realistic, natural expression; a smooth, line-free face; every face defaulting to the same toothy grin; face paint or split-colour skin |
| Hair | Many inked strands and clumps, varied colour, bright highlights on the tips | One smooth filled shape |
| Bodies | Athletic, slightly heroic, believable build for the person | Over-muscled bodybuilder exaggeration |
| Clothes | The person's real-world style (T-shirt and jeans, tracksuit, coat), with stylised trim in their colours | Generic costume that loses the person |
| Colour | One **signature palette** per fighter, carried through clothes, launcher, Beyblade and glow | Colour spilling onto skin and hair |
| Beyblade | The brightest thing in the image: a glowing, motion-blurred spin vortex with light trails and sparks in the signature colours | A flat, grey or barely-spinning top |
| Energy | Light trails and sparks around the Beyblade and the launch | Smoke clouds, paint splatter, or ground-impact bursts that fill the frame |

### Why faces of real people look "uncanny", and the fix

Learned the hard way on the Breycist (versions C to M2 in `prompts/breycist.md`):

- **A real person's natural expression, painted in anime style, looks like a filter
  over a photo.** Removing detail doesn't fix it; that only makes it worse (version H).
- **Fix 1, rendering:** the face needs hand-drawn ink detail like the Pugilist's:
  strand detail in the hair, crease and cheekbone lines, sharp skin highlights,
  varied line weight. Fine ink detail is wanted; heavy comic cross-hatching is not.
- **Fix 2, expression:** exaggerate it, anime-style, well past what a real face does:
  the Pugilist's huge laugh, the Breycist's lopsided smirk with one brow cocked.
  A serious fighter gets a fierce scowl, not a neutral stare.
- **Likeness survives exaggeration.** Caricature the person's distinctive features
  (the Breycist's round cheeks) and they read as that person even more.

## 2. Composition

- **Format:** 1536 × 1024 landscape (3:2). The Gemini images are 1264 × 843, which
  is too small.
- **Framing:** the character and Beyblade fill the frame. Cropping at the thighs or
  knees is fine; heads and Beyblades must not be cut off.
- **Face:** clearly visible, roughly in the **upper half**, angled to the front or
  three-quarter view. The app finds faces automatically (`scripts/find-faces.py`,
  YuNet) to crop around them, so nothing large may cover the face. Glasses and
  sunglasses are fine; the Pugilist's are detected.
- **Must include:** the launcher, the ripcord and the Beyblade (see the hands rule below).
- **The launch moment:** every action pose catches the launch itself, with the cord
  being ripped and the Beyblade just leaving the launcher or already spinning away.
  Not before it, not long after.
- **Pose:** unique per fighter, from the pose plan, and suited to their personality.
  The fist-punched-at-camera lunge is retired as a default; only the Pugilist keeps it.
- **Expression:** set per fighter in the pose plan, always exaggerated. Smiling is
  not the default.

### Hands, launcher and ripcord

ChatGPT keeps getting this wrong, so it's spelled out:

- **One hand holds the launcher. The other hand holds the ripcord.** Nothing else in
  either hand.
- **The ripcord is a plain cord** that runs from the launcher to the pulling hand
  and ends in that hand. **No handle, grip, ring, weight or ornament** on its end.
- **Nothing connects the Beyblade to the launcher** once it's launched: no string,
  cord, tether or beam. The Beyblade spins free.
- **One launcher, one ripcord, one Beyblade.** No extra cords.
- **The exception is the Cheatseeker:** rule book in one hand, launcher in the other.
- A small grip where the cord meets the fingers was accepted on the Breycist.

## 3. Hard technical rules

- **Transparent background.** No scenery, floor, or vignette.
- **Clean alpha.** No semi-transparent haze around the figure (the Buzzsaw cut-out
  has a dark halo of partly transparent pixels), no speckle noise at the edges
  (Pugilist), and no leftover rectangle border (both Gemini images).
- **No lettering or numbers** on clothes, launchers or props. Screens mirror
  cut-outs with `scaleX(-1)`, so text reads backwards. This is why the Cheatseeker
  and the Torque Warden needed hand-made mirror images. Emblems must be symmetric.
  The two approved exceptions are the Cheatseeker's "RULE BOOK" and the Torque
  Warden's "T.W" badge. Each new version of those two gets a hand-made mirror
  image (`scripts/unflip-text.py`).
- **One person, no extra limbs or launchers.** Hands holding the launcher and
  ripcord should be checked closely.

## 4. Reusable style block for prompts

Paste this into every action-pose prompt, unchanged:

> Anime splash-art illustration of a Beyblade fighter, in the style of a modern
> fighting-game character card. It must look hand-drawn and inked, not like a
> filter over a smooth render: hair as many inked strands and clumps with bright
> highlights on the tips; visible ink lines inside the face (brow creases,
> cheekbones, laugh lines, the folds of the mouth); sharp-edged specular highlights
> on the skin and crisp cel-shadow shapes; line weight that varies like a pen,
> thicker on the outer contour; the same detail on clothing folds and the launcher.
> Fine hand-drawn line detail, but no heavy comic-book cross-hatching, no airbrushed
> gradients, no soft blur. Bright, saturated finish. Adult man with grounded anime
> proportions and a big, exaggerated anime expression, never a realistic one.
> Signature colour palette: [PALETTE], used on clothing trim, launcher, Beyblade and
> energy effects, but not on skin or hair. The Beyblade spins in a glowing,
> motion-blurred vortex with light trails and sparks: the brightest element in the
> image. Its centre is plain, with no crest, flag, logo or emblem. One hand holds
> the launcher; the other hand holds a plain ripcord that ends in his fingers, with
> no handle, grip or ring on its end. Nothing connects the Beyblade to the launcher:
> no string, cord or tether. Exactly one launcher, one ripcord and one Beyblade.
> Landscape 3:2, character and Beyblade fill the frame, face clearly visible in the
> upper half. Transparent background, no scenery, no floor, no vignette. No text,
> letters or numbers anywhere; emblems symmetric.

For the Cheatseeker, swap the hands sentence for: "One hand holds the launcher; the
other hand holds up the rule book. No ripcord."

**Expression:** say it in the pose part of the prompt, name the mouth, eyes and
brows, and say how far to push it: "as exaggerated as image 3's laugh, not a
realistic smile". For the Breycist: "a lopsided smirk pulled up hard on one side,
one eyebrow raised high, eyes half-lidded".

**Likeness:** put the anchors that drift in the same sentence as the style:
"hand-drawn anime, but with his broad round face, full cheeks, fair skin…". Without
that, faces drift lean, angular and tanned.

**One chat per image.** A second image in the same ChatGPT chat copies the first
one's camera angle and framing. Start a new chat and attach the references again.
Small fixes (face shape, expression) work as edits in the same chat; big changes
need a new chat, because long edit chains drift.

### Attachments that worked (approved Breycist)

1. A pose reference (an earlier version with the right pose), labelled "copy the
   pose, framing and outfit, NOT the rendering".
2. `pugilist.png` as the **style reference** ("match the rendering; don't copy his
   face, glasses, beard or outfit").
3. A full-resolution **close-up of the Pugilist's head**, so the line and texture
   detail is visible (`reference-photos/breycist/upload/1b-style-pugilist-face.png`).
4. Two photos of the person, cropped to them alone, "for likeness only".

## 5. Victory and royale-victory images

These are shared templates: the same arena, the same belt or trophy, the same
heroic angle from below. That's intentional and stays. Rules:

- The fighter's face, hair, outfit and palette must match their action cut-out.
- If a fighter is redesigned, **both** victory images get regenerated to match.
- Use the existing victory image as the template reference and the new action
  cut-out as the character reference.

## 6. Review checklist (per image)

1. Style: put the face next to the Pugilist's at full size. Inked hair strands,
   face lines, sharp highlights, varied line weight? Or smooth and airbrushed
   (the filter look)? Expression exaggerated, not realistic?
2. Likeness: every item on the fighter's likeness sheet present?
3. Pose: matches the plan and differs from every other fighter's?
4. Palette: right colours, kept off skin and hair?
5. Hands: launcher in one, plain ripcord in the other, nothing on the cord's end,
   no cord between Beyblade and launcher, no extras? Fingers correct?
6. Caught at the launch moment? Expression as planned?
7. No lettering, including the Beyblade's centre; still looks right mirrored?
8. Transparent background with clean edges and no halo? (ChatGPT's website does
   transparent backgrounds fine. A preview may show the transparent area as dark,
   so check the alpha, not the preview.) **Check again after every edit:** an
   edit can quietly flatten the background to solid colour. ChatGPT's **Remove BG**
   button in the image viewer cuts it out again cleanly.
9. Face found by `find-faces.py`?
