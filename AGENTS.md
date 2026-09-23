# Aspen Keys — Agent Guide

## Product
Aspen Keys is a lightweight web app for Aspen to turn a YouTube song into a playable piano arrangement and download a polished bundle: MIDI, MusicXML, PDF, and piano MP3.

## Current architecture
Backend-first. Do not build UI around mocked behavior that conflicts with this contract.

1. Netlify Functions expose the public API and keep cloud credentials server-side.
2. RunPod Serverless runs the GPU worker.
3. The worker uses the official PiCoGen2 `latest-full` image, which already contains the PiCoGen2/SheetSage/beat-model checkpoints.
4. PiCoGen2 generates `piano.mid` from a YouTube URL.
5. MuseScore CLI engraves MusicXML/PDF; FluidSynth + FFmpeg renders piano MP3.
6. The worker returns one ZIP bundle. Netlify persists completed bundles in Netlify Blobs and serves downloads.

Keep this route minimal. Do not add Demucs, Basic Pitch, Gemini, a database, queues, or additional cloud services unless testing shows the current route cannot meet the product goal.

## Backend API contract
- `POST /api/jobs` with `{ "sourceUrl": "https://...", "title": "..." }`
- `GET /api/jobs/:jobId`
- `GET /api/jobs/:jobId/download`
- `GET /api/health`

RunPod secrets are `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`; never expose them to the browser or commit them. RunPod queue endpoints authenticate with the raw API key in the `Authorization` header.

## Worker
Source: `backend/worker/`.
Base image: `tanchihpin0517/picogen2:latest-full`.
Expected GPU: 24 GB VRAM for initial production configuration; optimize only after measuring.

Worker image publishing is handled by `.github/workflows/worker-image.yml` and targets `ghcr.io/spencer-life/aspen-piano-music-worker`.

The initial worker caps source videos at six minutes and keeps result bundles below 7 MB so the base64 payload remains safely below RunPod's 10 MB async payload limit. Keep that guard unless artifact transport is redesigned.

RunPod provisioning is scripted in `scripts/provision-runpod.mjs`; the intended initial endpoint is queue based, `AMPERE_24`, min workers 0, max workers 1, FlashBoot enabled. `scripts/smoke-runpod.mjs` performs the direct end-to-end worker smoke test.

PiCoGen2 trained weights/data are non-commercial licensed upstream. Treat this project as personal/noncommercial unless licensing is revisited.

## CI
Follow `spencer-life/github-workflows/ROUTING.md`. Repository-specific commands live in mise. Required local/CI contract is `mise run ci`.

This repository is public while `spencer-life/github-workflows` is private. GitHub cannot resolve that private reusable workflow from this public repository, so the minimum baseline from trusted catalog commit `742d149b1e75ef50184861f984fcfe82dfe9d833` is mirrored locally in `.github/workflows/ci.yml`. Keep it aligned with the catalog rather than inventing a parallel CI policy.

Renovate is configured locally for the same reason; do not add Dependabot version-update PRs on top of it. Renovate GitHub App access still must be verified separately.

Use a working branch. After each coherent validated slice, inspect the actual diff/history and commit with the repository's established style. Keep commits small and meaningful.

## Frontend (after backend is ready for credentials)
Brand: **Aspen Keys**.
Tagline: **Turn a song into something Aspen can play.**
Tone: personal, calm, elegant, piano-first, simple enough to use without technical knowledge.
Primary action: paste a YouTube link, optionally edit the title, generate, then download the bundle.

WebMCP/agent controls may be added for development/review, but must not expose secrets or hidden mutable production state. Chrome DevTools/browser QA should judge the rendered production result.

## Manual prerequisites
Keep manual account/credential steps until the end. See `docs/BACKEND.md`. The intended final manual steps are: authorize RunPod billing/API access, make GHCR readable to RunPod if necessary, provision the endpoint, add its key/ID to Netlify, verify Renovate repository access, and perform the final Goodday end-to-end PDF/audio check.
