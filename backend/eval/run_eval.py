"""Nightly / on-demand fidelity check. Uses Nova Micro as judge. Costs cents."""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import boto3

QUESTIONS_PATH = Path(__file__).with_name("questions.json")
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("DEFAULT_AWS_REGION") or "eu-west-3"
JUDGE_MODEL = os.getenv("ROUTER_MODEL_ID", "eu.amazon.nova-micro-v1:0")


def chat(api_url: str, question: str) -> str:
    payload = json.dumps({"message": question}).encode("utf-8")
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8")).get("response", "")


def heuristic_score(item: dict, answer: str) -> list[str]:
    issues = []
    lower = answer.lower()
    for needle in item.get("must_include") or []:
        if needle.lower() not in lower:
            issues.append(f"missing '{needle}'")
    any_needles = item.get("must_include_any") or []
    if any_needles and not any(needle.lower() in lower for needle in any_needles):
        joined = ", ".join(f"'{needle}'" for needle in any_needles)
        issues.append(f"missing any of {joined}")
    for needle in item.get("must_not_include") or []:
        if needle.lower() in lower:
            issues.append(f"leaked '{needle}'")
    return issues


def judge(answer: str, question: str) -> str:
    bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    prompt = (
        "Score this digital-twin answer from 1 to 5 for faithfulness and professionalism. "
        "Reply with one line: SCORE=<n> REASON=<short>.\n\n"
        f"Q: {question}\nA: {answer}"
    )
    response = bedrock.converse(
        modelId=JUDGE_MODEL,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 150, "temperature": 0},
    )
    return response["output"]["message"]["content"][0]["text"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default=os.getenv("EVAL_API_URL", "http://localhost:8000"))
    parser.add_argument("--skip-judge", action="store_true")
    args = parser.parse_args()

    items = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
    failures = 0
    total = len(items)
    for item in items:
        try:
            answer = chat(args.api_url, item["question"])
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            print(f"FAIL {item['id']}: request error ({exc})")
            failures += 1
            continue
        issues = heuristic_score(item, answer)
        verdict = "skip-judge"
        if not args.skip_judge:
            try:
                verdict = judge(answer, item["question"])
            except Exception as exc:
                verdict = f"judge-error {exc}"
        status = "FAIL" if issues else "PASS"
        if issues:
            failures += 1
        print(f"{status} {item['id']}: {'; '.join(issues) or 'ok'} | {verdict}")
        print(f"  {answer[:240].replace(chr(10), ' ')}")

    passed = total - failures
    print(f"{passed}/{total} passed heuristics, {failures} failed")
    if failures:
        raise SystemExit(f"{failures} evaluation failures")
    print("All evaluation questions passed heuristics.")


if __name__ == "__main__":
    main()
