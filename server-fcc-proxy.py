#!/usr/bin/env python3
"""Minimal proxy: OpenAI ChatCompletions format -> FCC Anthropic Messages API format"""

import json, uvicorn
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import StreamingResponse
from httpx import AsyncClient, Timeout

FCC_URL = "http://localhost:8090/v1/messages"
FCC_API_KEY = "freecc"
FCC_MODEL = "anthropic/deepseek/deepseek-v4-flash"

app = FastAPI()
client = AsyncClient(timeout=Timeout(120))


@app.post("/v1/chat/completions")
async def chat_completions(req: Request):
    body = await req.json()
    messages = body.get("messages", [])
    stream = body.get("stream", False)
    system_msg = ""
    user_msgs = []

    for m in messages:
        if m["role"] == "system":
            system_msg = m.get("content", "")
        else:
            user_msgs.append({"role": m["role"], "content": m.get("content", "")})

    payload = {
        "model": FCC_MODEL,
        "max_tokens": body.get("max_tokens", 800),
        "temperature": body.get("temperature", 0.7),
        "messages": user_msgs,
    }
    if system_msg:
        payload["system"] = system_msg

    if stream:
        return await _stream_response(payload)
    else:
        return await _nonstream_response(payload)


async def _nonstream_response(payload: dict):
    """Call FCC in streaming mode but aggregate the full response."""
    text_parts: list[str] = []
    buffer = ""
    async with AsyncClient(timeout=Timeout(120)) as cli:
        async with cli.stream(
            "POST", FCC_URL,
            json=payload,
            headers={"x-api-key": FCC_API_KEY, "Content-Type": "application/json"},
        ) as resp:
            async for raw in resp.aiter_lines():
                if not raw.startswith("data: "):
                    continue
                line = raw[6:]
                try:
                    evt = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if evt.get("type") == "content_block_delta":
                    delta = evt.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text_parts.append(delta.get("text", ""))
                elif evt.get("type") == "message_stop":
                    break

    full_text = "".join(text_parts)
    return {
        "id": "fcc-proxy",
        "object": "chat.completion",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": full_text},
            "finish_reason": "stop",
        }],
        "usage": {"total_tokens": 0},
    }


async def _stream_response(payload: dict):
    async def gen():
        async with AsyncClient(timeout=Timeout(120)) as cli:
            async with cli.stream(
                "POST", FCC_URL,
                json=payload,
                headers={"x-api-key": FCC_API_KEY, "Content-Type": "application/json"},
            ) as resp:
                async for raw in resp.aiter_lines():
                    if not raw.startswith("data: "):
                        continue
                    line = raw[6:]
                    try:
                        evt = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if evt.get("type") == "content_block_delta":
                        delta = evt.get("delta", {})
                        if delta.get("type") == "text_delta":
                            text = delta.get("text", "")
                            chunk = {"choices": [{"delta": {"content": text}, "index": 0}]}
                            yield f"data: {json.dumps(chunk)}\n\n"
                    elif evt.get("type") == "message_stop":
                        yield "data: [DONE]\n\n"
                        return

    return StreamingResponse(gen(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8643)
