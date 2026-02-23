"use client";

import Link from "next/link";
import { ArrowRight, Shield, Users, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center">
              <svg className="w-4 h-4 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="font-semibold text-foreground">Knock</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6">
        <div className="max-w-xl w-full text-center py-12 sm:py-20">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Sanal ofis kapiniz hazir
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4 leading-tight">
            Ekibinizle aninda
            <br />
            <span className="text-muted-foreground">iletisim kurun.</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto mb-8 sm:mb-10">
            Tek tikla kapiyi calin, aninda Google Meet gorusmesi baslatin.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/boss" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                <Shield className="w-4 h-4" />
                Yonetici Paneli
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>

            <Link href="/employee" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                <Users className="w-4 h-4" />
                Calisan Girisi
              </Button>
            </Link>

            <Link href="/game" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 border-purple-300 text-purple-700 hover:bg-purple-50">
                <Gamepad2 className="w-4 h-4" />
                Oyun Modu
              </Button>
            </Link>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-12 sm:mt-16">
            {[
              {
                title: "Anlik Bildirim",
                desc: "Kapi calildiginda aninda haberdar olun",
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                ),
              },
              {
                title: "Google Meet",
                desc: "Otomatik toplanti linki olusturma",
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                title: "Canli Sohbet",
                desc: "Bekleme sirasinda mesajlasma",
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                ),
              },
            ].map((f, i) => (
              <div
                key={i}
                className="rounded-xl border border-border p-4 sm:p-5 text-left hover:border-foreground/15 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-secondary text-foreground flex items-center justify-center mb-3">
                  {f.icon}
                </div>
                <h3 className="font-medium text-foreground text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Knock The Door
      </footer>
    </div>
  );
}
