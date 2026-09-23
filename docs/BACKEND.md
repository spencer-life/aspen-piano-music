# Backend deployment

Aspen Keys uses a queue-based RunPod Serverless worker behind a thin Netlify API.

## Why this shape

- PiCoGen2 is the only GPU-heavy stage.
- Netlify keeps the RunPod key out of the browser.
- RunPod scales to zero between requests.
- Netlify Blobs stores the finished ZIP after the first successful status poll.
- No database or always-on service is required.

## Worker image

GitHub Actions publishes:

`ghcr.io/spencer-life/aspen-piano-music-worker:latest`

The image extends the official PiCoGen2 `latest-full` image, adds MuseScore/FluidSynth, and runs the RunPod handler directly.

Initial endpoint target:

- queue based
- GPU tier: `AMPERE_24` (24 GB)
- one GPU
- min workers: 0
- max workers: 1
- idle timeout: 5 seconds
- FlashBoot: enabled
- container disk: 30 GB
- no network volume

The worker performs startup fitness checks for CUDA, VRAM, PiCoGen2, MuseScore, FFmpeg, FluidSynth, and the soundfont.

## Provisioning

After the image is published and the RunPod account/API key exists:

```bash
RUNPOD_API_KEY=... mise run runpod:provision
```

If GHCR remains private, first add GHCR registry credentials in RunPod and pass the resulting ID:

```bash
RUNPOD_API_KEY=... \
RUNPOD_REGISTRY_AUTH_ID=... \
mise run runpod:provision
```

The script creates a Serverless template and endpoint and prints `RUNPOD_ENDPOINT_ID`.

Then configure Netlify with:

```text
RUNPOD_API_KEY
RUNPOD_ENDPOINT_ID
ASPEN_ACCESS_CODE
```

`ASPEN_ACCESS_CODE` is a private code Aspen enters once in the browser. It is stored only in that browser's local storage and sent to Netlify Functions in the `X-Aspen-Key` header. The API refuses paid generation until this value exists.

RunPod queue API authentication uses the raw API key in the `Authorization` header.

## Smoke test

After provisioning:

```bash
RUNPOD_API_KEY=... \
RUNPOD_ENDPOINT_ID=... \
mise run runpod:smoke -- "https://youtu.be/P883-nSegbY" "Goodday"
```

The smoke command polls the asynchronous RunPod job and writes the returned ZIP locally.

## Limits

The first production version intentionally accepts YouTube songs up to six minutes. The generated piano MP3 is encoded at 128 kbps so the complete base64 ZIP remains below RunPod's 10 MB async payload limit for ordinary songs.

RunPod async results are retained for 30 minutes, so the frontend should poll while the job is active. Once completed, Netlify copies the bundle into Netlify Blobs and serves it from there.

## Manual work intentionally deferred

Do these only after code, CI, worker image, frontend, and Netlify project are otherwise ready:

1. Add billing/API access to RunPod.
2. Make the GHCR package public, or add GHCR registry credentials to RunPod.
3. Run `mise run runpod:provision`.
4. Add `RUNPOD_API_KEY`, generated `RUNPOD_ENDPOINT_ID`, and a private `ASPEN_ACCESS_CODE` to Netlify.
5. Connect/deploy the Netlify project from the GitHub repository.
6. Run the Goodday end-to-end smoke test and inspect the generated PDF before calling production ready.
