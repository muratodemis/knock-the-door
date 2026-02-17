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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
