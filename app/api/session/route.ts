import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function buildSessionConfig(targetLanguage: string) {
  return {
    type: "realtime",
    model: process.env.OPENAI_MODEL || "gpt-realtime",
    instructions: [
      "You are a live event interpreter.",
      "Listen to the speaker audio.",
      `Translate the meaning into ${targetLanguage} immediately and naturally.`,
      "Return only the translation text. Do not add explanations.",
      "If the audio is unclear, return a short best-effort translation.",
    ].join("\n"),
    audio: {
      input: {
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
          create_response: true,
        },
      },
      output: {
        voice: "marin",
      },
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const sdp = await req.text();
    if (!sdp || !sdp.includes("v=0")) {
      return NextResponse.json({ error: "Invalid SDP offer" }, { status: 400 });
    }

    const targetLanguage = req.nextUrl.searchParams.get("target") || "Vietnamese";
    const fd = new FormData();
    fd.set("sdp", sdp);
    fd.set("session", JSON.stringify(buildSessionConfig(targetLanguage)));

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": "live-event-translator-demo-user",
      },
      body: fd,
    });

    const answerSdp = await response.text();
    if (!response.ok) {
      return new NextResponse(answerSdp, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new NextResponse(answerSdp, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create realtime session" }, { status: 500 });
  }
}
