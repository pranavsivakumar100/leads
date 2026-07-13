"""Real-time sales coach — suggests the rep's next line during a live call.

Uses any OpenAI-compatible chat completions API. The prompt is grounded in
the session's offer, the attached script, and the rolling transcript.
"""
from __future__ import annotations

import httpx

_SYSTEM_PROMPT = """\
You are a live cold-call coach for a sales rep selling to local businesses.
The rep is on a call RIGHT NOW and glances at your suggestion between sentences.

Rules:
- Reply with ONLY the exact words the rep should say next. No preamble, no
  quotes, no explanations, no markdown.
- 1-2 sentences max. Conversational, natural, confident. Never robotic.
- Follow the rep's script framework when one is provided, but adapt to what
  the prospect actually said - handle objections before advancing the script.
- If the prospect asked a question, answer it first.
- If the call is going well, move toward the close (booking a time).
- Never invent facts about the rep's product beyond the offer description.
"""

_TIMEOUT = httpx.Timeout(12.0, connect=4.0)


class CoachError(Exception):
    pass


def _build_context(
    *,
    lead_name: str,
    offer: str,
    script_steps: list[dict],
    transcript: list[dict],
) -> str:
    parts: list[str] = []
    if lead_name:
        parts.append(f"Business being called: {lead_name}")
    if offer:
        parts.append(f"What the rep is selling: {offer}")
    if script_steps:
        lines = []
        for i, step in enumerate(script_steps, 1):
            title = step.get("title") or f"Step {i}"
            body = (step.get("body") or "").strip()
            lines.append(f"{i}. {title}: {body}")
        parts.append("Rep's script framework:\n" + "\n".join(lines))

    if transcript:
        lines = []
        for turn in transcript[-16:]:  # rolling window keeps the prompt tight
            who = "Prospect" if turn.get("role") == "prospect" else "Rep"
            lines.append(f"{who}: {turn.get('text', '')}")
        parts.append("Call so far (most recent last):\n" + "\n".join(lines))
    else:
        parts.append("The call is just starting - suggest the opener.")

    parts.append("What should the rep say next?")
    return "\n\n".join(parts)


def suggest_next_line(
    *,
    api_key: str,
    base_url: str,
    model: str,
    lead_name: str,
    offer: str,
    script_steps: list[dict],
    transcript: list[dict],
) -> str:
    """One coach suggestion. Synchronous — callers run it in a threadpool."""
    context = _build_context(
        lead_name=lead_name,
        offer=offer,
        script_steps=script_steps,
        transcript=transcript,
    )
    try:
        resp = httpx.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": context},
                ],
                "max_tokens": 120,
                "temperature": 0.6,
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
    except httpx.HTTPError as exc:
        raise CoachError(f"Coach LLM request failed: {exc}") from exc
    except (KeyError, IndexError) as exc:
        raise CoachError("Coach LLM returned an unexpected response.") from exc

    if not text:
        raise CoachError("Coach LLM returned an empty suggestion.")
    return text
