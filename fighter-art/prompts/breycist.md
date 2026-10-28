# The Breycist: prompts

Test run of the style guide, 2026-10-26. Two versions of the pose, to choose between.

**Attachments**
1. `pugilist.png` as the **style reference**
2. `breycist.png` (the current art) as the **character reference**

No photo of the real person yet, so the current art stands in for likeness.
Redo with the likeness sheet once photos arrive.

**Character (from the current art)**
- Young man, athletic build.
- Short brown hair, swept up and back at the front.
- Blue eyes, strong straight brows, square jaw, clean-shaven.
- White zip-up tracksuit with green-white-red stripes down the sleeves and legs, red collar lining, small tricolour shield on the chest.
- Black wristwatch.
- Beyblade in red, black and silver.

---

## Version A: walk-away (after the launch)

> Two images are attached. **Image 1 is the style reference**: match its art style exactly (line work, shading, colour finish, energy effects), but do not copy its character, face or pose. **Image 2 is the character reference**: keep this man's face, hair, build and white Italian-style tracksuit, but not his pose.
>
> Anime splash-art illustration of a Beyblade fighter, in the style of a modern fighting-game character card. Clean, confident black outlines of even weight; cel shading with 2–3 tone steps and soft gradient highlights; bright, saturated, polished finish. No cross-hatching, no comic-book ink texture, no gritty or muddy shading. Adult man with grounded anime proportions and an expressive face. Signature colour palette: red, white and green with black-and-silver accents, used on clothing trim, launcher, Beyblade and energy effects, but not on skin or hair. The Beyblade spins in a glowing, motion-blurred vortex with light trails and sparks: the brightest element in the image. Landscape 3:2, character and Beyblade fill the frame, face clearly visible in the upper half. Transparent background, no scenery, no floor, no vignette. No text, letters or numbers anywhere; emblems symmetric.
>
> **Pose:** he has already launched and is walking away, too cool to watch. Seen three-quarter from behind, he glances back over his shoulder toward the viewer with a confident smirk, his face clearly visible. The launcher rests casually on his shoulder, the ripcord dangling from his other hand. His red, black and silver Beyblade spins in a blazing red-and-white vortex on the floor behind him, in the foreground.

## Version B: no-look launch (mid-launch)

> *(Same opening paragraph and style block as Version A.)*
>
> **Pose:** a no-look launch. He is already turning away from the stadium, mid-stride, and rips the cord behind him without looking, launcher arm extended back. He glances back over his shoulder toward the viewer with a cocky smirk, face clearly visible. The red, black and silver Beyblade is just leaving the launcher, already spinning in a blazing red-and-white vortex. Seen three-quarter from behind, low camera.

## Version C: no-look launch with likeness (2026-10-27)

New chat. Attachments: `1-style-pugilist.png`, `2-photo-front.jpg`, `3-photo-smile.jpg`
(from `reference-photos/breycist/upload/`, cropped to Conor only).

The prompt was the Version B pose, plus the likeness text from
[`likeness/breycist.md`](../likeness/breycist.md), the outfit as text, the updated
style block (plain Beyblade centre, hands rule) and "cocky closed-mouth smirk".
Images 2 and 3 were labelled "for likeness only … not photorealistic and not a
photo pasted onto a drawing".

Result: `candidates/breycist-C-likeness.png`. The face is much closer to Conor, and
the face detector finds it at 0.92 confidence. The ripcord still ends in a small red tab.

## Versions D to J (2026-10-27)

All are in `candidates/` (not committed). None was approved.

| Version | How | Result |
|---|---|---|
| D | Same chat as C: "more anime face" + upright turned-away pose | The pose the user liked; anime face, but leaner and more generic |
| E | Edit of D: about 10 years older | The user liked it, "almost spot on" |
| F | Edit of E: full smile | Smile preferred, but "like a filter on an image" |
| G | Edit of F: more stylised anime head | More anime, face narrower |
| H | New chat: G + photos, "simpler, less detail" (no Pugilist) | Too far from the Pugilist look; rejected |
| I | New chat: G (pose) + Pugilist (style) + photos, exaggerated expression | Big laugh, eyes shut; not uncanny |
| J | Edit of I: eyes open, narrowed | The latest; the user was still not happy |

