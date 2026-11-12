import asyncio
import base64
import random
import re
import string
import struct
import time
from typing import Union

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from google.genai import types

from backend.core import (
    ROOT_DIR,
    get_active_company_name,
    get_gcs_bucket_name,
    get_storage_client,
)
from backend.routers.genai_client_factory import get_ordered_genai_clients

router = APIRouter()


def _extract_inline_bytes(data_val: Union[bytes, str, None]) -> bytes:
    if not data_val:
        return b""
    if isinstance(data_val, bytes):
        return data_val
    if isinstance(data_val, str):
        return base64.b64decode(data_val)
    return bytes(data_val)


def _create_wav_header(
    data_length: int,
    sample_rate: int = 24000,
    num_channels: int = 1,
    bits_per_sample: int = 16,
) -> bytes:
    byte_rate = (sample_rate * num_channels * bits_per_sample) // 8
    block_align = (num_channels * bits_per_sample) // 8
    return struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_length,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_length,
    )


async def handle_gemini_tts_synthesis(request: Request) -> JSONResponse:
    try:
        try:
            body = await request.json()
        except Exception:
            body = {}

        script_text = str(body.get("text") or body.get("transcript") or body.get("textData") or "").strip()
        if not script_text:
            return JSONResponse(status_code=400, content={"error": "Missing required text or script for Gemini TTS synthesis."})

        raw_voice_name = body.get("voiceName", "Aoede")
        company_name = body.get("companyName") or get_active_company_name() or "test-company"
        requested_model = body.get("model")

        valid_voices = ["Aoede", "Fenrir", "Kore", "Puck", "Charon", "Zephyr"]
        voice_name = next((v for v in valid_voices if v.lower() == str(raw_voice_name).lower()), "Aoede")

        base_models = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-tts", "gemini-2.5-pro-tts"]
        models_to_try = [requested_model, *base_models] if requested_model else base_models

        clients = get_ordered_genai_clients(request)
        client_to_use = clients[0] if clients else None
        if not client_to_use:
            return JSONResponse(status_code=500, content={"error": "GoogleGenAI client not initialized on server."})

        tts_inline_data = None
        used_model = None
        last_error = None

        for candidate_model in models_to_try:
            try:
                response = await asyncio.to_thread(
                    client_to_use.models.generate_content,
                    model=candidate_model,
                    contents=[
                        types.Content(
                            role="user",
                            parts=[
                                types.Part.from_text(
                                    text=(
                                        "Read this executive intelligence briefing transcript clearly, "
                                        "authoritatively, and naturally with professional executive broadcast pacing:\n\n"
                                        f"{script_text}"
                                    )
                                )
                            ],
                        )
                    ],
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                            )
                        ),
                    ),
                )
                cand = response.candidates[0] if response.candidates else None
                part = cand.content.parts[0] if (cand and cand.content and cand.content.parts) else None
                if part and part.inline_data and part.inline_data.data:
                    tts_inline_data = part.inline_data
                    used_model = candidate_model
                    break
            except Exception as err:
                last_error = err

        if not tts_inline_data or not tts_inline_data.data:
            err_msg = str(last_error) if last_error else "No audio data returned from Gemini"
            return JSONResponse(status_code=500, content={"error": f"Gemini 3.1 Flash TTS audio synthesis failed: {err_msg}", "details": err_msg})

        raw_buffer = _extract_inline_bytes(tts_inline_data.data)
        mime_type = tts_inline_data.mime_type or "audio/pcm;rate=24000"
        m = re.search(r"rate=(\d+)", mime_type)
        sample_rate = int(m.group(1)) if m else 24000
        byte_rate = (sample_rate * 1 * 16) // 8

        wav_buffer = _create_wav_header(len(raw_buffer), sample_rate, 1, 16) + raw_buffer
        duration_seconds = max(1, round(len(raw_buffer) / byte_rate))

        rand_suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
        filename = f"daily_brief_{int(time.time() * 1000)}_{rand_suffix}.wav"

        for out_dir in (ROOT_DIR / "public" / "audio" / "generated", ROOT_DIR / "dist" / "audio" / "generated"):
            out_dir.mkdir(parents=True, exist_ok=True)
            (out_dir / filename).write_bytes(wav_buffer)

        gcs_uri = None
        try:
            gcs_client = get_storage_client()
            bucket_name = get_gcs_bucket_name()
            if gcs_client and bucket_name:
                gcs_path = f"{company_name}/audio/{filename}"
                blob = gcs_client.bucket(bucket_name).blob(gcs_path)
                blob.cache_control = "public, max-age=3600"
                blob.upload_from_string(wav_buffer, content_type="audio/wav")
                gcs_uri = f"gs://{bucket_name}/{gcs_path}"
        except Exception:
            pass

        return JSONResponse(
            content={
                "success": True,
                "audioUrl": f"/audio/generated/{filename}",
                "durationSeconds": duration_seconds,
                "voiceName": voice_name,
                "model": used_model,
                "gcsUri": gcs_uri,
            }
        )
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": f"Failed to generate podcast audio: {err}"})


@router.post("/api/tts/generate-podcast")
async def tts_generate_podcast(request: Request):
    return await handle_gemini_tts_synthesis(request)
