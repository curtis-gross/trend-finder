import os
from typing import Any, List, Optional

from fastapi import Request
from google import genai
from google.genai import types
from pydantic import AliasChoices
from pydantic.fields import FieldInfo

from backend.core_modules.genai_image_and_creative_index import (
    get_gcp_project,
    get_genai_provider,
    is_ai_studio_api_key,
    resolve_genai_api_key,
    resolve_genai_key_source,
)

# Dynamically patch types.ThinkingConfig in google.genai SDK if thinking_level is missing
if "thinking_level" not in getattr(types.ThinkingConfig, "model_fields", {}):
    types.ThinkingConfig.model_fields["thinking_level"] = FieldInfo(
        annotation=Optional[str],
        default=None,
        alias="thinkingLevel",
        validation_alias=AliasChoices("thinking_level", "thinkingLevel"),
        description="Thinking level for models supporting it (LOW, MEDIUM, HIGH, MINIMAL, OFF)",
    )
    types.ThinkingConfig.model_rebuild(force=True)


def get_genai_clients(req: Optional[Request] = None):
    provider = get_genai_provider()
    project = get_gcp_project() if provider != "aistudio" else ""
    api_key, key_source = resolve_genai_key_source(req)
    default_http_options = types.HttpOptions()
    vertex_location = (os.environ.get("VERTEX_LOCATION") or "global").strip() or "global"

    ai_regional = None
    ai_global = None
    ai_api_key = None

    if project and provider != "aistudio":
        try:
            ai_regional = genai.Client(
                vertexai=True,
                project=project,
                location=vertex_location,
                http_options=default_http_options,
            )
            ai_global = genai.Client(
                vertexai=True,
                project=project,
                location="global",
                http_options=default_http_options,
            )
        except Exception as e:
            print(f"[Slice A GenAI] Warning: Failed to init Vertex client: {e}")

    if api_key:
        use_ai_studio = is_ai_studio_api_key(api_key, source=key_source)
        try:
            if use_ai_studio:
                ai_api_key = genai.Client(
                    vertexai=False,
                    api_key=api_key,
                    http_options=default_http_options,
                )
                setattr(ai_api_key, "_is_ai_studio", True)
            else:
                ai_api_key = genai.Client(
                    vertexai=True,
                    api_key=api_key,
                    http_options=default_http_options,
                )
                setattr(ai_api_key, "_is_ai_studio", False)
        except Exception:
            try:
                ai_api_key = genai.Client(
                    vertexai=not use_ai_studio,
                    api_key=api_key,
                    http_options=default_http_options,
                )
                setattr(ai_api_key, "_is_ai_studio", use_ai_studio)
            except Exception as e2:
                print(f"[Slice A GenAI] Warning: Failed to init API key client: {e2}")

    if provider == "aistudio":
        primary = ai_api_key
    else:
        primary = ai_global or ai_regional or ai_api_key
    return primary, ai_global, ai_api_key


def get_ordered_genai_clients(req: Optional[Request] = None) -> List[Any]:
    provider = get_genai_provider()
    primary_client, global_client, api_client = get_genai_clients(req)
    gcloud_key = (os.environ.get("GOOGLE_CLOUD_API_KEY") or "").strip().replace('"', "").replace("'", "")
    if provider == "aistudio":
        candidates = [api_client]
    elif gcloud_key and provider != "aistudio":
        candidates = [api_client, global_client, primary_client]
    else:
        candidates = [global_client, primary_client, api_client]
    seen = set()
    result = []
    for c in candidates:
        if c is not None and id(c) not in seen:
            seen.add(id(c))
            result.append(c)
    return result


def sanitize_generate_content_config(cfg: Any) -> Any:
    if not isinstance(cfg, dict):
        return cfg
    cleaned = dict(cfg)

    for ikey in ("imageConfig", "image_config"):
        if isinstance(cleaned.get(ikey), dict):
            ic = dict(cleaned.pop(ikey))
            ic.pop("image_size", None)
            ic.pop("imageSize", None)
            ic.pop("output_mime_type", None)
            ic.pop("outputMimeType", None)
            cleaned["image_config"] = ic

    tc_raw = cleaned.pop("thinkingConfig", None) or cleaned.pop("thinking_config", None)
    if isinstance(tc_raw, dict):
        tc = dict(tc_raw)
        level = tc.pop("thinkingLevel", None) or tc.pop("thinking_level", None)
        budget = tc.pop("thinkingBudget", None) or tc.pop("thinking_budget", None)

        if level is not None:
            norm_level = str(level).strip().upper()
        elif budget is not None:
            try:
                b_int = int(budget)
                if b_int == 0:
                    norm_level = "OFF"
                elif b_int <= 1024:
                    norm_level = "LOW"
                elif b_int <= 4096:
                    norm_level = "MEDIUM"
                else:
                    norm_level = "HIGH"
            except (ValueError, TypeError):
                norm_level = "LOW"
        else:
            norm_level = "LOW"

        cleaned["thinking_config"] = {"thinking_level": norm_level}

    return cleaned
