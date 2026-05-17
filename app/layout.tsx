import "./styles.css";

export const metadata = {
  title: "Live Event Translator",
  description: "Realtime audio transcription and translation demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
