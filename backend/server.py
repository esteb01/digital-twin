from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from typing import Optional, List, Dict
import json
import uuid
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
from context import prompt
from agents import specialist_instructions
from rag import format_context, retrieve, sources_payload
from router import classify, source_type_for_intent
from tools import extract_visitor_contact, run_tools, summarize_visitor_session

load_dotenv()

app = FastAPI()

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

AWS_REGION = os.getenv("AWS_REGION") or os.getenv("DEFAULT_AWS_REGION") or "eu-west-3"
bedrock_client = boto3.client(service_name="bedrock-runtime", region_name=AWS_REGION)

BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "eu.amazon.nova-micro-v1:0")

USE_S3 = os.getenv("USE_S3", "false").lower() == "true"
S3_BUCKET = os.getenv("S3_BUCKET", "")
MEMORY_DIR = os.getenv("MEMORY_DIR", "../memory")

if USE_S3:
    s3_client = boto3.client("s3")


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class Source(BaseModel):
    title: str
    source: str
    source_type: str


class ChatResponse(BaseModel):
    response: str
    session_id: str
    sources: List[Source] = []
    intent: Optional[str] = None


def get_memory_path(session_id: str) -> str:
    return f"{session_id}.json"


def _empty_store() -> Dict:
    return {"messages": [], "pending_notify": False, "pending_excerpt": ""}


def _normalize_store(raw) -> Dict:
    if isinstance(raw, list):
        return {
            "messages": [m for m in raw if m.get("role") in ("user", "assistant")],
            "pending_notify": False,
            "pending_excerpt": "",
        }
    if isinstance(raw, dict):
        messages = raw.get("messages") or []
        if not isinstance(messages, list):
            messages = []
        return {
            "messages": [m for m in messages if isinstance(m, dict) and m.get("role") in ("user", "assistant")],
            "pending_notify": bool(raw.get("pending_notify")),
            "pending_excerpt": raw.get("pending_excerpt") or "",
        }
    return _empty_store()


def load_store(session_id: str) -> Dict:
    if USE_S3:
        try:
            response = s3_client.get_object(Bucket=S3_BUCKET, Key=get_memory_path(session_id))
            return _normalize_store(json.loads(response["Body"].read().decode("utf-8")))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return _empty_store()
            raise
    file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return _normalize_store(json.load(f))
    return _empty_store()


def save_store(session_id: str, store: Dict):
    payload = {
        "messages": store.get("messages") or [],
        "pending_notify": bool(store.get("pending_notify")),
        "pending_excerpt": store.get("pending_excerpt") or "",
    }
    if USE_S3:
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=get_memory_path(session_id),
            Body=json.dumps(payload, indent=2),
            ContentType="application/json",
        )
        return
    os.makedirs(MEMORY_DIR, exist_ok=True)
    file_path = os.path.join(MEMORY_DIR, get_memory_path(session_id))
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def load_conversation(session_id: str) -> List[Dict]:
    return load_store(session_id)["messages"]


ASK_CONTACT_NOTE = (
    "The visitor wants Esteban contacted but gave no email or LinkedIn. "
    "Do not claim you notified anyone. Ask how they want to be reached "
    "(email address or LinkedIn URL). You may still share Esteban's email "
    "and LinkedIn as a backup."
)


def call_bedrock(conversation: List[Dict], user_message: str, specialist_block: str) -> str:
    messages = []
    for msg in conversation[-20:]:
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue
        messages.append({"role": role, "content": [{"text": msg["content"]}]})
    messages.append({"role": "user", "content": [{"text": user_message}]})

    try:
        response = bedrock_client.converse(
            modelId=BEDROCK_MODEL_ID,
            system=[{"text": f"{prompt()}\n\n{specialist_block}"}],
            messages=messages,
            inferenceConfig={"maxTokens": 2000, "temperature": 0.7, "topP": 0.9},
        )
        return response["output"]["message"]["content"][0]["text"]
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "ValidationException":
            raise HTTPException(status_code=400, detail="Invalid message format for Bedrock")
        if error_code == "AccessDeniedException":
            raise HTTPException(status_code=403, detail="Access denied to Bedrock model")
        raise HTTPException(status_code=500, detail=f"Bedrock error: {str(e)}")


@app.get("/")
async def root():
    return {
        "message": "AI Digital Twin API (Powered by AWS Bedrock)",
        "memory_enabled": True,
        "storage": "S3" if USE_S3 else "local",
        "ai_model": BEDROCK_MODEL_ID,
        "rag": os.getenv("RAG_ENABLED", "true"),
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "use_s3": USE_S3,
        "bedrock_model": BEDROCK_MODEL_ID,
        "rag_enabled": os.getenv("RAG_ENABLED", "true"),
        "vector_index": os.getenv("S3_VECTOR_INDEX", ""),
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        session_id = request.session_id or str(uuid.uuid4())
        store = load_store(session_id)
        conversation = store["messages"]

        routed = classify(request.message)
        source_type = source_type_for_intent(routed["intent"])
        if routed["intent"] == "other":
            source_type = "other"
        chunks = retrieve(
            request.message,
            top_k=5,
            source_type=source_type,
        )
        if not chunks:
            chunks = retrieve(request.message, top_k=5)

        contact = extract_visitor_contact(request.message)
        fresh_notify = bool(routed.get("notify")) or "notify_owner" in routed["tools"]
        pending = bool(store.get("pending_notify"))
        tools = [name for name in routed["tools"] if name != "notify_owner"]
        if (fresh_notify or pending) and contact:
            tools.append("notify_owner")
            excerpt = store.get("pending_excerpt") or request.message
            if store.get("pending_excerpt") and store["pending_excerpt"] != request.message:
                excerpt = f"{store['pending_excerpt']}\n{request.message}"
            prior = [m.get("content") or "" for m in conversation if m.get("role") == "user"]
            briefing = summarize_visitor_session(prior + [request.message])
            tool_notes = run_tools(
                tools,
                excerpt,
                visitor_excerpt=excerpt,
                briefing=briefing,
            )
            store["pending_notify"] = False
            store["pending_excerpt"] = ""
        elif fresh_notify and not contact:
            other_notes = run_tools(tools, request.message)
            tool_notes = ASK_CONTACT_NOTE if not other_notes else f"{ASK_CONTACT_NOTE}\n\n{other_notes}"
            store["pending_notify"] = True
            store["pending_excerpt"] = store.get("pending_excerpt") or request.message
        else:
            tool_notes = run_tools(tools, request.message)

        specialist_block = specialist_instructions(
            routed["intent"],
            format_context(chunks),
            tool_notes,
        )
        assistant_response = call_bedrock(conversation, request.message, specialist_block)
        sources = sources_payload(chunks)

        conversation.append(
            {"role": "user", "content": request.message, "timestamp": datetime.now().isoformat()}
        )
        conversation.append(
            {
                "role": "assistant",
                "content": assistant_response,
                "timestamp": datetime.now().isoformat(),
                "sources": sources,
                "intent": routed["intent"],
            }
        )
        store["messages"] = conversation
        save_store(session_id, store)

        return ChatResponse(
            response=assistant_response,
            session_id=session_id,
            sources=sources,
            intent=routed["intent"],
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    try:
        conversation = load_conversation(session_id)
        return {"session_id": session_id, "messages": conversation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
