import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

_EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
_LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w%-]+/?", re.I)

GITHUB_OWNER = os.getenv("GITHUB_OWNER", "esteb01")
GITHUB_REPOS = [
    repo.strip()
    for repo in os.getenv("GITHUB_REPOS", "digital-twin,TFM_Surrogate_Robot").split(",")
    if repo.strip()
]
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")
USER_AGENT = "esteban-digital-twin/1.0"
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("DEFAULT_AWS_REGION") or "eu-west-3"
BRIEFING_MODEL_ID = os.getenv("ROUTER_MODEL_ID", "eu.amazon.nova-lite-v1:0")
_bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)

_BRIEFING_SYSTEM = (
    "You brief Esteban on a visitor to his career digital twin. "
    "Use only the visitor messages. Reply in Spanish with exactly two sections:\n"
    "RESUMEN:\n- bullets of what they asked\n"
    "LECTURA:\nOne short paragraph: likely recruiter, thesis interest, stack curiosity, or networking. "
    "Call it a hypothesis, not a fact. Do not invent contact details."
)


def _get_json(url: str) -> object:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def search_github(query: str, repo: str | None = None) -> str:
    """Keyword scan of public repo metadata and README. No GitHub token required."""
    repos = [repo] if repo else list(GITHUB_REPOS)
    needle = query.lower()
    findings: List[str] = []

    for name in repos:
        full = name if "/" in name else f"{GITHUB_OWNER}/{name}"
        try:
            meta = _get_json(f"https://api.github.com/repos/{full}")
            description = meta.get("description") or ""
            readme = _get_json(f"https://api.github.com/repos/{full}/readme")
            import base64

            body = base64.b64decode(readme.get("content") or "").decode("utf-8", errors="replace")
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, KeyError) as exc:
            findings.append(f"{full}: unavailable ({exc})")
            continue

        haystack = f"{description}\n{body}".lower()
        if needle and needle not in haystack:
            snippet = description or body[:280]
            findings.append(f"{full}: no exact match for '{query}'. Repo summary: {snippet[:280]}")
            continue

        idx = haystack.find(needle) if needle else 0
        start = max(0, idx - 120)
        excerpt = body[start : start + 360] if body else description
        findings.append(f"{full}: {excerpt}")

    return "\n\n".join(findings) if findings else "No public GitHub results."


def get_latest_commit_activity() -> str:
    lines: List[str] = []
    for name in GITHUB_REPOS:
        full = name if "/" in name else f"{GITHUB_OWNER}/{name}"
        try:
            commits = _get_json(f"https://api.github.com/repos/{full}/commits?per_page=3")
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as exc:
            lines.append(f"{full}: could not read commits ({exc})")
            continue
        if not isinstance(commits, list) or not commits:
            lines.append(f"{full}: no commits visible")
            continue
        for commit in commits[:3]:
            sha = (commit.get("sha") or "")[:7]
            message = ((commit.get("commit") or {}).get("message") or "").split("\n")[0]
            date = ((commit.get("commit") or {}).get("author") or {}).get("date", "")
            lines.append(f"{full} {sha} {date} — {message}")
    return "\n".join(lines) if lines else "No recent public commits."


def extract_visitor_contact(text: str) -> Optional[str]:
    blob = text or ""
    email = _EMAIL_RE.search(blob)
    linkedin = _LINKEDIN_RE.search(blob)
    parts = []
    if email:
        parts.append(email.group(0))
    if linkedin:
        parts.append(linkedin.group(0))
    return " ".join(parts) if parts else None


def summarize_visitor_session(user_messages: List[str]) -> str:
    lines = [f"- {text.strip()}" for text in user_messages[-12:] if (text or "").strip()]
    if not lines:
        return ""
    transcript = "\n".join(lines)
    try:
        response = _bedrock.converse(
            modelId=BRIEFING_MODEL_ID,
            system=[{"text": _BRIEFING_SYSTEM}],
            messages=[{"role": "user", "content": [{"text": transcript}]}],
            inferenceConfig={"maxTokens": 350, "temperature": 0.2},
        )
        return (response["output"]["message"]["content"][0]["text"] or "").strip()
    except (ClientError, KeyError, IndexError) as exc:
        print(f"Visitor briefing fallback: {exc}")
        return ""


def notify_owner(message: str, visitor_excerpt: str = "", briefing: str = "") -> str:
    if not DISCORD_WEBHOOK_URL:
        return "Notification channel is not configured. Tell the visitor Esteban can be reached at estebanruiz435@gmail.com or linkedin.com/in/estebanruizh."

    contact = extract_visitor_contact(f"{visitor_excerpt}\n{message}")
    contact_line = f"How to reach them: {contact}\n" if contact else ""
    briefing_block = f"\n{briefing.strip()}\n" if briefing.strip() else ""
    payload = {
        "content": (
            "Digital Twin visitor note\n"
            f"{contact_line}"
            f"{visitor_excerpt or message}"
            f"{briefing_block}"
        )[:1900]
    }
    request = urllib.request.Request(
        DISCORD_WEBHOOK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            if 200 <= response.status < 300:
                print("notify_owner: discord ok" + (" briefing" if briefing.strip() else ""))
                return "Esteban was notified through Discord."
            return f"Notification failed with HTTP {response.status}."
    except urllib.error.HTTPError as exc:
        return f"Notification failed ({exc.code})."
    except urllib.error.URLError as exc:
        return f"Notification failed ({exc})."


def run_tools(
    tool_names: List[str],
    user_message: str,
    *,
    visitor_excerpt: str = "",
    briefing: str = "",
) -> str:
    notes: List[str] = []
    for name in tool_names:
        if name == "search_github":
            notes.append(search_github(user_message))
        elif name == "get_latest_commit_activity":
            notes.append(get_latest_commit_activity())
        elif name == "notify_owner":
            notes.append(
                notify_owner(
                    user_message,
                    visitor_excerpt=visitor_excerpt or user_message,
                    briefing=briefing,
                )
            )
    return "\n\n".join(notes)
