# Third-party notices

Aspen Keys is a personal, noncommercial project built around open-source music-generation tooling. This file is a practical notice, not a substitute for the upstream license texts.

## PiCoGen2

Repository: `tanchihpin0517/PiCoGen`

- Source code: MIT License.
- Upstream dataset and trained models: CC BY-NC-SA 3.0.
- The upstream license specifically notes that the trained models are derived from HookTheory user contributions.

Aspen Keys uses PiCoGen2 as the piano-cover generation system and therefore treats the deployed model stack as noncommercial.

## SheetSage

Repository: `chrisdonahue/sheetsage`

- Source code: MIT License.
- Upstream dataset and trained models: CC BY-NC-SA 3.0.

PiCoGen2 uses SheetSage features for musical conditioning.

## Beat This!

Repository: `CPJKU/beat_this`

- Source code: MIT License.

PiCoGen2 uses Beat This! for beat/downbeat analysis.

## Other runtime components

The worker image also uses MuseScore, FluidSynth, FFmpeg, CUDA/PyTorch, and their transitive dependencies. Their respective upstream licenses continue to apply.

Before any commercial distribution or paid service is considered, re-audit every model, dataset, soundfont, container image, and runtime dependency rather than assuming this personal-use deployment can be commercialized.
