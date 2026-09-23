# Aspen Keys — Agent Guide

## Product
Aspen Keys is a lightweight web app for Aspen to turn a YouTube song into a playable piano arrangement and download a polished bundle: MIDI, MusicXML, PDF, and piano MP3.

## Current architecture
Backend-first architecture is now defined. Frontend must stay aligned with this contract.

1. Netlify serves the static site and Functions API, keeping cloud credentials server-side.
2. RunPod Serverless runs the GPU worker.
3. The worker uses the official PiCoGen2 `latest-full` image, which already contains the PiCoGen2/SheetSage/beat-model checkpoints.
4. PiCoGen2 generates `piano.mid` from a YouTube URL.
5. MuseScore CLI engraves MusicXML/PDF using the Aspen Keys print style; FluidSynth + FFmpeg renders piano MP3.
6. The worker returns one ZIP bundle. Netlify persists completed bundles in Netlify Blobs and serves downloads.

Keep this route minimal. Do not add Demucs, Basic Pitch, Gemini, a database, queues, or additional cloud services unless testing shows the current route cannot meet the product goal.

## Backend API contract
- `POST /api/jobs` with `{ "sourceUrl": "https://...", "title": "..." }`
- `GET /api/jobs/:jobId`
- `GET /api/jobs/:jobId/download`
- `GET /api/health`

RunPod secrets are `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`; never expose them to the browser or commit them. Paid generation also requires `ASPEN_ACCESS_CODE`, which is validated only in Netlify Functions. RunPod queue endpoints authenticate with the raw API key in the `Authorization` header.

## Worker
Source: `backend/worker/`.
Base image: `tanchihpin0517/picogen2:latest-full`.
Expected GPU: 24 GB VRAM for initial production configuration; optimize only after measuring.

Worker image publishing is handled by `.github/workflows/worker-image.yml` and targets `ghcr.io/spencer-life/aspen-piano-music-worker`.

The initial worker caps source videos at six minutes and keeps result bundles below 7 MB so the base64 payload remains safely below RunPod's 10 MB async payload limit. Keep that guard unless artifact transport is redesigned.

RunPod provisioning is scripted in `scripts/provision-runpod.mjs`; the intended initial endpoint is queue based, `AMPERE_24`, min workers 0, max workers 1, FlashBoot enabled. `scripts/smoke-runpod.mjs` performs the direct end-to-end worker smoke test and then validates the ZIP with `scripts/verify-bundle.py`.

Score engraving lives in `backend/worker/engraving.py` plus `backend/worker/aspen-keys.mss`. Preserve US Letter page output, readable margins, the supplied title, Aspen Keys arranger/encoding metadata, and PiCoGen2 chord symbols recovered from `piano.txt`.

PiCoGen2 trained weights/data are non-commercial licensed upstream. Treat this project as personal/noncommercial unless licensing is revisited.

## Frontend
Static source: `site/`. Keep it framework-free unless product requirements justify a framework.

Brand: **Aspen Keys**.
Tagline: **Turn a song into something Aspen can play.**
Tone: personal, calm, elegant, piano-first, simple enough to use without technical knowledge.
Primary action: paste a YouTube link, optionally edit the title, generate, then download the bundle.

Maintain strong contrast, large touch targets, reduced-motion support, and a clean mobile layout. Avoid decorative gradients, glass effects, excessive cards, and generic SaaS styling.

## WebMCP / browser QA
The production page may expose only the visible user journey via WebMCP. See `docs/AGENT-TOOLS.md`.

WebMCP tools must never expose secrets, hidden admin state, or deployment operations. Starting a real arrangement is consequential because it can spend GPU money and must be annotated accordingly.

Use Chrome DevTools MCP/browser evidence to judge actual rendered behavior. Agent tools operate state; browser inspection judges the result.

## Netlify deployment
Production deploys intentionally use `.github/workflows/netlify-deploy.yml`, not Netlify's Git-connected build pipeline. GitHub Actions packages and uploads the already-prepared `site/` directory plus Netlify Functions with `netlify deploy --no-build`.

This keeps Netlify build usage at zero for normal deploys. Do not replace it with a Netlify build hook or Git-connected remote build unless the user explicitly chooses to spend Netlify build credits.

The workflow requires one GitHub Actions secret: `NETLIFY_AUTH_TOKEN`. The Netlify site ID is non-secret and pinned in the workflow.

## CI
Follow `spencer-life/github-workflows/ROUTING.md`. `mise run ci` remains the full local validation command.

GitHub Actions is deliberately path-scoped:
- `.github/workflows/ci.yml` runs only on non-documentation pull requests, detects whether web and/or worker code changed, and skips irrelevant test surfaces. Security checks still run for every non-doc code/config PR.
- `.github/workflows/visual-review.yml` runs automatically only when `site/index.html` or `site/styles.css` changes.
- `.github/workflows/worker-image.yml` runs only after production worker files change on `main`; test-only worker changes do not rebuild the large GPU image. Workflow-only edits are tested by security CI and require manual dispatch if an image-build smoke test is desired.
- `.github/workflows/netlify-deploy.yml` runs only when production site/functions/config files change on `main`.

Keep `cancel-in-progress` concurrency enabled so obsolete runs stop when a newer commit supersedes them. Keep third-party actions pinned to full commit SHAs. Do not add push-based duplicate CI for checks already covered on pull requests.

The worker image uses registry/inline Docker cache metadata instead of GitHub Actions cache export because the PiCoGen2 base image is very large; exporting its layers to the Actions cache previously dominated the workflow runtime.

Renovate is configured locally; do not add Dependabot version-update PRs on top of it. Renovate GitHub App access still must be verified separately.

Use a working branch. After each coherent validated slice, inspect the actual diff/history and commit with the repository's established style. Keep commits small and meaningful.

## Manual prerequisites
Keep manual account/credential steps until the end. See `docs/BACKEND.md`. The intended final manual steps are: add one GitHub `NETLIFY_AUTH_TOKEN` secret, authorize RunPod billing/API access, make GHCR readable to RunPod if necessary, provision the endpoint, add its key/ID plus `ASPEN_ACCESS_CODE` to Netlify, verify Renovate repository access, and perform the final Goodday end-to-end PDF/audio check.
