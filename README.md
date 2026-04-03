# NX × AIonOS Motion Narrative: Deterministic Video Workflow

## 1) What the current code already does well

The existing demo already has strong presentation fundamentals:

- High-quality scene composition and visual polish (cards, gradients, kinetic accents, chart styling).
- Multi-scene narrative structure with clear pacing intent (`data-duration` on each scene).
- Rich visuals already in place: canvas charts, SVG flow diagrams, transition states, and map/truck animation primitives.
- Interactive transport controls (Play / Pause / Restart) and responsive layout behavior.

In short: the creative layer was already strong; the missing piece was deterministic rendering and export.

## 2) What prevented it from being a real video generator

The original implementation could not be treated as a production video pipeline because:

1. **Speech synthesis was non-deterministic**
   Browser `speechSynthesis` voice selection, timing, rate, and availability vary by machine/browser/OS.

2. **Scene timing depended on estimated word counts**
   Durations were inferred from text length, not locked to actual narration audio.

3. **Timeline state was runtime-driven, not frame-addressable**
   Playback was tied to live `requestAnimationFrame` wall-clock progression, making exact re-rendering hard.

4. **No deterministic export surface**
   There was no render API to ask the page: "draw frame for exact time T".

5. **No FFmpeg-friendly output path**
   No stable frame-sequence + audio mux workflow for reliable 1080p exports.

## 3) Recommended architecture (implemented)

Use a **single-source timeline** driven by pre-recorded narration metadata:

- Replace speech synthesis with scene audio files (`assets/narration/scene-01.mp3` … `scene-05.mp3`).
- Build scene durations from real audio metadata (`loadedmetadata`), not text estimates.
- Keep a deterministic timeline with cumulative scene starts.
- Add two runtime modes:
  - **Preview mode**: real-time interactive playback with synchronized scene audio.
  - **Export mode**: no live narration playback; expose `window.__NARRATIVE_EXPORT__` with:
    - `getDuration()`
    - `renderAt(timeSec)`
- Export via **Playwright frame capture + FFmpeg mux**:
  1. Render each frame at exact `t = frame / fps`.
  2. Save `PNG` sequence.
  3. Concatenate narration clips with FFmpeg.
  4. Encode final H.264/AAC 1920×1080 MP4.

This is deterministic, debuggable, and rerunnable.

---

## What was implemented

### Runtime changes

- Removed browser speech synthesis behavior.
- Added pre-recorded audio loading per scene.
- Scene durations now come from narration file metadata.
- Scene progression, caption typing, transitions, and map truck motion are driven by the same timeline.
- Added export-mode layout support for fixed-size rendering (`?mode=export&width=1920&height=1080`).
- Exposed deterministic render bridge at `window.__NARRATIVE_EXPORT__` for automation.

### Export pipeline

- Added `scripts/export-video.mjs`:
  - starts static server
  - launches headless Chromium via Playwright
  - renders frame-by-frame in export mode
  - writes PNG sequence
  - concatenates narration clips with FFmpeg
  - muxes final MP4 (`dist/narrative.mp4`)

### Project setup

- Added `package.json` scripts and Playwright dependency.
- Added narration asset instructions in `assets/narration/README.md`.

---

## Usage

## Prerequisites

- Node.js 20+
- Python 3
- FFmpeg available on `PATH`

Install JS dependencies:

```bash
npm install
```

Install Playwright Chromium if needed:

```bash
npx playwright install chromium
```

Add narration assets:

```text
assets/narration/scene-01.mp3
assets/narration/scene-02.mp3
assets/narration/scene-03.mp3
assets/narration/scene-04.mp3
assets/narration/scene-05.mp3
```

## Preview mode (interactive)

```bash
npm run preview
```

Open:

```text
http://127.0.0.1:8000/index.html
```

## Export mode (deterministic 1920×1080)

```bash
npm run export:video
```

Output:

```text
dist/narrative.mp4
```

Optional environment overrides:

- `FPS` (default `30`)
- `WIDTH` (default `1920`)
- `HEIGHT` (default `1080`)
- `OUTPUT` (default `dist/narrative.mp4`)
- `PORT` (default `4173`)

Example:

```bash
FPS=60 WIDTH=1920 HEIGHT=1080 OUTPUT=dist/narrative-60fps.mp4 npm run export:video
```

---

## Why this is reliable

- Export uses deterministic time stepping (`renderAt(t)`) rather than real-time screen recording.
- Scene durations are derived from fixed audio files.
- FFmpeg handles final encoding/muxing in a reproducible way.
- The same authored HTML/CSS/SVG/canvas content is rendered; no rewrite into a different rendering stack.
