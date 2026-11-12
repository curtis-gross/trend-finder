import asyncio
import base64
import os
from typing import Any, Dict

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from backend.routers.genai_client_factory import (
    get_genai_clients,
    get_ordered_genai_clients,
    sanitize_generate_content_config,
)

router = APIRouter()


@router.get("/health")
@router.get("/healthz")
async def health_check():
    return PlainTextResponse("OK")


@router.post("/api/genai/generateContent")
async def generate_content(request: Request):
    body = await request.json()
    model = body.get("model") or os.environ.get("GEMINI_FLASH_MODEL", "gemini-3.8-flash")
    contents = body.get("contents", [])
    config = body.get("config", {}) or {}

    if model in ["gemini-3.5-flash", "gemini-3.6", "gemini-3.8-flash-low", "gemini-3-8-flash-low"]:
        model = "gemini-3.8-flash"

    if "4-argon" in model or "3.8-flash" in model:
        if "thinkingConfig" not in config and "thinking_config" not in config:
            config["thinking_config"] = {"thinking_level": "LOW"}

    if "3.8-flash" in model:
        if "mediaResolution" not in config and "media_resolution" not in config:
            config["media_resolution"] = "MEDIA_RESOLUTION_MEDIUM"
        if "maxOutputTokens" not in config and "max_output_tokens" not in config:
            config["max_output_tokens"] = 32768
        if "safetySettings" not in config and "safety_settings" not in config:
            config["safety_settings"] = [
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
            ]

    if "4-argon" in model:
        if "mediaResolution" not in config and "media_resolution" not in config:
            config["media_resolution"] = "MEDIA_RESOLUTION_LOW"
        if "safetySettings" not in config and "safety_settings" not in config:
            config["safety_settings"] = [
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF"},
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF"},
            ]

    clients_to_try = get_ordered_genai_clients(request)
    if not clients_to_try:
        return JSONResponse(
            status_code=500,
            content={"error": "GoogleGenAI client not initialized. Check GCP_PROJECT or GEMINI_API_KEY."},
        )

    if isinstance(contents, dict) and "parts" in contents:
        contents = [{"role": "user", "parts": contents["parts"]}]
    elif isinstance(contents, list):
        normalized = []
        for c in contents:
            if isinstance(c, dict):
                if "parts" not in c and "role" not in c:
                    normalized.append({"role": "user", "parts": [c]})
                elif "role" not in c:
                    normalized.append({"role": "user", "parts": c.get("parts", [])})
                else:
                    normalized.append(c)
            elif isinstance(c, str):
                normalized.append({"role": "user", "parts": [{"text": c}]})
        contents = normalized

    try:
        gen_kwargs: Dict[str, Any] = {"model": model, "contents": contents}
        if config:
            gen_kwargs["config"] = sanitize_generate_content_config(config)

        response = None
        last_error = None
        for candidate_client in clients_to_try:
            try:
                call_kwargs: Dict[str, Any] = dict(gen_kwargs)
                if getattr(candidate_client, "_is_ai_studio", False) and isinstance(call_kwargs.get("config"), dict):
                    cfg_clone = dict(call_kwargs["config"])
                    for skey in ("safety_settings", "safetySettings"):
                        if isinstance(cfg_clone.get(skey), list):
                            normalized_safety = []
                            for setting in cfg_clone[skey]:
                                if isinstance(setting, dict):
                                    s_copy = dict(setting)
                                    if str(s_copy.get("threshold", "")).upper() == "OFF":
                                        s_copy["threshold"] = "BLOCK_NONE"
                                    normalized_safety.append(s_copy)
                                else:
                                    normalized_safety.append(setting)
                            cfg_clone[skey] = normalized_safety
                    call_kwargs["config"] = cfg_clone
                response = await asyncio.to_thread(candidate_client.models.generate_content, **call_kwargs)
                break
            except Exception as client_exc:
                print(f"[Slice A GenAI Warning] Client attempt failed ({type(candidate_client).__name__}): {client_exc}")
                last_error = client_exc

        if response is None:
            raise last_error or RuntimeError(f"All GenAI clients ({len(clients_to_try)}) failed to generate content.")

        candidates = []
        function_calls_out = []
        if hasattr(response, "candidates") and response.candidates:
            for cand in response.candidates:
                cand_dict: Dict[str, Any] = {
                    "finishReason": str(cand.finish_reason) if hasattr(cand, "finish_reason") else "STOP"
                }
                if hasattr(cand, "content") and cand.content:
                    parts_list = []
                    for part in getattr(cand.content, "parts", []):
                        p_dict: Dict[str, Any] = {}
                        if hasattr(part, "text") and part.text:
                            p_dict["text"] = part.text
                        if hasattr(part, "function_call") and part.function_call:
                            fc = part.function_call
                            fc_obj = {
                                "name": getattr(fc, "name", ""),
                                "args": dict(getattr(fc, "args", {}) or {}),
                            }
                            p_dict["functionCall"] = fc_obj
                            function_calls_out.append(fc_obj)
                        if hasattr(part, "inline_data") and part.inline_data:
                            b64 = (
                                base64.b64encode(part.inline_data.data).decode("utf-8")
                                if isinstance(part.inline_data.data, bytes)
                                else str(part.inline_data.data)
                            )
                            p_dict["inlineData"] = {
                                "mimeType": part.inline_data.mime_type,
                                "data": b64,
                            }
                        if p_dict:
                            parts_list.append(p_dict)
                    cand_dict["content"] = {"parts": parts_list, "role": getattr(cand.content, "role", "model")}

                gm = getattr(cand, "grounding_metadata", None) or getattr(cand, "groundingMetadata", None)
                if gm is not None:
                    gm_dict: Dict[str, Any] = {}
                    if isinstance(gm, dict):
                        gm_dict = dict(gm)
                    elif hasattr(gm, "model_dump") and callable(gm.model_dump):
                        try:
                            dumped = gm.model_dump(by_alias=True, exclude_none=True)
                            if isinstance(dumped, dict):
                                gm_dict = dumped
                        except Exception:
                            gm_dict = {}

                    raw_queries = (
                        gm_dict.get("webSearchQueries")
                        or gm_dict.get("web_search_queries")
                        or getattr(gm, "web_search_queries", None)
                        or getattr(gm, "webSearchQueries", None)
                    )
                    if raw_queries is not None and not isinstance(raw_queries, (str, bytes)):
                        try:
                            gm_dict["webSearchQueries"] = [str(q) for q in raw_queries if q is not None]
                        except TypeError:
                            pass

                    raw_chunks = (
                        gm_dict.get("groundingChunks")
                        or gm_dict.get("grounding_chunks")
                        or getattr(gm, "grounding_chunks", None)
                        or getattr(gm, "groundingChunks", None)
                    )
                    if raw_chunks is not None and not isinstance(raw_chunks, (str, bytes)):
                        chunks_out = []
                        try:
                            for ch in raw_chunks:
                                if isinstance(ch, dict):
                                    w = ch.get("web")
                                    if isinstance(w, dict):
                                        chunks_out.append({
                                            "web": {
                                                "uri": w.get("uri") or "",
                                                "title": w.get("title") or "",
                                            }
                                        })
                                    else:
                                        chunks_out.append(ch)
                                else:
                                    w = getattr(ch, "web", None)
                                    if w is not None:
                                        uri = w.get("uri") if isinstance(w, dict) else getattr(w, "uri", None)
                                        title = w.get("title") if isinstance(w, dict) else getattr(w, "title", None)
                                        chunks_out.append({
                                            "web": {
                                                "uri": uri or "",
                                                "title": title or "",
                                            }
                                        })
                            gm_dict["groundingChunks"] = chunks_out
                        except TypeError:
                            pass

                    gm_dict.pop("web_search_queries", None)
                    gm_dict.pop("grounding_chunks", None)
                    if gm_dict:
                        cand_dict["groundingMetadata"] = gm_dict

                candidates.append(cand_dict)

        res_payload: Dict[str, Any] = {"candidates": candidates}
        if function_calls_out:
            res_payload["functionCalls"] = function_calls_out
        return res_payload

    except Exception as e:
        print(f"[Slice A GenAI Error] generateContent failed for model {model}: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"GenAI generateContent failed: {str(e)}"},
        )


__all__ = [
    "generate_content",
    "get_genai_clients",
    "get_ordered_genai_clients",
    "health_check",
    "router",
    "sanitize_generate_content_config",
]
