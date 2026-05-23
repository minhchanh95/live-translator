"use client";

import { useEffect, useRef, useState } from "react";

const sourceLanguages = [
  { code: "ja-JP", translateCode: "ja", label: "Japanese" },
  { code: "en-US", translateCode: "en", label: "English" },
  { code: "ko-KR", translateCode: "ko", label: "Korean" },
  { code: "zh-CN", translateCode: "zh-CN", label: "Chinese" },
  { code: "vi-VN", translateCode: "vi", label: "Vietnamese" },
];

export default function Home() {
  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);

  const originalBoxRef = useRef<HTMLDivElement | null>(null);
  const translationBoxRef = useRef<HTMLDivElement | null>(null);

  const [listening, setListening] = useState(false);
  const [sourceLang, setSourceLang] = useState("ja-JP");

  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const [vietnameseText, setVietnameseText] = useState("");
  const [interimVietnameseText, setInterimVietnameseText] = useState("");

  const [status, setStatus] = useState("Waiting...");
  const [translating, setTranslating] = useState(false);

  const getSourceTranslateCode = () => {
    return (
      sourceLanguages.find((lang) => lang.code === sourceLang)?.translateCode ||
      "auto"
    );
  };

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return;

    requestAnimationFrame(() => {
      if (!ref.current) return;
      ref.current.scrollTop = ref.current.scrollHeight;
    });
  };

  useEffect(() => {
    scrollToBottom(originalBoxRef);
  }, [finalTranscript, interimTranscript]);

  useEffect(() => {
    scrollToBottom(translationBoxRef);
  }, [vietnameseText, interimVietnameseText]);

  const safeStartRecognition = () => {
    const recognition = recognitionRef.current;

    if (!recognition || !shouldKeepListeningRef.current) return;

    try {
      recognition.start();
    } catch {
      // Chrome throws if recognition is already started.
    }
  };

  const scheduleRestart = (delay = 700) => {
    if (!shouldKeepListeningRef.current) return;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }

    restartTimerRef.current = setTimeout(() => {
      safeStartRecognition();
    }, delay);
  };

  const translateText = async (text: string, interim = false) => {
    if (!text.trim()) return;

    try {
      if (!interim) setTranslating(true);

      const sl = getSourceTranslateCode();

      const url =
        "https://translate.googleapis.com/translate_a/single" +
        `?client=gtx` +
        `&sl=${encodeURIComponent(sl)}` +
        `&tl=vi` +
        `&dt=t` +
        `&q=${encodeURIComponent(text)}`;

      const res = await fetch(url);
      const rawText = await res.text();

      if (rawText.trim().startsWith("<")) {
        console.warn("Google Translate returned HTML instead of JSON");
        return;
      }

      const data = JSON.parse(rawText);

      const translated = data[0].map((item: any) => item[0]).join("");

      if (interim) {
        setInterimVietnameseText(translated);
      } else {
        setVietnameseText((prev) => prev + translated + " ");
      }
    } catch (error) {
      console.warn("Translate warning:", error);

      if (!interim) {
        setVietnameseText((prev) => prev + "\n[Dịch lỗi]\n");
      }
    } finally {
      if (!interim) setTranslating(false);
    }
  };

  const startTranslate = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Browser không hỗ trợ Web Speech API. Hãy dùng Google Chrome.");
      return;
    }

    if (recognitionRef.current) {
      shouldKeepListeningRef.current = true;
      setListening(true);
      safeStartRecognition();
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = sourceLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setStatus("Listening... auto reconnect ON");
    };

    recognition.onresult = async (event: any) => {
      let interim = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += text + " ";
        } else {
          interim += text;
        }
      }

      if (finalText.trim()) {
        setFinalTranscript((prev) => prev + finalText);
        await translateText(finalText, false);
        setInterimVietnameseText("");
      }

      setInterimTranscript(interim);

      if (interim.trim()) {
        translateText(interim, true);
      }
    };

    recognition.onerror = (event: any) => {
      const error = event.error || "unknown";

      console.warn("Speech recognition warning:", error);

      if (!shouldKeepListeningRef.current) return;

      if (error === "not-allowed") {
        shouldKeepListeningRef.current = false;
        setListening(false);
        setStatus("Chrome chưa được cấp quyền microphone.");
        alert("Hãy Allow microphone cho localhost.");
        return;
      }

      if (error === "audio-capture") {
        setStatus(
          "Không capture được microphone. Hãy chọn VB-CABLE / BlackHole / Voicemeeter Out B1.",
        );
        scheduleRestart(1500);
        return;
      }

      if (error === "network") {
        setStatus("Speech recognition network error. Reconnecting...");
        scheduleRestart(1500);
        return;
      }

      if (error === "no-speech") {
        setStatus("No speech detected. Still listening...");
        scheduleRestart(800);
        return;
      }

      if (error === "aborted") {
        setStatus("Speech recognition aborted. Reconnecting...");
        scheduleRestart(800);
        return;
      }

      setStatus(`Speech recognition warning: ${error}. Reconnecting...`);
      scheduleRestart(1000);
    };

    recognition.onend = () => {
      if (shouldKeepListeningRef.current) {
        setStatus("Recognition ended by browser. Reconnecting...");
        scheduleRestart(500);
      } else {
        setListening(false);
        setStatus("Stopped");
      }
    };

    recognitionRef.current = recognition;
    shouldKeepListeningRef.current = true;

    safeStartRecognition();
  };

  const stopTranslate = () => {
    shouldKeepListeningRef.current = false;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }

    recognitionRef.current = null;
    setListening(false);
    setStatus("Stopped");
  };

  const clearText = () => {
    setFinalTranscript("");
    setInterimTranscript("");
    setVietnameseText("");
    setInterimVietnameseText("");
  };
  const downloadOriginalText = () => {
    const content = finalTranscript + "\n" + interimTranscript;

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;

    const now = new Date();

    const filename =
      `original-script-${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getDate()).padStart(2, "0")}-` +
      `${String(now.getHours()).padStart(2, "0")}-` +
      `${String(now.getMinutes()).padStart(2, "0")}.txt`;

    a.download = filename;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };

  return (
    <main
      style={{
        padding: 32,
        fontFamily: "Arial, sans-serif",
        background: "#0f172a",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <h1 style={{ fontSize: 48, fontWeight: "bold", marginBottom: 16 }}>
        Live Event Translator - Free
      </h1>

      <p style={{ marginBottom: 24, color: "#cbd5e1" }}>
        Headphone supported via BlackHole / VB-CABLE / Voicemeeter.
      </p>

      <div style={{ marginBottom: 24 }}>
        <label>Input Language:</label>
        <br />

        <select
          value={sourceLang}
          disabled={listening}
          onChange={(e) => setSourceLang(e.target.value)}
          style={{
            padding: 10,
            marginTop: 8,
            borderRadius: 8,
            background: "#1e293b",
            color: "white",
            border: "1px solid #475569",
          }}
        >
          {sourceLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {!listening ? (
          <button onClick={startTranslate} style={buttonStyle("#16a34a")}>
            Start Free Translate
          </button>
        ) : (
          <button onClick={stopTranslate} style={buttonStyle("#dc2626")}>
            Stop
          </button>
        )}

        <button onClick={clearText} style={buttonStyle("#475569")}>
          Clear
        </button>
      </div>

      <p style={{ marginBottom: 24, color: "#facc15", whiteSpace: "pre-wrap" }}>
        Status: {status}
      </p>

      <div
        style={{
          background: "#1e293b",
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
          color: "#cbd5e1",
        }}
      >
        <b>Recommended setup:</b>
        <ol>
          <li>Mac: Chrome microphone = BlackHole 2ch</li>
          <li>Windows: Chrome microphone = Voicemeeter Out B1</li>
          <li>Zoom/Teams microphone = real microphone, not virtual audio</li>
          <li>Use Chrome browser</li>
        </ol>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h2>Original</h2>

            <button
              onClick={downloadOriginalText}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Download TXT
            </button>
          </div>

          <div ref={originalBoxRef} style={boxStyle("#000000", "#ffffff")}>
            <span>{finalTranscript}</span>
            <span style={{ color: "#999" }}>{interimTranscript}</span>

            {!finalTranscript && !interimTranscript
              ? "Original speech will appear here..."
              : ""}
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: 12 }}>
            Vietnamese Translation {translating ? "..." : ""}
          </h2>

          <div ref={translationBoxRef} style={boxStyle("#052e16", "#bbf7d0")}>
            <span>{vietnameseText}</span>
            <span style={{ color: "#7ddfa8" }}>{interimVietnameseText}</span>

            {!vietnameseText && !interimVietnameseText
              ? "Vietnamese translation will appear here..."
              : ""}
          </div>
        </div>
      </div>
    </main>
  );
}

function buttonStyle(background: string): React.CSSProperties {
  return {
    padding: "12px 20px",
    background,
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
  };
}

function boxStyle(background: string, color: string): React.CSSProperties {
  return {
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 16,

    height: "420px",
    maxHeight: "420px",

    background,
    color,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    lineHeight: 1.6,

    overflowY: "auto",
    overflowX: "hidden",
    scrollBehavior: "smooth",
  };
}
