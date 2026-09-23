from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import runpod
import torch

from core import sanitize_title, validate_youtube_url

PICOGEN_ROOT = Path(os.getenv("PICOGEN_ROOT", "/home/picogen2/picogen2"))
SOUNDFONT = Path(os.getenv("PIANO_SOUNDFONT", "/usr/share/sounds/sf2/FluidR3_GM.sf2"))
MAX_SOURCE_SECONDS = int(os.getenv("MAX_SOURCE_SECONDS", "360"))
MAX_BUNDLE_BYTES = int(os.getenv("MAX_BUNDLE_BYTES", "7000000"))


def _run(
    args: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    capture_output: bool = False,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        env=env,
        check=True,
        capture_output=capture_output,
        text=capture_output,
    )


def _musescore_bin() -> str:
    for candidate in ("mscore3", "musescore3", "mscore", "musescore"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise RuntimeError("MuseScore CLI is not installed in the worker image.")


def _source_duration(source_url: str) -> float | None:
    result = _run(
        [
            "conda",
            "run",
            "-n",
            "picogen2",
            "python",
            "-m",
            "yt_dlp",
            "--dump-single-json",
            "--skip-download",
            "--no-playlist",
            source_url,
        ],
        cwd=PICOGEN_ROOT,
        capture_output=True,
    )
    metadata = json.loads(result.stdout)
    duration = metadata.get("duration")
    return float(duration) if duration is not None else None


def _validate_source_duration(source_url: str) -> float | None:
    duration = _source_duration(source_url)
    if duration is not None and duration > MAX_SOURCE_SECONDS:
        raise ValueError(
            f"Songs must be {MAX_SOURCE_SECONDS // 60} minutes or shorter for this version of Aspen Keys."
        )
    return duration


def _patch_musicxml(path: Path, title: str) -> None:
    tree = ET.parse(path)
    root = tree.getroot()

    work = root.find("work")
    if work is None:
        work = ET.Element("work")
        root.insert(0, work)
    work_title = work.find("work-title")
    if work_title is None:
        work_title = ET.SubElement(work, "work-title")
    work_title.text = title

    movement = root.find("movement-title")
    if movement is None:
        movement = ET.Element("movement-title")
        insert_at = 1 if root.find("work") is not None else 0
        root.insert(insert_at, movement)
    movement.text = title

    identification = root.find("identification")
    if identification is None:
        identification = ET.Element("identification")
        root.insert(2, identification)
    creator = identification.find("creator[@type='arranger']")
    if creator is None:
        creator = ET.SubElement(identification, "creator", {"type": "arranger"})
    creator.text = "Aspen Keys"

    tree.write(path, encoding="utf-8", xml_declaration=True)


def _render_artifacts(workdir: Path, title: str) -> dict[str, Path]:
    midi = workdir / "piano.mid"
    if not midi.exists():
        raise RuntimeError("PiCoGen2 completed without producing piano.mid.")

    basename = sanitize_title(title)
    musicxml = workdir / f"{basename}.musicxml"
    pdf = workdir / f"{basename}.pdf"
    mp3 = workdir / f"{basename}.mp3"
    midi_named = workdir / f"{basename}.mid"
    shutil.copy2(midi, midi_named)

    muse = _musescore_bin()
    qt_env = {**os.environ, "QT_QPA_PLATFORM": "offscreen"}
    _run(["xvfb-run", "-a", muse, "-o", str(musicxml), str(midi)], cwd=workdir, env=qt_env)
    _patch_musicxml(musicxml, title)
    _run(["xvfb-run", "-a", muse, "-o", str(pdf), str(musicxml)], cwd=workdir, env=qt_env)

    wav = workdir / "piano.wav"
    _run(
        ["fluidsynth", "-ni", "-F", str(wav), "-r", "44100", str(SOUNDFONT), str(midi)],
        cwd=workdir,
    )
    _run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(wav),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "128k",
            str(mp3),
        ],
        cwd=workdir,
    )
    wav.unlink(missing_ok=True)

    return {"midi": midi_named, "musicxml": musicxml, "pdf": pdf, "audio": mp3}


def _bundle(workdir: Path, title: str, artifacts: dict[str, Path]) -> tuple[Path, dict[str, object]]:
    bundle_name = f"{sanitize_title(title)} - Aspen Keys.zip"
    bundle = workdir / bundle_name
    manifest = {
        "brand": "Aspen Keys",
        "title": title,
        "files": {kind: path.name for kind, path in artifacts.items()},
    }
    manifest_path = workdir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for path in artifacts.values():
            zf.write(path, arcname=path.name)
        zf.write(manifest_path, arcname="manifest.json")

    if bundle.stat().st_size > MAX_BUNDLE_BYTES:
        raise RuntimeError("Generated bundle is too large to return safely. Try a shorter song.")
    return bundle, manifest


@runpod.serverless.register_fitness_check
def check_worker_runtime() -> None:
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU is not available.")

    gpu_memory_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
    if gpu_memory_gb < 20:
        raise RuntimeError(f"GPU has {gpu_memory_gb:.1f} GB VRAM; Aspen Keys requires at least 20 GB.")

    required_commands = ("conda", "ffmpeg", "fluidsynth", "xvfb-run")
    missing = [command for command in required_commands if shutil.which(command) is None]
    if missing:
        raise RuntimeError(f"Missing required commands: {', '.join(missing)}")

    _musescore_bin()
    if not (PICOGEN_ROOT / "infer.sh").exists():
        raise RuntimeError(f"PiCoGen2 infer.sh not found under {PICOGEN_ROOT}.")
    if not SOUNDFONT.exists():
        raise RuntimeError(f"Piano soundfont not found at {SOUNDFONT}.")


def handler(job: dict) -> dict:
    payload = job.get("input") or {}
    source_url = validate_youtube_url(str(payload.get("source_url", "")))
    title = sanitize_title(payload.get("title"), fallback="Aspen Keys Arrangement")
    duration = _validate_source_duration(source_url)

    with tempfile.TemporaryDirectory(prefix="aspen-keys-") as tmp:
        workdir = Path(tmp)
        output_dir = workdir / "picogen"
        output_dir.mkdir(parents=True, exist_ok=True)

        _run(
            [
                "conda",
                "run",
                "-n",
                "picogen2",
                "--no-capture-output",
                "bash",
                str(PICOGEN_ROOT / "infer.sh"),
                "--input_url",
                source_url,
                "--output_dir",
                str(output_dir),
            ],
            cwd=PICOGEN_ROOT,
        )

        for name in ("piano.mid", "piano.txt"):
            src = output_dir / name
            if src.exists():
                shutil.copy2(src, workdir / name)

        artifacts = _render_artifacts(workdir, title)
        bundle, manifest = _bundle(workdir, title, artifacts)
        data = bundle.read_bytes()

        manifest["source_duration_seconds"] = duration
        return {
            "bundle_name": bundle.name,
            "bundle_base64": base64.b64encode(data).decode("ascii"),
            "bundle_bytes": len(data),
            "manifest": manifest,
        }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
