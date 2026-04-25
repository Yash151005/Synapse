import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs "Rachel" — clear, neutral

export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not set" }, { status: 500 });
  }

  const { text } = (await request.json()) as { text?: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, 500),
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!res.ok) {
    const msg = await res.text();
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
