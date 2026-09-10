import json
import os
from typing import Dict, List, Optional

import boto3
from botocore.exceptions import ClientError

EMBEDDING_MODEL_ID = os.getenv("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "1024"))
S3_VECTOR_BUCKET = os.getenv("S3_VECTOR_BUCKET", "")
S3_VECTOR_INDEX = os.getenv("S3_VECTOR_INDEX", "career-knowledge")
RAG_ENABLED = os.getenv("RAG_ENABLED", "true").lower() == "true"
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("DEFAULT_AWS_REGION") or "eu-west-3"

_bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)
_s3vectors = boto3.client("s3vectors", region_name=AWS_REGION)


def embed_text(text: str) -> List[float]:
    body = json.dumps(
        {
            "inputText": text[:8000],
            "dimensions": EMBEDDING_DIMENSIONS,
            "normalize": True,
        }
    )
    response = _bedrock.invoke_model(modelId=EMBEDDING_MODEL_ID, body=body)
    payload = json.loads(response["body"].read())
    return payload["embedding"]


def retrieve(
    query: str,
    top_k: int = 5,
    source_type: Optional[str] = None,
) -> List[Dict]:
    """Return top-k chunks from S3 Vectors. Empty list if RAG is off or the index is empty."""
    if not RAG_ENABLED or not S3_VECTOR_BUCKET:
        return []

    try:
        embedding = embed_text(query)
        kwargs = {
            "vectorBucketName": S3_VECTOR_BUCKET,
            "indexName": S3_VECTOR_INDEX,
            "queryVector": {"float32": embedding},
            "topK": top_k,
            "returnMetadata": True,
            "returnDistance": True,
        }
        if source_type:
            kwargs["filter"] = {"source_type": {"$eq": source_type}}

        response = _s3vectors.query_vectors(**kwargs)
    except ClientError as exc:
        print(f"RAG retrieve failed: {exc}")
        return []

    chunks = []
    for item in response.get("vectors", []):
        metadata = item.get("metadata") or {}
        text = metadata.get("text") or ""
        if not text:
            continue
        chunks.append(
            {
                "text": text,
                "source": metadata.get("source", "unknown"),
                "title": metadata.get("title") or metadata.get("source", "unknown"),
                "source_type": metadata.get("source_type", "other"),
                "distance": item.get("distance"),
            }
        )
    return chunks


def format_context(chunks: List[Dict]) -> str:
    if not chunks:
        return "No retrieved documents. Answer only from the identity notes and conversation. If you do not know, say so."

    parts = []
    for i, chunk in enumerate(chunks, start=1):
        parts.append(
            f"[{i}] {chunk['title']} ({chunk['source']})\n{chunk['text']}"
        )
    return "\n\n".join(parts)


def sources_payload(chunks: List[Dict]) -> List[Dict]:
    seen = set()
    sources = []
    for chunk in chunks:
        key = (chunk["title"], chunk["source"])
        if key in seen:
            continue
        seen.add(key)
        sources.append(
            {
                "title": chunk["title"],
                "source": chunk["source"],
                "source_type": chunk["source_type"],
            }
        )
    return sources
