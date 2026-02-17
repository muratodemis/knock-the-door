"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-2xl">
        {/* Logo / Door Icon */}
        <div className="mb-8 inline-block">
          <div className="w-32 h-40 bg-gradient-to-b from-amber-700 to-amber-900 rounded-t-lg relative mx-auto shadow-2xl">
            {/* Door panel */}
            <div className="absolute inset-2 border-2 border-amber-600/30 rounded-t-sm" />
            {/* Door knob */}
            <div className="absolute right-3 top-1/2 w-4 h-4 bg-yellow-400 rounded-full shadow-lg" />
            {/* Light from gap */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-300/50" />
          </div>
        </div>

        <h1 className="text-5xl font-bold mb-4 gradient-text">
          Knock The Door
        </h1>
        <p className="text-xl text-slate-400 mb-12">
          Sanal ofis kapınız. Çalışanlarınızla anında görüşün.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link
            href="/boss"
            className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-lg font-semibold transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
          >
            <span className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Yönetici Paneli
            </span>
            <span className="block text-sm text-blue-200 mt-1">Kapıyı yönet, durumunu ayarla</span>
          </Link>

          <Link
            href="/employee"
            className="group relative px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl text-lg font-semibold transition-all hover:scale-105 hover:shadow-lg hover:shadow-emerald-500/25"
          >
            <span className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Çalışan Girişi
            </span>
            <span className="block text-sm text-emerald-200 mt-1">Kapıyı çal, görüşme talep et</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
