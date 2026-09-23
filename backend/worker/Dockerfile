FROM tanchihpin0517/picogen2:latest-full

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends musescore3 xvfb fluid-soundfont-gm \
    && rm -rf /var/lib/apt/lists/*

USER picogen2
WORKDIR /opt/aspen-keys
COPY backend/worker/core.py backend/worker/handler.py ./
RUN conda run -n picogen2 --no-capture-output pip install --no-cache-dir "runpod>=1.7,<2"

ENV PICOGEN_ROOT=/home/picogen2/picogen2 \
    PIANO_SOUNDFONT=/usr/share/sounds/sf2/FluidR3_GM.sf2 \
    PYTHONUNBUFFERED=1

CMD ["conda", "run", "-n", "picogen2", "--no-capture-output", "python", "/opt/aspen-keys/handler.py"]
