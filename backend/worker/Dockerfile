FROM tanchihpin0517/picogen2:latest-full@sha256:751b170345626662728cc8dea6e0bbd2a6d55a8d7569f7f4405b99f083194d7d

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends musescore3 xvfb fluid-soundfont-gm \
    && rm -rf /var/lib/apt/lists/*

USER picogen2
WORKDIR /opt/aspen-keys
COPY backend/worker/core.py backend/worker/engraving.py backend/worker/handler.py backend/worker/aspen-keys.mss ./
RUN conda run -n picogen2 --no-capture-output pip install --no-cache-dir "runpod==1.12.0"

ENV PICOGEN_ROOT=/home/picogen2/picogen2 \
    PIANO_SOUNDFONT=/usr/share/sounds/sf2/FluidR3_GM.sf2 \
    MAX_SOURCE_SECONDS=360 \
    MAX_BUNDLE_BYTES=7000000 \
    RUNPOD_MIN_CUDA_VERSION=11.8 \
    PYTHONUNBUFFERED=1

CMD ["conda", "run", "-n", "picogen2", "--no-capture-output", "python", "/opt/aspen-keys/handler.py"]
