"use client";

import { useEffect, useRef, useState } from "react";

const sourceLanguages = [
  { code: "ja-JP", translateCode: "ja", label: "Japanese" },
  { code: "en-US", translateCode: "en", label: "English" },
  { code: "ko-KR", translateCode: "ko", label: "Korean" },
  { code: "zh-CN", translateCode: "zh-CN", label: "Chinese" },
  { code: "vi-VN", translateCode: "vi", label: "Vietnamese" },
  { code: "ru-RU", translateCode: "ru", label: "Russian" },
];

const targetLanguages = [
  { code: "vi", label: "Vietnamese" },
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh-CN", label: "Chinese" },
  { code: "ru", label: "Russian" },
];

type ScriptMessage = {
  id: number;
  sender: string;
  text: string;
};

export default function Home() {
  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);

  const originalBoxRef = useRef<HTMLDivElement | null>(null);
  const translationBoxRef = useRef<HTMLDivElement | null>(null);

  const [listening, setListening] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState(false);

  const [sourceLang, setSourceLang] = useState("ja-JP");
  const [targetLang, setTargetLang] = useState("vi");
  const targetLangRef = useRef("vi");

  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const [translatedText, setTranslatedText] = useState("");
  const [interimTranslatedText, setInterimTranslatedText] = useState("");
  const [latestTranslation, setLatestTranslation] = useState("");

  const [originalMessages, setOriginalMessages] = useState<ScriptMessage[]>([]);
  const [translatedMessages, setTranslatedMessages] = useState<ScriptMessage[]>(
    [],
  );

  const [status, setStatus] = useState("Waiting...");
  const [translating, setTranslating] = useState(false);

  const getSourceTranslateCode = () => {
    return (
      sourceLanguages.find((lang) => lang.code === sourceLang)?.translateCode ||
      "auto"
    );
  };

  const getTargetLabel = () => {
    return (
      targetLanguages.find((lang) => lang.code === targetLang)?.label ||
      "Translation"
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
  }, [finalTranscript, interimTranscript, originalMessages]);

  useEffect(() => {
    scrollToBottom(translationBoxRef);
  }, [translatedText, interimTranslatedText, translatedMessages]);

  useEffect(() => {
    targetLangRef.current = targetLang;
  }, [targetLang]);

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
        `&tl=${encodeURIComponent(targetLangRef.current)}` +
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
        setInterimTranslatedText(translated);
        setLatestTranslation(translated);
      } else {
        setTranslatedText((prev) => prev + translated + " ");
        setLatestTranslation(translated);

        setTranslatedMessages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            sender: getTargetLabel(),
            text: translated,
          },
        ]);
      }
    } catch (error) {
      console.warn("Translate warning:", error);

      if (!interim) {
        setTranslatedText((prev) => prev + "\n[Dịch lỗi]\n");

        setTranslatedMessages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            sender: getTargetLabel(),
            text: "[Dịch lỗi]",
          },
        ]);
      }
    } finally {
      if (!interim) setTranslating(false);
    }
  };

  const changeTargetLanguage = (newLang: string) => {
    targetLangRef.current = newLang;
    setTargetLang(newLang);
    setTranslatedText("");
    setInterimTranslatedText("");
    setTranslatedMessages([]);
    setLatestTranslation("Switching language...");
    setStatus(`Switched target language to ${newLang}`);
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
        const cleanFinalText = finalText.trim();

        setFinalTranscript((prev) => prev + finalText);

        setOriginalMessages((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            sender: "Original",
            text: cleanFinalText,
          },
        ]);

        await translateText(finalText, false);
        setInterimTranslatedText("");
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
    setTranslatedText("");
    setInterimTranslatedText("");
    setLatestTranslation("");
    setOriginalMessages([]);
    setTranslatedMessages([]);
  };

  const downloadOriginalText = () => {
    const content = `${finalTranscript}\n${interimTranscript}`.trim();

    if (!content) {
      alert("Original script chưa có nội dung để download.");
      return;
    }

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const now = new Date();

    const filename =
      `original-script-${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getDate()).padStart(2, "0")}-` +
      `${String(now.getHours()).padStart(2, "0")}-` +
      `${String(now.getMinutes()).padStart(2, "0")}.txt`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main style={mainStyle(subtitleMode)}>
      {!subtitleMode && (
        <>
          <h1 style={{ fontSize: 48, fontWeight: "bold", marginBottom: 16 }}>
            Live Event Translator - Free
          </h1>

          <p style={{ marginBottom: 24, color: "#cbd5e1" }}>
            Headphone supported via BlackHole / VB-CABLE / Voicemeeter.
          </p>

          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <div>
              <label>Input Language:</label>
              <br />

              <select
                value={sourceLang}
                disabled={listening}
                onChange={(e) => setSourceLang(e.target.value)}
                style={selectStyle}
              >
                {sourceLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Target Language:</label>
              <br />

              <select
                value={targetLang}
                onChange={(e) => changeTargetLanguage(e.target.value)}
                style={selectStyle}
              >
                {targetLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
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

            <button
              onClick={() => setSubtitleMode(true)}
              style={buttonStyle("#7c3aed")}
            >
              Subtitle Mode
            </button>
          </div>

          <p
            style={{
              marginBottom: 24,
              color: "#facc15",
              whiteSpace: "pre-wrap",
            }}
          >
            Status: {status}
          </p>

          <div style={guideBoxStyle}>
            <b>Recommended setup:</b>
            <ol>
              <li>Mac: Chrome microphone = BlackHole 2ch</li>
              <li>Windows: Chrome microphone = Voicemeeter Out B1</li>
              <li>
                Zoom/Teams microphone = real microphone, not virtual audio
              </li>
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
                <h2 style={{ margin: 0 }}>Original</h2>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={clearText}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "#475569",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Clear
                  </button>

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
              </div>

              <div ref={originalBoxRef} style={boxStyle("#000000", "#ffffff")}>
                <ScriptList
                  messages={originalMessages}
                  interimText={interimTranscript}
                  interimSender="Live"
                  emptyText="Original speech will appear here..."
                />
              </div>
            </div>

            <div>
              <h2 style={{ marginBottom: 12 }}>
                {getTargetLabel()} Translation {translating ? "..." : ""}
              </h2>

              <div
                ref={translationBoxRef}
                style={boxStyle("#052e16", "#bbf7d0")}
              >
                <ScriptList
                  messages={translatedMessages}
                  interimText={interimTranslatedText}
                  interimSender="Live"
                  emptyText={`${getTargetLabel()} translation will appear here...`}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {subtitleMode && (
        <section style={subtitlePageStyle}>
          <select
            value={targetLang}
            onChange={(e) => changeTargetLanguage(e.target.value)}
            style={subtitleSelectStyle}
          >
            {targetLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSubtitleMode(false)}
            style={exitButtonStyle}
          >
            Exit
          </button>

          <div style={subtitleBarStyle}>
            {latestTranslation || "Waiting for translation..."}
          </div>
        </section>
      )}
    </main>
  );
}

function ScriptList({
  messages,
  interimText,
  interimSender,
  emptyText,
}: {
  messages: ScriptMessage[];
  interimText: string;
  interimSender: string;
  emptyText: string;
}) {
  if (messages.length === 0 && !interimText) {
    return <div style={{ color: "#94a3b8" }}>{emptyText}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {messages.map((msg) => (
        <div key={msg.id} style={messageRowStyle}>
          <div style={avatarStyle}>{msg.sender.charAt(0)}</div>

          <div style={{ flex: 1 }}>
            <div style={senderStyle}>{msg.sender}</div>
            <div style={messageTextStyle}>{msg.text}</div>
          </div>
        </div>
      ))}

      {interimText && (
        <div style={{ ...messageRowStyle, opacity: 0.65 }}>
          <div style={avatarStyle}>{interimSender.charAt(0)}</div>

          <div style={{ flex: 1 }}>
            <div style={senderStyle}>{interimSender}</div>
            <div style={messageTextStyle}>{interimText}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function mainStyle(subtitleMode: boolean): React.CSSProperties {
  if (subtitleMode) {
    return {
      margin: 0,
      padding: 0,
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "transparent",
      color: "white",
      fontFamily: "Arial, sans-serif",
    };
  }

  return {
    padding: 32,
    fontFamily: "Arial, sans-serif",
    background: "#0f172a",
    minHeight: "100vh",
    color: "white",
  };
}

const subtitlePageStyle: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  position: "relative",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const subtitleBarStyle: React.CSSProperties = {
  width: "70%",
  maxWidth: 680,
  background: "rgba(0, 0, 0, 0.75)",
  color: "white",
  padding: "8px 16px",
  borderRadius: 10,
  fontSize: 18,
  fontWeight: 700,
  lineHeight: 1.25,
  textAlign: "center",
};

const subtitleSelectStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  left: 10,
  zIndex: 100000,
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(0,0,0,0.75)",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const exitButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  zIndex: 100000,
  padding: "6px 10px",
  borderRadius: 8,
  border: "none",
  background: "rgba(0,0,0,0.75)",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
};

const selectStyle: React.CSSProperties = {
  padding: 10,
  marginTop: 8,
  borderRadius: 8,
  background: "#1e293b",
  color: "white",
  border: "1px solid #475569",
};

const guideBoxStyle: React.CSSProperties = {
  background: "#1e293b",
  padding: 16,
  borderRadius: 12,
  marginBottom: 24,
  color: "#cbd5e1",
};

const messageRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
};

const avatarStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  minWidth: 36,
  borderRadius: "50%",
  background: "#334155",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: 16,
};

const senderStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#cbd5e1",
  marginBottom: 3,
  fontSize: 14,
};

const messageTextStyle: React.CSSProperties = {
  fontSize: "clamp(18px, 1.6vw, 28px)",
  lineHeight: 1.45,
  color: "white",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontWeight: 500,
};

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