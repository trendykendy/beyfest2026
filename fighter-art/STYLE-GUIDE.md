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
card. Polished, bright and clean, not gritty.

| Element | Do (Buzzsaw / Pugilist) | Avoid (Joyzerker / Torque Warden) |
|---|---|---|
| Line art | Clean, confident black outlines of even medium weight; thinner lines for interior detail | Western comic inking, scratchy or sketchy edges, heavy outlines on everything |
| Shading | Cel shading in 2–3 tone steps, plus soft gradient highlights (e.g. the shine on a bald head) | Cross-hatching, ink texture, muddy and desaturated shadows |
| Faces | Adult men with anime-leaning but grounded proportions; real features kept (beards, glasses, hairline); an expression that fits the character (not everyone smiles: the Torque Warden is stern) | Every face defaulting to the same toothy grin, face paint or split-colour skin, a heavy brow hiding the eyes |
| Bodies | Athletic, slightly heroic, believable build for the person | Over-muscled bodybuilder exaggeration |
| Clothes | The person's real-world style (T-shirt and jeans, tracksuit, coat), with stylised trim in their colours | Generic costume that loses the person |
| Colour | One **signature palette** per fighter, carried through clothes, launcher, Beyblade and glow | Colour spilling onto skin and hair |
| Beyblade | The brightest thing in the image: a glowing, motion-blurred spin vortex with light trails and sparks in the signature colours | A flat, grey or barely-spinning top |
| Energy | Light trails and sparks around the Beyblade and the launch | Smoke clouds, paint splatter, or ground-impact bursts that fill the frame |

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
- **Expression:** set per fighter in the pose plan. Smiling is not the default.

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
  The fist-punched-at-camera lunge is retired as a default; at most **one** fighter
  keeps it.

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
> fighting-game character card. Clean, confident black outlines of even weight;
> cel shading with 2–3 tone steps and soft gradient highlights; bright, saturated,
> polished finish. No cross-hatching, no comic-book ink texture, no gritty or
> muddy shading. Adult man with grounded anime proportions and an expressive face.
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

**Expression:** say it in the pose part of the prompt, and name the mouth. "Smirk"
alone comes back as a toothy grin; write "closed-mouth smirk". For a serious
fighter, say "stern, not smiling".

**One chat per image.** A second image in the same ChatGPT chat copies the first
one's camera angle and framing. Start a new chat and attach the references again.

When generating, attach the Buzzsaw or Pugilist cut-out as the **style
reference**, labelled as such ("match this art style; do not copy this face or
pose").

## 5. Victory and royale-victory images

These are shared templates: the same arena, the same belt or trophy, the same
heroic angle from below. That's intentional and stays. Rules:

- The fighter's face, hair, outfit and palette must match their action cut-out.
- If a fighter is redesigned, **both** victory images get regenerated to match.
- Use the existing victory image as the template reference and the new action
  cut-out as the character reference.

## 6. Review checklist (per image)

1. Style: lines, shading and finish match the Buzzsaw and Pugilist, not the Gemini pair?
2. Likeness: every item on the fighter's likeness sheet present?
3. Pose: matches the plan and differs from every other fighter's?
4. Palette: right colours, kept off skin and hair?
5. Hands: launcher in one, plain ripcord in the other, nothing on the cord's end,
   no cord between Beyblade and launcher, no extras? Fingers correct?
6. Caught at the launch moment? Expression as planned?
7. No lettering, including the Beyblade's centre; still looks right mirrored?
8. Transparent background with clean edges and no halo? (ChatGPT's website does
   transparent backgrounds fine. A preview may show the transparent area as dark,
   so check the alpha, not the preview.)
9. Face found by `find-faces.py`?
