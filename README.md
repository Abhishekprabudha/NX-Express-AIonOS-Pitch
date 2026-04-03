# NX-Express-AIonOS-Pitch

## Truck animation troubleshooting (lane movement)

If trucks are rendered but appear frozen on lanes, the most common root causes are:

1. **The JS bundle is duplicated in the same file**
   - If the same `let`/`const` declarations (for example `let __DBG`, `const map`, `const trucks`) appear twice in one script, the browser throws a parse-time error such as:
     - `Identifier 'map' has already been declared`
   - In that case, **none of the animation code runs** (including `requestAnimationFrame(tick)`), so trucks never move.

2. **`requestAnimationFrame` loop not started**
   - The movement loop must run continuously (`tick()`/`drawFrame()`) and update each truck's route progress (`t`).

3. **Runtime error inside truck draw path**
   - A render-time exception inside the loop can halt animation updates.

### Reference behavior used in the map animation

A working setup typically does all of the following:

- Creates truck state (`latlon`, `seg`, `t`, `dir`, `speed`, `startAt`).
- In each frame:
  - Computes elapsed delta time (`dt`).
  - Advances `t` by a step based on speed and segment length.
  - Rolls to next segment when `t >= 1`.
  - Draws truck at interpolated position with lane offset.
- Schedules the next frame with `requestAnimationFrame(...)`.

### Quick checks

Open browser DevTools Console and verify there are no parse errors and no repeated declarations.

- ✅ Good: no `Identifier ... has already been declared` error.
- ✅ Good: animation loop function is running every frame.
- ✅ Good: truck list contains spawned trucks after scenario load.


## Scene-by-scene narration MP3 export

You can generate narration audio for each scene caption in `index.html` using Python:

```bash
pip install edge-tts
python scripts_generate_scene_narration.py
```

This creates:
- `assets/scene_01.mp3`, `scene_02.mp3`, ...
- `assets/manifest.json` (scene text + file mapping)

Optional voice tuning:

```bash
python scripts_generate_scene_narration.py --voice en-US-GuyNeural --rate +8% --pitch +2Hz
```

## Run narration generation from GitHub (no local terminal)

If you are working directly in the GitHub web UI, you can run narration generation via **GitHub Actions**:

1. Open the **Actions** tab in your repo.
2. Select **Generate Scene Narration**.
3. Click **Run workflow** and choose the branch you want updated.
4. Keep `commit_to_repo=true` (default) to automatically write generated files into `assets/` on that branch.
5. (Optional) Set `voice`, `rate`, and `pitch` inputs.
6. Run it and wait for completion.
7. You can also open the workflow run and download the `scene-narration-mp3` artifact.

The artifact contains generated files from `assets/`:
- `scene_01.mp3`, `scene_02.mp3`, ...
- `manifest.json`
