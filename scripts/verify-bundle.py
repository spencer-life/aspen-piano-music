#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


def first_with_suffix(names: list[str], suffix: str) -> str:
    matches = [name for name in names if name.lower().endswith(suffix)]
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly one {suffix} file, found {len(matches)}")
    return matches[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    args = parser.parse_args()

    with zipfile.ZipFile(args.bundle) as archive:
        names = archive.namelist()
        midi = first_with_suffix(names, ".mid")
        musicxml = first_with_suffix(names, ".musicxml")
        pdf = first_with_suffix(names, ".pdf")
        audio = first_with_suffix(names, ".mp3")

        manifest = json.loads(archive.read("manifest.json"))
        root = ET.fromstring(archive.read(musicxml))
        title = root.findtext("work/work-title") or root.findtext("movement-title")

        pdf_bytes = archive.read(pdf)
        if not pdf_bytes.startswith(b"%PDF"):
            raise SystemExit("PDF artifact does not have a valid PDF header.")

        if len(archive.read(midi)) < 100:
            raise SystemExit("MIDI artifact is unexpectedly small.")
        if len(archive.read(audio)) < 10_000:
            raise SystemExit("MP3 artifact is unexpectedly small.")

        duration = None
        if shutil.which("ffprobe"):
            with tempfile.TemporaryDirectory() as tmp:
                mp3_path = Path(tmp) / "arrangement.mp3"
                mp3_path.write_bytes(archive.read(audio))
                result = subprocess.run(
                    [
                        "ffprobe",
                        "-v",
                        "error",
                        "-show_entries",
                        "format=duration",
                        "-of",
                        "default=noprint_wrappers=1:nokey=1",
                        str(mp3_path),
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                )
                duration = float(result.stdout.strip())

        summary = {
            "bundle": args.bundle.name,
            "title": title,
            "files": {"midi": midi, "musicxml": musicxml, "pdf": pdf, "audio": audio},
            "audioDurationSeconds": duration,
            "sourceDurationSeconds": manifest.get("source_duration_seconds"),
        }
        print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
