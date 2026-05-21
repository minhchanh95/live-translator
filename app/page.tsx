"use client";

import { useRef, useState } from "react";

const sourceLanguages = [
  { code: "ja-JP", translateCode: "ja", label: "Japanese" },
  { code: "en-US", translateCode: "en", label: "English" },
  { code: "ko-KR", translateCode: "ko", label: "Korean" },
  { code: "zh-CN", translateCode: "zh-CN", label: "Chinese" },
  { code: "vi-VN", translateCode: "vi", label: "Vietnamese" },
];

export default function Home() {
  const recognitionRef = useRef<any>(null);

  const [listening, setListening] = useState(false);

  const [sourceLang, setSourceLang] =
    useState("ja-JP");

  const [finalTranscript, setFinalTranscript] =
    useState("");

  const [interimTranscript, setInterimTranscript] =
    useState("");

  const [vietnameseText, setVietnameseText] =
    useState("");

  const [
    interimVietnameseText,
    setInterimVietnameseText,
  ] = useState("");

  const [status, setStatus] =
    useState("Waiting...");

  const [translating, setTranslating] =
    useState(false);

  const getSourceTranslateCode = () => {
    return (
      sourceLanguages.find(
        (l) => l.code === sourceLang
      )?.translateCode || "auto"
    );
  };

  // ============================================
  // TRANSLATE
  // ============================================
  const translateText = async (
    text: string,
    interim = false
  ) => {
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

      // ============================================
      // FIX HTML RESPONSE
      // ============================================
      const rawText = await res.text();

      console.log(
        "Google raw response:",
        rawText
      );

      // Google trả HTML thay vì JSON
      if (rawText.startsWith("<")) {
        console.warn(
          "Google returned HTML instead of JSON"
        );

        return;
      }

      const data = JSON.parse(rawText);

      const translated = data[0]
        .map((item: any) => item[0])
        .join("");

      if (interim) {
        setInterimVietnameseText(translated);
      } else {
        setVietnameseText(
          (prev) => prev + translated + " "
        );
      }
    } catch (error) {
      console.warn("Translate warning:", error);
    } finally {
      if (!interim) setTranslating(false);
    }
  };

  // ============================================
  // START TRANSLATE
  // ============================================
  const startTranslate = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Browser không hỗ trợ Web Speech API.\nHãy dùng Google Chrome."
      );

      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = sourceLang;

    recognition.continuous = true;

    recognition.interimResults = true;

    recognition.maxAlternatives = 1;

    // ============================================
    // START
    // ============================================
    recognition.onstart = () => {
      console.log(
        "Speech recognition started"
      );

      setListening(true);

      setStatus(
        "Listening... (BlackHole/VB-CABLE mode)"
      );
    };

    // ============================================
    // RESULT
    // ============================================
    recognition.onresult = async (
      event: any
    ) => {
      let interim = "";

      let finalText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const text =
          event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += text + " ";
        } else {
          interim += text;
        }
      }

      // FINAL
      if (finalText.trim()) {
        setFinalTranscript(
          (prev) => prev + finalText
        );

        await translateText(finalText, false);

        setInterimVietnameseText("");
      }

      // INTERIM
      setInterimTranscript(interim);

      if (interim.trim()) {
        translateText(interim, true);
      }
    };

    // ============================================
    // ERROR
    // ============================================
    recognition.onerror = (event: any) => {
      const error =
        event.error || "unknown";

      console.warn(
        "Speech recognition warning:",
        error
      );

      // no speech
      if (error === "no-speech") {
        setStatus(
          "Không nghe thấy âm thanh.\nHãy kiểm tra VB-CABLE / BlackHole."
        );

        return;
      }

      // no mic
      if (error === "audio-capture") {
        setStatus(
          "Không capture được microphone.\nHãy chọn VB-CABLE / BlackHole."
        );

        return;
      }

      // blocked mic
      if (error === "not-allowed") {
        setStatus(
          "Chrome chưa được cấp quyền microphone."
        );

        alert(
          "Hãy Allow microphone cho localhost."
        );

        return;
      }

      // aborted
      if (error === "aborted") {
        setStatus(
          "Speech recognition restarting..."
        );

        setTimeout(() => {
          try {
            recognition.start();
          } catch {}
        }, 1000);

        return;
      }

      setStatus(
        "Speech recognition warning: " +
          error
      );
    };

    // ============================================
    // END
    // ============================================
    recognition.onend = () => {
      console.log(
        "Speech recognition ended"
      );

      // auto reconnect
      if (
        recognitionRef.current &&
        listening
      ) {
        setStatus(
          "Reconnecting speech recognition..."
        );

        setTimeout(() => {
          try {
            recognition.start();

            setStatus("Listening...");
          } catch (err) {
            console.warn(
              "Restart speech recognition failed"
            );

            setStatus("Restart failed");
          }
        }, 1000);
      } else {
        setStatus("Stopped");
      }
    };

    recognitionRef.current = recognition;

    // ============================================
    // START SAFE
    // ============================================
    try {
      recognition.start();
    } catch (err) {
      console.warn(
        "Recognition already started"
      );
    }
  };

  // ============================================
  // STOP
  // ============================================
  const stopTranslate = () => {
    setListening(false);

    recognitionRef.current?.stop();

    recognitionRef.current = null;

    setStatus("Stopped");
  };

  // ============================================
  // CLEAR
  // ============================================
  const clearText = () => {
    setFinalTranscript("");

    setInterimTranscript("");

    setVietnameseText("");

    setInterimVietnameseText("");
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
      <h1
        style={{
          fontSize: 48,
          fontWeight: "bold",
          marginBottom: 16,
        }}
      >
        Live Event Translator - Free
      </h1>

      <p
        style={{
          marginBottom: 24,
          color: "#cbd5e1",
        }}
      >
        Headphone supported via
        BlackHole / VB-CABLE
      </p>

      {/* ============================================ */}
      {/* CONTROL */}
      {/* ============================================ */}
      <div
        style={{
          marginBottom: 24,
        }}
      >
        <label>
          Input Language:
        </label>

        <br />

        <select
          value={sourceLang}
          disabled={listening}
          onChange={(e) =>
            setSourceLang(e.target.value)
          }
          style={{
            padding: 10,
            marginTop: 8,
            borderRadius: 8,
          }}
        >
          {sourceLanguages.map((lang) => (
            <option
              key={lang.code}
              value={lang.code}
            >
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* ============================================ */}
      {/* BUTTONS */}
      {/* ============================================ */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {!listening ? (
          <button
            onClick={startTranslate}
            style={buttonStyle(
              "#16a34a"
            )}
          >
            Start Free Translate
          </button>
        ) : (
          <button
            onClick={stopTranslate}
            style={buttonStyle(
              "#dc2626"
            )}
          >
            Stop
          </button>
        )}

        <button
          onClick={clearText}
          style={buttonStyle("#475569")}
        >
          Clear
        </button>
      </div>

      {/* ============================================ */}
      {/* STATUS */}
      {/* ============================================ */}
      <p
        style={{
          marginBottom: 24,
          color: "#facc15",
          whiteSpace: "pre-wrap",
        }}
      >
        Status: {status}
      </p>

      {/* ============================================ */}
      {/* GUIDE */}
      {/* ============================================ */}
      <div
        style={{
          background: "#1e293b",
          padding: 16,
          borderRadius: 12,
          marginBottom: 24,
          color: "#cbd5e1",
        }}
      >
        <b>
          Headphone Mode Setup:
        </b>

        <ol>
          <li>
            Windows:
            VB-CABLE
          </li>

          <li>
            Mac:
            BlackHole
          </li>

          <li>
            Chrome microphone =
            VB-CABLE / BlackHole
          </li>

          <li>
            Use Chrome browser
          </li>
        </ol>
      </div>

      {/* ============================================ */}
      {/* RESULT */}
      {/* ============================================ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: 20,
        }}
      >
        {/* ORIGINAL */}
        <div>
          <h2
            style={{
              marginBottom: 12,
            }}
          >
            Original
          </h2>

          <div
            style={boxStyle(
              "#000000",
              "#ffffff"
            )}
          >
            <span>
              {finalTranscript}
            </span>

            <span
              style={{
                color: "#999",
              }}
            >
              {interimTranscript}
            </span>

            {!finalTranscript &&
            !interimTranscript
              ? "Original speech will appear here..."
              : ""}
          </div>
        </div>

        {/* VIETNAMESE */}
        <div>
          <h2
            style={{
              marginBottom: 12,
            }}
          >
            Vietnamese Translation{" "}
            {translating
              ? "..."
              : ""}
          </h2>

          <div
            style={boxStyle(
              "#052e16",
              "#bbf7d0"
            )}
          >
            <span>
              {vietnameseText}
            </span>

            <span
              style={{
                color: "#7ddfa8",
              }}
            >
              {
                interimVietnameseText
              }
            </span>

            {!vietnameseText &&
            !interimVietnameseText
              ? "Vietnamese translation will appear here..."
              : ""}
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================
// BUTTON STYLE
// ============================================
function buttonStyle(
  background: string
): React.CSSProperties {
  return {
    padding: "12px 20px",
    background,
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
  };
}

// ============================================
// BOX STYLE
// ============================================
function boxStyle(
  background: string,
  color: string
): React.CSSProperties {
  return {
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 16,
    minHeight: 400,
    background,
    color,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    lineHeight: 1.6,
  };
}