# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A static single-page event website for "Beyfest 2026 — Triple Threat", a Beyblade tournament. No build system, no package manager, no server — open `index.html` directly in a browser.

## Running the site

Just open `index.html` in a browser. For live-reload during development, any static file server works:

```bash
npx serve .
# or
python -m http.server 8080
```

## Architecture

Everything lives in two files:

- **`index.html`** — the entire page: all CSS (in `<style>`), all markup, and all React/JSX (in `<script type="text/babel">`). React 18 and Babel standalone are loaded from CDN so JSX is transpiled in the browser at runtime.
- **`tweaks-panel.jsx`** — a reusable floating debug panel loaded as a Babel script. Exports `useTweaks`, `TweaksPanel`, and a set of form controls (`TweakSlider`, `TweakToggle`, `TweakRadio`, `TweakSelect`, `TweakText`, `TweakNumber`, `TweakColor`, `TweakButton`) onto `window`. The panel communicates with a host via `postMessage` (`__activate_edit_mode` / `__deactivate_edit_mode` / `__edit_mode_available` / `__edit_mode_dismissed` / `__edit_mode_set_keys`).
- **`uploads/`** — AI-generated images referenced directly in `index.html`.

## CSS conventions

- Colors are defined as CSS custom properties on `:root` using `oklch()` — `--red`, `--green`, `--gold`, `--blue`, `--dark`, `--dark2`, `--dark3`, `--text`, `--muted`.
- Typography uses three Google Fonts: `Bebas Neue` (display/headings), `Barlow Condensed` (labels/tags), `Barlow` (body).
- Section classes follow a BEM-ish pattern: `.section-name` for the wrapper, `.section-name-child` for elements within it (e.g. `.arena-row`, `.arena-name`, `.arena-desc`).

## Tweaks panel usage pattern

When adding a tweakable prototype to `index.html`, follow the pattern in `tweaks-panel.jsx`'s header comment:

```js
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{ "key": value }/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // use t.key, call setTweak('key', newVal) or setTweak({ key: newVal })
}
```

The `EDITMODE-BEGIN` / `EDITMODE-END` markers are used by the host to persist changes back to disk.
