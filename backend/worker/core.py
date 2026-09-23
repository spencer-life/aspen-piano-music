from __future__ import annotations

import re
from urllib.parse import urlparse

_ALLOWED_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"}


def sanitize_title(value: str | None, fallback: str = "Aspen Keys") -> str:
    text = (value or "").strip()
    if not text:
        text = fallback
    text = re.sub(r"[\\/:*?\"<>|]+", "-", text)
    text = re.sub(r"\s+", " ", text).strip(" .-")
    return text[:96] or fallback


def validate_youtube_url(value: str) -> str:
    value = value.strip()
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or host not in _ALLOWED_HOSTS:
        raise ValueError("Use a valid HTTPS YouTube URL.")
    if host == "youtu.be" and not parsed.path.strip("/"):
        raise ValueError("The YouTube URL is missing a video ID.")
    if host != "youtu.be" and parsed.path not in {"/watch", "/shorts", "/live"} and not parsed.path.startswith("/shorts/") and not parsed.path.startswith("/live/"):
        raise ValueError("Use a YouTube video URL.")
    return value
