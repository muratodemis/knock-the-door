import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knock The Door - Virtual Office",
  description: "Sanal ofis kapısı - Çalışanlarınızla anlık görüşme",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background">{children}</body>
    </html>
  );
}
