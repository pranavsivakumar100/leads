"""Short utterance STT for the live dialer (OpenAI Whisper)."""
from __future__ import annotations

import io
import re

import httpx

_TIMEOUT = httpx.Timeout(30.0, connect=8.0)
_MAX_BYTES = 4 * 1024 * 1024
_MODEL = "whisper-1"

# Whisper often invents captions from silence / hold music.
_HALLUCINATIONS = {
    "thank you for watching",
    "thanks for watching",
    "thank you.",
    "you",
    ".",
    "...",
}


class TranscribeError(Exception):
    pass


def _clean(text: str) -> str:
    text = re.sub(r"\s+", " ", (text or "")).strip()
    if not text:
        return ""
    low = text.lower().strip(" .!?")
    if low in _HALLUCINATIONS:
        return ""
    if "subtitle" in low:
        return ""
    return text


def transcribe_audio(
    *,
    api_key: str,
    base_url: str,
    data: bytes,
    filename: str,
    mime_type: str,
) -> str:
    if len(data) < 400:
        return ""
    if len(data) > _MAX_BYTES:
        raise TranscribeError("Audio clip is too large.")
    try:
        resp = httpx.post(
            f"{base_url.rstrip('/')}/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={
                "file": (filename, io.BytesIO(data), mime_type or "application/octet-stream"),
            },
            data={"model": _MODEL, "language": "en", "response_format": "json"},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        text = _clean(str(resp.json().get("text") or ""))
    except httpx.HTTPError as exc:
        raise TranscribeError(f"Transcription request failed: {exc}") from exc
    except (KeyError, ValueError) as exc:
        raise TranscribeError("Transcription returned an unexpected response.") from exc
    return text
