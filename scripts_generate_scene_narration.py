#!/usr/bin/env python3
"""Generate scene-by-scene narration MP3 files from index.html captions.

Default behavior reads `index.html`, extracts each scene's `data-caption`, and
writes one MP3 per scene to `assets/scene_##.mp3`.

Requires: edge-tts (pip install edge-tts)
"""

from __future__ import annotations

import argparse
import asyncio
import html
import json
import re
from pathlib import Path

CAPTION_PATTERN = re.compile(r'data-caption="(.*?)"', re.DOTALL)


def extract_captions(index_path: Path) -> list[str]:
    source = index_path.read_text(encoding="utf-8")
    matches = CAPTION_PATTERN.findall(source)
    captions = [html.unescape(m.strip()) for m in matches if m.strip()]
    if not captions:
        raise ValueError(f"No scene captions found in {index_path}")
    return captions


async def synthesize_scene_mp3(text: str, output_file: Path, voice: str, rate: str, pitch: str) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    try:
        import edge_tts
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("Missing dependency 'edge-tts'. Install it with: pip install edge-tts") from exc

    communicator = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
    await communicator.save(str(output_file))


async def main_async(args: argparse.Namespace) -> None:
    captions = extract_captions(args.index)
    manifest: list[dict[str, str | int]] = []

    for i, caption in enumerate(captions, start=1):
        out_file = args.out_dir / f"scene_{i:02d}.mp3"
        print(f"Generating {out_file}...")
        await synthesize_scene_mp3(caption, out_file, args.voice, args.rate, args.pitch)
        manifest.append(
            {
                "scene": i,
                "file": str(out_file),
                "text": caption,
                "word_count": len(caption.split()),
            }
        )

    manifest_path = args.out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Done. Generated {len(captions)} scene MP3 files in {args.out_dir}")
    print(f"Manifest written to {manifest_path}")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate scene-by-scene narration MP3 files")
    parser.add_argument("--index", type=Path, default=Path("index.html"), help="Path to index.html")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("assets"),
        help="Folder where scene MP3 files are written",
    )
    parser.add_argument(
        "--voice",
        default="en-US-AriaNeural",
        help="Edge TTS voice name (example: en-US-AriaNeural)",
    )
    parser.add_argument("--rate", default="+0%", help="Speech rate adjustment")
    parser.add_argument("--pitch", default="+0Hz", help="Speech pitch adjustment")
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
