import { NextRequest, NextResponse } from "next/server";
import {
  ELEVENLABS_API_URL,
  ELEVENLABS_VOICE_ID,
  ELEVENLABS_MODEL_ID,
} from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TTSRequest {
  text: string;
}

// ─── POST /api/tts ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: TTSRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text } = body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // Call ElevenLabs streaming TTS endpoint
  const url = `${ELEVENLABS_API_URL}/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: text.trim(),
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`ElevenLabs API error ${response.status}: ${errorText}`);
    return NextResponse.json(
      { error: "TTS generation failed", details: errorText },
      { status: response.status }
    );
  }

  // Stream the MP3 audio back to the client
  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache",
    },
  });
}
