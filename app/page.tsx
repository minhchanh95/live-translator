"use client";

import { useRef, useState } from "react";

export default function Home() {
  const recognitionRef = useRef<any>(null);

  const [listening, setListening] = useState(false);
  const [sourceLang, setSourceLang] = useState("ja-JP");

  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const [vietnameseText, setVietnameseText] = useState("");
  const [interimVietnameseText, setInterimVietnameseText] = useState("");

  const [translating, setTranslating] = useState(false);

  const getSourceLangCode = () => {
    if (sourceLang === "ja-JP") return "ja";
    if (sourceLang === "en-US") return "en";
    if (sourceLang === "ko-KR") return "ko";
    if (sourceLang === "zh-CN") return "zh-CN";
    if (sourceLang === "vi-VN") return "vi";

    return "auto";
  };

  const translateToVietnamese = async (text: string) => {
    if (!text.trim()) return;

    try {
      setTranslating(true);

      const sl = getSourceLangCode();

      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx" +
        `&sl=${encodeURIComponent(sl)}` +
        `&tl=vi` +
        `&dt=t` +
        `&q=${encodeURIComponent(text)}`;

      const res = await fetch(url);
      const data = await res.json();

      const translated = data[0]
        .map((item: any) => item[0])
        .join("");

      setVietnameseText((prev) => prev + translated + " ");
    } catch (error) {
      console.error("Translate error:", error);

      setVietnameseText((prev) => prev + "\n[Dịch lỗi]\n");
    } finally {
      setTranslating(false);
    }
  };

  const translateInterimToVietnamese = async (text: string) => {
    if (!text.trim()) return;

    try {
      const sl = getSourceLangCode();

      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx" +
        `&sl=${encodeURIComponent(sl)}` +
        `&tl=vi` +
        `&dt=t` +
        `&q=${encodeURIComponent(text)}`;

      const res = await fetch(url);
      const data = await res.json();

      const translated = data[0]
        .map((item: any) => item[0])
        .join("");

      setInterimVietnameseText(translated);
    } catch (error) {
      console.error("Interim translate error:", error);
    }
  };

  const startFreeDemo = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Browser không hỗ trợ Web Speech API. Hãy dùng Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = sourceLang;
    recognition.continuous = true;
    recognition.interimResults = true;

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

      if (finalText) {
        setFinalTranscript((prev) => prev + finalText);

        await translateToVietnamese(finalText);

        setInterimVietnameseText("");
      }

      setInterimTranscript(interim);

      if (interim.trim()) {
        translateInterimToVietnamese(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event);

      alert("Speech recognition error: " + event.error);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    recognition.start();

    setListening(true);
  };

  const stopFreeDemo = () => {
    recognitionRef.current?.stop();

    setListening(false);
  };

  const clearText = () => {
    setFinalTranscript("");
    setInterimTranscript("");

    setVietnameseText("");
    setInterimVietnameseText("");
  };

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1>Live Event Translator - Free Demo Mode</h1>

      <p>
        Chế độ này dùng Web Speech API + Google Translate unofficial endpoint,
        không tốn tiền OpenAI API.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label>Ngôn ngữ đầu vào: </label>

        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          disabled={listening}
        >
          <option value="ja-JP">Japanese</option>
          <option value="en-US">English</option>
          <option value="vi-VN">Vietnamese</option>
          <option value="ko-KR">Korean</option>
          <option value="zh-CN">Chinese</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {!listening ? (
          <button onClick={startFreeDemo}>Start Free Demo</button>
        ) : (
          <button onClick={stopFreeDemo}>Stop</button>
        )}

        <button onClick={clearText}>Clear</button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div>
          <h2>Original</h2>

          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 16,
              minHeight: 240,
              whiteSpace: "pre-wrap",
              background: "#000",
              color: "#fff",
            }}
          >
            <span>{finalTranscript}</span>

            <span style={{ color: "#888" }}>
              {interimTranscript}
            </span>
          </div>
        </div>

        <div>
          <h2>
            Vietnamese Translation {translating ? "..." : ""}
          </h2>

          <div
            style={{
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: 16,
              minHeight: 240,
              whiteSpace: "pre-wrap",
              background: "#001b12",
              color: "#b6ffd8",
            }}
          >
            <span>{vietnameseText}</span>

            <span style={{ color: "#7ddfa8" }}>
              {interimVietnameseText}
            </span>

            {!vietnameseText && !interimVietnameseText
              ? "Bản dịch tiếng Việt sẽ hiển thị ở đây..."
              : ""}
          </div>
        </div>
      </div>
    </main>
  );
}
