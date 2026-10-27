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

## Versions D to J (2026-10-27), and where it stands

All are in `candidates/` (not committed). None is approved; the user is still not
happy with the look.

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

**To pick up:** ask the user what still feels wrong with J (face shape? age? style?).
Then try a fresh generation in a new chat with `0-pose-breycist-G.png`,
`1-style-pugilist.png` and both photos.
