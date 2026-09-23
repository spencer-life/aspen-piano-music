# Aspen Keys

**Turn a song into something Aspen can play.**

Aspen Keys is a small personal web app that turns a YouTube song into a generated piano arrangement and returns a polished download bundle containing MIDI, MusicXML, printable PDF sheet music, and a piano MP3.

## Architecture

```text
YouTube URL
   ↓
Netlify API
   ↓
RunPod Serverless
   ↓
PiCoGen2 → piano MIDI
   ↓
MuseScore + FluidSynth/FFmpeg
   ↓
ZIP (MIDI + MusicXML + PDF + MP3)
   ↓
Netlify Blobs → download
```

The backend is intentionally minimal. PiCoGen2 performs the musical arrangement; the surrounding code only validates requests, runs the official model pipeline, renders the outputs, and serves them safely.

## Development

Worker-only tests:

```bash
python3 -m unittest discover -s backend/worker -p 'test_*.py'
```

Build the GPU worker locally only when Docker/GPU resources are available:

```bash
docker build -f backend/worker/Dockerfile -t aspen-keys-worker .
```

## Environment

Netlify requires:

- `RUNPOD_API_KEY`
- `RUNPOD_ENDPOINT_ID`

Do not expose these in client-side code.

## Licensing note

This repository's own code can be licensed separately, but the upstream PiCoGen2 trained models/dataset are distributed under non-commercial terms. Keep Aspen Keys personal/noncommercial unless those upstream rights are replaced or relicensed.
