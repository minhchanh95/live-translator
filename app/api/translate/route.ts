import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TranslateBody = {
  text?: string;
  source?: string;
  target?: string;
};

const languageMap: Record<string, string> = {
  "ja-JP": "ja",
  "en-US": "en",
  "ko-KR": "ko",
  "zh-CN": "zh-CN",
  "vi-VN": "vi",
  "ru-RU": "ru",
  ja: "ja",
  en: "en",
  ko: "ko",
  vi: "vi",
  ru: "ru",
  auto: "auto",
};

function normalizeLanguage(code: string) {
  return languageMap[code] ?? code;
}

function decodeHtml(text: string) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function translateWithGoogleCloud(
  text: string,
  source: string,
  target: string,
) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_TRANSLATE_API_KEY_NOT_CONFIGURED");
  }

  const body: Record<string, unknown> = {
    q: text,
    target,
    format: "text",
  };

  if (source !== "auto") {
    body.source = source;
  }

  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Google Cloud Translation failed: ${response.status}`;
    throw new Error(message);
  }

  const translatedText =
    data?.data?.translations?.[0]?.translatedText?.trim?.() ?? "";

  if (!translatedText) {
    throw new Error("Google Cloud returned empty translation");
  }

  return decodeHtml(translatedText);
}

async function translateWithMyMemory(
  text: string,
  source: string,
  target: string,
) {
  // MyMemory does not accept "auto" in langpair.
  if (source === "auto") {
    throw new Error(
      "Fallback translator requires an explicit source language",
    );
  }

  const url =
    "https://api.mymemory.translated.net/get" +
    `?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(`${source}|${target}`)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`MyMemory failed: ${response.status}`);
  }

  const translatedText =
    data?.responseData?.translatedText?.trim?.() ?? "";

  if (!translatedText) {
    throw new Error("MyMemory returned empty translation");
  }

  // MyMemory may return a 200 response with a usage/rate-limit message.
  const details = String(data?.responseDetails ?? "");
  if (
    details &&
    !details.toUpperCase().includes("OK") &&
    Number(data?.responseStatus ?? 200) !== 200
  ) {
    throw new Error(details);
  }

  return decodeHtml(translatedText);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslateBody;

    const text = String(body?.text ?? "").trim();
    const source = normalizeLanguage(String(body?.source ?? "auto"));
    const target = normalizeLanguage(String(body?.target ?? "vi"));

    if (!text) {
      return NextResponse.json(
        { error: "Missing text" },
        { status: 400 },
      );
    }

    if (!target) {
      return NextResponse.json(
        { error: "Missing target language" },
        { status: 400 },
      );
    }

    // Prefer the official Google Cloud Translation API if configured.
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      try {
        const translatedText = await translateWithGoogleCloud(
          text,
          source,
          target,
        );

        return NextResponse.json({
          translatedText,
          provider: "google-cloud",
        });
      } catch (googleError) {
        console.error("Google Cloud Translation error:", googleError);

        // Fall through to the free fallback instead of breaking the UI.
      }
    }

    // Free fallback. Good for testing/light usage, but has its own quota.
    const translatedText = await translateWithMyMemory(
      text,
      source,
      target,
    );

    return NextResponse.json({
      translatedText,
      provider: "mymemory",
    });
  } catch (error) {
    console.error("/api/translate error:", error);

    const message =
      error instanceof Error ? error.message : "Translation failed";

    return NextResponse.json(
      { error: message },
      { status: 502 },
    );
  }
}
