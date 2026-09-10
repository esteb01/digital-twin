"""Offline indexer: chunk knowledge/ files, embed with Titan V2, write to S3 Vectors."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Dict, List

REPO_ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = REPO_ROOT / "knowledge"
CHUNK_CHARS = 2800
CHUNK_OVERLAP = 280

EMBEDDING_MODEL_ID = os.getenv("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1024"))
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("DEFAULT_AWS_REGION") or "eu-west-3"


def infer_source_type(path: Path) -> str:
    text = path.as_posix().lower()
    if text.startswith("tfm/") or "surrogate" in text:
        return "tfm"
    if text.startswith("career/") or text.startswith("experience/") or "resume" in text or text.startswith("cv_"):
        return "experience"
    if text.startswith("repos/") or text.startswith("project"):
        return "project"
    if text.startswith("personal/") or text == "personal.md" or "/personal.md" in text:
        return "other"
    return "other"


def chunk_text(text: str) -> List[str]:
    cleaned = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if not cleaned:
        return []
    chunks = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + CHUNK_CHARS)
        chunks.append(cleaned[start:end])
        if end == len(cleaned):
            break
        start = max(0, end - CHUNK_OVERLAP)
    return chunks


def load_documents() -> List[Dict]:
    docs: List[Dict] = []
    if not KNOWLEDGE_DIR.exists():
        raise SystemExit(f"Missing knowledge directory: {KNOWLEDGE_DIR}")

    for path in sorted(KNOWLEDGE_DIR.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".md", ".txt", ".json"}:
            continue
        raw = path.read_text(encoding="utf-8")
        if path.suffix.lower() == ".json":
            raw = json.dumps(json.loads(raw), indent=2, ensure_ascii=False)
        relative = path.relative_to(KNOWLEDGE_DIR).as_posix()
        source_type = infer_source_type(Path(relative))
        for i, chunk in enumerate(chunk_text(raw)):
            docs.append(
                {
                    "key": hashlib.sha256(f"{relative}:{i}:{chunk[:40]}".encode("utf-8")).hexdigest()[:64],
                    "text": chunk,
                    "source": relative,
                    "title": path.stem.replace("_", " "),
                    "source_type": source_type,
                }
            )
    return docs


def embed_text(bedrock, text: str) -> List[float]:
    response = bedrock.invoke_model(
        modelId=EMBEDDING_MODEL_ID,
        body=json.dumps(
            {
                "inputText": text[:8000],
                "dimensions": EMBEDDING_DIMENSIONS,
                "normalize": True,
            }
        ),
    )
    return json.loads(response["body"].read())["embedding"]


def put_batch(s3vectors, bucket: str, index: str, batch: List[Dict]) -> None:
    s3vectors.put_vectors(
        vectorBucketName=bucket,
        indexName=index,
        vectors=[
            {
                "key": item["key"],
                "data": {"float32": item["embedding"]},
                "metadata": {
                    "text": item["text"][:4096],
                    "source": item["source"],
                    "title": item["title"],
                    "source_type": item["source_type"],
                },
            }
            for item in batch
        ],
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Index knowledge/ into S3 Vectors")
    parser.add_argument("--bucket", default=os.getenv("S3_VECTOR_BUCKET", ""))
    parser.add_argument("--index", default=os.getenv("S3_VECTOR_INDEX", "career-knowledge"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    docs = load_documents()
    print(f"Loaded {len(docs)} chunks from {KNOWLEDGE_DIR}")
    if args.dry_run:
        for doc in docs[:8]:
            print(f"- {doc['source_type']} {doc['source']} ({len(doc['text'])} chars)")
        return

    if not args.bucket:
        raise SystemExit("Set --bucket or S3_VECTOR_BUCKET")

    import boto3
    from botocore.exceptions import ClientError

    bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    s3vectors = boto3.client("s3vectors", region_name=AWS_REGION)

    batch: List[Dict] = []
    for i, doc in enumerate(docs, start=1):
        doc["embedding"] = embed_text(bedrock, doc["text"])
        batch.append(doc)
        if len(batch) == 20 or i == len(docs):
            try:
                put_batch(s3vectors, args.bucket, args.index, batch)
            except ClientError as exc:
                raise SystemExit(f"put_vectors failed: {exc}") from exc
            print(f"Wrote {i}/{len(docs)}")
            batch = []


if __name__ == "__main__":
    main()