**What we learned**
- The user's real complaint is the "uncanny" look: a real person's natural expression,
  painted in anime style. Taking detail away (H) was the wrong fix. Exaggerating the
  expression (I, J) helped.
- The Pugilist's level of detail is the target. Keep it as the style reference.
- Chained edits drift; a new chat with all references works better for big changes.

## Versions K to M2 (2026-10-28): approved

The user's problem with J: "too clean… the Pugilist has skin highlights, lines, detail
in the hair, it looks hand drawn. J looks like a filter placed on an image."

| Version | How | Result |
|---|---|---|
| K | New chat: G (pose) + Pugilist + Pugilist head close-up + both photos; rendering spelled out (inked hair strands, face lines, sharp highlights, varied line weight) | Hand-drawn at last; face lean and tanned |
| L | Edit of K: rounder face, fuller cheeks, fair skin, sides not shaved | Better likeness, but **the edit flattened the background** to solid colour |
| L2 | ChatGPT's **Remove BG** on L | Same picture, clean cut-out |
| M1, M2 | Edit of L2: exaggerated cocky smirk (ChatGPT returned two) | **M2 approved**, with the sharper smirk |

**Approved: `approved/breycist.png`** (a copy of `candidates/breycist-M2-smirk.png`).
1536×1024, transparent, face found at 0.89. Not yet in the app.

### Version K prompt (the one that worked)

Attachments: `0-pose-breycist-G.png`, `1b-style-pugilist-face.png`,
`1-style-pugilist.png`, `2-photo-front.jpg`, `3-photo-smile.jpg`.

> Please generate a new image. Five images are attached, in this order. IMAGE 1 (man
> in a white tracksuit): copy its pose, camera angle, framing, outfit, launcher,
> ripcord, Beyblade and red energy effects closely, but NOT its rendering, which is
> too smooth and clean. IMAGES 2 AND 3 (man with tinted glasses; image 2 is a
> close-up of his head): THE STYLE REFERENCE. Match their hand-drawn rendering
> exactly; do not copy his face, glasses, beard or outfit. IMAGES 4 AND 5: photos of
> the real person, for likeness only. RENDERING (the most important part): it must
> look hand-drawn and inked like images 2 and 3, not like a filter over a smooth
> render. Hair drawn as many individual inked strands and clumps with varied colour
> and bright highlights on the tips. Visible ink lines inside the face: forehead and
> brow creases, lines around the nose, cheekbones and laugh lines, the folds of the
> open mouth. Sharp-edged specular highlights on the skin (nose, cheeks, forehead)
> and strong, crisp cel-shadow shapes. Line weight that varies like a brush or pen,
> thicker on the outer contour. The same level of detail on the tracksuit folds and
> the launcher. Fine hand-drawn line detail, but no heavy comic-book cross-hatching.
> No airbrushed gradients, no soft blur. EXPRESSION: … LIKENESS, in the same breath:
> hand-drawn anime, but with his broad round face, full lifted cheeks, soft rounded
> jaw, short brown hair close at the sides (not shaved) with short spikes on top,
> ears that stand out slightly, fair skin with ruddy cheeks, and clearly adult
> late-30s proportions. No glasses, clean-shaven. Keep: [outfit, hands rule, plain
> Beyblade centre, 3:2, transparent background, no text].

### Version M edit (expression)

> Change only his expression to a cocky smirk, exaggerated anime-style like a
> confident rival character: mouth closed or barely open, pulled up hard on one side
> into a lopsided smirk that pushes that cheek up; one eyebrow raised high, the
> other lowered; eyes half-lidded and narrowed, looking sideways at the viewer as if
> he can't even be bothered to watch his own launch. Smug, too-cool, larger than
> life, not a realistic subtle smirk. Keep the transparent background.
