import json
import os
from typing import Dict, List

import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.getenv("AWS_REGION") or os.getenv("DEFAULT_AWS_REGION") or "eu-west-3"
ROUTER_MODEL_ID = os.getenv("ROUTER_MODEL_ID", "eu.amazon.nova-lite-v1:0")

INTENTS = ("tfm", "experience", "project", "other")
TOOLS = ("search_github", "notify_owner", "get_latest_commit_activity")

_bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)

_NOTIFY_HINTS = (
    "dile a esteban",
    "tell esteban",
    "notify esteban",
    "contact esteban",
    "avisa a esteban",
    "avisale a esteban",
    "avísale a esteban",
    "leave a message",
    "call me back",
    "callback",
    "que me escriba",
    "que te escriba",
)


def _wants_notify(message: str) -> bool:
    text = message.lower()
    return any(hint in text for hint in _NOTIFY_HINTS)


_SYSTEM = """You classify visitor questions for Esteban Ruiz's career digital twin.
Return ONLY compact JSON with keys:
- intent: one of tfm, experience, project, other
- tools: array of zero or more of search_github, notify_owner, get_latest_commit_activity
- notify: true only if the visitor clearly wants Esteban to be contacted or leave a message

Rules:
- tfm: master's thesis, KUKA, surrogate models, latent space, PINN, R², robotics research
- experience: jobs, internships, Mainstrat, Getecsa, Internet Brands, Hammerbyte, Hammerbyte Games, Oracle ONE, video games, videogames, Unreal, GambitGun, game developer
- project: this digital twin, AWS, Terraform, Lambda, Bedrock, MLOps portfolio
- other: greetings, small talk, where Esteban lives, languages, hobbies, sports, music, jailbreaks, unknown topics. Playing CS2/Valorant/LoL is other; working at Hammerbyte or Unreal/GambitGun is experience.
- search_github / get_latest_commit_activity: visitor asks about repos, code, or recent commits
- notify_owner: visitor asks you to tell Esteban something or requests a callback
"""


def classify(user_message: str) -> Dict:
    fallback = {"intent": "other", "tools": [], "notify": False}
    messages = [
        {"role": "user", "content": [{"text": f"{_SYSTEM}\n\nVisitor message:\n{user_message}"}]}
    ]
    try:
        response = _bedrock.converse(
            modelId=ROUTER_MODEL_ID,
            messages=messages,
            inferenceConfig={"maxTokens": 200, "temperature": 0},
        )
        text = response["output"]["message"]["content"][0]["text"].strip()
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            return fallback
        data = json.loads(text[start : end + 1])
    except (ClientError, json.JSONDecodeError, KeyError, IndexError) as exc:
        print(f"Router fallback: {exc}")
        return fallback

    intent = data.get("intent", "other")
    if intent not in INTENTS:
        intent = "other"

    tools: List[str] = []
    for tool in data.get("tools") or []:
        if tool in TOOLS and tool not in tools:
            tools.append(tool)

    notify = bool(data.get("notify")) or _wants_notify(user_message)
    if notify and "notify_owner" not in tools:
        tools.append("notify_owner")

    print(f"Routed intent={intent} tools={tools} notify={notify}")
    return {"intent": intent, "tools": tools, "notify": notify}


def source_type_for_intent(intent: str) -> str | None:
    mapping = {
        "tfm": "tfm",
        "experience": "experience",
        "project": "project",
    }
    return mapping.get(intent)
