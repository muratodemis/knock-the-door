"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";

interface KnockRequest {
  id: string;
  employeeName: string;
  message: string;
  timestamp: number;
}

interface ChatMessage {
  from: "boss" | "employee";
  text: string;
  timestamp: number;
}

type BossStatus = "available" | "busy" | "away";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function BossPage() {
  const [status, setStatus] = useState<BossStatus>("available");
  const [knocks, setKnocks] = useState<KnockRequest[]>([]);
  const [connected, setConnected] = useState(false);
  const [knockAnimation, setKnockAnimation] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Google auth state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleChecking, setGoogleChecking] = useState(true);

  // Track which knock is being processed
  const [processingKnockId, setProcessingKnockId] = useState<string | null>(null);
  const [meetError, setMeetError] = useState<string | null>(null);

  // Chat state: messages per knockId
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const chatEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Check Google auth status on mount
  useEffect(() => {
    fetch(`${basePath}/api/auth/status`)
      .then((res) => res.json())
      .then((data) => {
        setGoogleConnected(data.authenticated);
        setGoogleChecking(false);
      })
      .catch(() => setGoogleChecking(false));
  }, []);

  // Re-check after redirect from Google OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      setGoogleConnected(true);
      setGoogleChecking(false);
      window.history.replaceState({}, "", `${basePath}/boss`);
    }
    const errParam = params.get("error");
    if (errParam) {
      setMeetError(`Google bağlantı hatası: ${decodeURIComponent(errParam)}`);
      window.history.replaceState({}, "", `${basePath}/boss`);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("boss-join");
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("knock-received", (knock: KnockRequest) => {
      setKnocks((prev) => {
        if (prev.find((k) => k.id === knock.id)) return prev;
        return [...prev, knock];
      });
      setKnockAnimation(true);
      setTimeout(() => setKnockAnimation(false), 600);

      // Play knock sound
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRlQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTAFAACAgICAgICAgICAgICAgICAgICA/4CAgH+AgIB/gICAf4CAgH+AgIB/f3+Af39/f35+fn59fX19fHx8fHt7e3t6enp6eXl5eXh4eHh3d3d3dnZ2dnV1dXV0dHR0c3NzcnJycnFxcXBwcHBvb29ubm5tbW1sbGxra2tqamppaWloaGhnZ2dmZmZlZWVkZGRjY2NiYmJhYWFgYGBfX19fXl5eXl5eXl5fX19fYGBgYWFhYmJiY2NjZGRkZWVlZmZmZ2dnaGhoaWlpampqa2trbGxsbW1tbm5ub29vcHBwcXFxcnJyc3Nzc3R0dHV1dXZ2dnd3d3h4eHl5eXp6ent7e3x8fH19fX5+fn9/f4CAgIGBgYKCgoODg4SEhIWFhYaGhoeHh4iIiImJiYqKiouLi4yMjI2NjY6Ojo+Pj5CQkJGRkZKSkpOTk5SUlJWVlZaWlpeXl5iYmJmZmZqampubm5ycnJ2dnZ6enp+fn6CgoKGhoaKioqOjo6SkpKWlpaampqenp6ioqKmpqaqqqqurq6ysrK2tra6urq+vr7CwsLGxsbKysrOzs7S0tLW1tba2tre3t7i4uLm5ubq6uru7u7y8vL29vb6+vr+/v8DAwMHBwcLCwsPDw8TExMXFxcbGxsfHx8jIyMnJycrKysvLy8zMzM3Nzc7Ozs/Pz9DQ0NHR0dLS0tPT09TU1NXV1dbW1tfX19jY2NnZ2dra2tvb29zc3N3d3d7e3t/f3+Dg4OHh4eLi4uPj4+Tk5OXl5ebm5ufn5+jo6Onp6erq6uvr6+zs7O3t7e7u7u/v7/Dw8PHx8fLy8vPz8/T09PX19fb29vf39/j4+Pn5+fr6+vv7+/z8/P39/f7+/v///wAAAA==");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
    });

    socket.on("door-opened-confirm", (data: { knockId: string; meetLink: string; employeeName: string }) => {
      setKnocks((prev) => prev.filter((k) => k.id !== data.knockId));
      setProcessingKnockId(null);
      setChatMessages((prev) => {
        const copy = { ...prev };
        delete copy[data.knockId];
        return copy;
      });
      window.open(data.meetLink, "_blank");
    });

    socket.on("chat-message", (data: { knockId: string; from: "boss" | "employee"; text: string; timestamp: number }) => {
      setChatMessages((prev) => ({
        ...prev,
        [data.knockId]: [...(prev[data.knockId] || []), { from: data.from, text: data.text, timestamp: data.timestamp }],
      }));
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("knock-received");
      socket.off("door-opened-confirm");
      socket.off("chat-message");
    };
  }, []);

  const changeStatus = useCallback((newStatus: BossStatus) => {
    setStatus(newStatus);
    getSocket().emit("boss-status-change", newStatus);
  }, []);

  const openDoor = useCallback(async (knockId: string) => {
    setProcessingKnockId(knockId);
    setMeetError(null);

    try {
      const res = await fetch(`${basePath}/api/create-meet`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Toplantı oluşturulamadı");
      }

      // Send the real meet link via socket
      getSocket().emit("open-door", { knockId, meetLink: data.meetLink });
    } catch (err: any) {
      setMeetError(err.message);
      setProcessingKnockId(null);
    }
  }, []);

  const declineKnock = useCallback((knockId: string) => {
    getSocket().emit("decline-knock", knockId);
    setKnocks((prev) => prev.filter((k) => k.id !== knockId));
    setChatMessages((prev) => {
      const copy = { ...prev };
      delete copy[knockId];
      return copy;
    });
  }, []);

  const sendChat = useCallback((knockId: string) => {
    const text = chatInputs[knockId]?.trim();
    if (!text) return;
    getSocket().emit("boss-chat", { knockId, text });
    setChatInputs((prev) => ({ ...prev, [knockId]: "" }));
  }, [chatInputs]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    Object.keys(chatMessages).forEach((knockId) => {
      chatEndRefs.current[knockId]?.scrollIntoView({ behavior: "smooth" });
    });
  }, [chatMessages]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusConfig = {
    available: { label: "Müsait", color: "bg-green-500", glow: "status-glow-available", icon: "🟢" },
    busy: { label: "Meşgul", color: "bg-red-500", glow: "status-glow-busy", icon: "🔴" },
    away: { label: "Uzakta", color: "bg-yellow-500", glow: "status-glow-away", icon: "🟡" },
  };

  return (
    <div className="min-h-screen p-6 md:p-10">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Yönetici Paneli</h1>
            <p className="text-slate-400 mt-1">Sanal ofisinizi yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Google connection status */}
            {!googleChecking && (
              googleConnected ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-xs text-green-400 font-medium">Google Bağlı</span>
                </div>
              ) : (
                <a
                  href={`${basePath}/api/auth/google`}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg font-medium text-sm transition-all hover:shadow-lg hover:scale-105 border border-gray-200"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google ile Bağlan
                </a>
              )
            )}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm text-slate-400">
                {connected ? "Bağlı" : "Bağlantı kesildi"}
              </span>
            </div>
          </div>
        </div>

        {/* Google not connected warning */}
        {!googleChecking && !googleConnected && (
          <div className="glass-card rounded-2xl p-5 mb-8 border border-yellow-500/20 bg-yellow-500/5">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-300">Google Hesabı Bağlı Değil</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Kapıyı açtığınızda otomatik Google Meet toplantısı oluşturabilmek için Google hesabınızı bağlamanız gerekiyor.
                  Sağ üstteki &quot;Google ile Bağlan&quot; butonuna tıklayın.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Meet error */}
        {meetError && (
          <div className="glass-card rounded-2xl p-4 mb-8 border border-red-500/20 bg-red-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">{meetError}</span>
              </div>
              <button onClick={() => setMeetError(null)} className="text-slate-400 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Status Control */}
        <div className={`glass-card rounded-2xl p-6 mb-8 ${statusConfig[status].glow} transition-shadow duration-500`}>
          <h2 className="text-lg font-semibold mb-4 text-slate-300">Kapı Durumu</h2>
          <div className="flex flex-wrap gap-3">
            {(["available", "busy", "away"] as BossStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  status === s
                    ? `${statusConfig[s].color} text-white shadow-lg scale-105`
                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50"
                }`}
              >
                <span className="mr-2">{statusConfig[s].icon}</span>
                {statusConfig[s].label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-400">
            {status === "available" && "Çalışanlar kapınızı çalabilir. Görüşme taleplerine açıksınız."}
            {status === "busy" && "Çalışanlar meşgul olduğunuzu görecek, ancak acil durumlar için kapıyı çalabilirler."}
            {status === "away" && "Çalışanlar uzakta olduğunuzu görecek. Kapı çalma devre dışı."}
          </p>
        </div>

        {/* Door visualization */}
        <div className={`glass-card rounded-2xl p-8 mb-8 ${knockAnimation ? "knock-shake" : ""}`}>
          <div className="flex items-center justify-center">
            <div className="relative">
              {/* Door frame */}
              <div className="w-48 h-64 bg-gradient-to-b from-amber-800 to-amber-950 rounded-t-xl relative shadow-2xl border-4 border-amber-700/50">
                {/* Door panels */}
                <div className="absolute top-4 left-4 right-4 h-24 border-2 border-amber-600/20 rounded-sm" />
                <div className="absolute bottom-4 left-4 right-4 h-24 border-2 border-amber-600/20 rounded-sm" />
                {/* Door knob */}
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 bg-yellow-400 rounded-full shadow-lg" />
                  <div className="w-3 h-6 bg-yellow-500/80 rounded-b-sm mx-auto -mt-1" />
                </div>
                {/* Status sign */}
                <div className={`absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-md text-xs font-bold ${
                  status === "available" ? "bg-green-500 text-white" :
                  status === "busy" ? "bg-red-500 text-white" :
                  "bg-yellow-500 text-black"
                }`}>
                  {statusConfig[status].label}
                </div>
              </div>
              {/* Floor */}
              <div className="w-56 h-2 bg-slate-700 rounded-b-lg -ml-4" />

              {/* Knock notification badge */}
              {knocks.length > 0 && (
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm animate-bounce">
                  {knocks.length}
                </div>
              )}
            </div>
          </div>

          {knocks.length === 0 && (
            <p className="text-center mt-6 text-slate-400">
              Henüz kimse kapıyı çalmadı. Beklemede...
            </p>
          )}
        </div>

        {/* Knock Requests */}
        {knocks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-200">
              Kapıyı Çalanlar ({knocks.length})
            </h2>
            {knocks.map((knock) => (
              <div
                key={knock.id}
                className="glass-card rounded-xl p-5 animate-[slideIn_0.3s_ease-out]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {knock.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{knock.employeeName}</h3>
                        <p className="text-sm text-slate-400">{formatTime(knock.timestamp)}</p>
                      </div>
                    </div>
                    {knock.message && (
                      <p className="mt-3 text-slate-300 bg-slate-700/50 rounded-lg p-3 text-sm">
                        &quot;{knock.message}&quot;
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    {processingKnockId === knock.id ? (
                      <div className="flex items-center gap-2 px-5 py-2.5 text-blue-300">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-sm font-medium">Toplantı oluşturuluyor...</span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => openDoor(knock.id)}
                          disabled={!googleConnected || processingKnockId !== null}
                          className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-40 disabled:hover:scale-100 flex items-center gap-2"
                          title={!googleConnected ? "Önce Google hesabınızı bağlayın" : ""}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Kapıyı Aç
                        </button>
                        <button
                          onClick={() => declineKnock(knock.id)}
                          className="px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg font-medium transition-all hover:bg-red-500/20 hover:text-red-400"
                        >
                          Reddet
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Chat area */}
                <div className="mt-4 border-t border-slate-700/50 pt-4">
                  {/* Chat messages */}
                  {(chatMessages[knock.id]?.length ?? 0) > 0 && (
                    <div className="max-h-48 overflow-y-auto mb-3 space-y-2 pr-1 chat-scroll">
                      {chatMessages[knock.id].map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.from === "boss" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                              msg.from === "boss"
                                ? "bg-blue-600/30 text-blue-100 rounded-br-sm"
                                : "bg-slate-600/50 text-slate-200 rounded-bl-sm"
                            }`}
                          >
                            <p>{msg.text}</p>
                            <p className={`text-[10px] mt-1 ${msg.from === "boss" ? "text-blue-300/60" : "text-slate-400/60"}`}>
                              {new Date(msg.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={(el) => { chatEndRefs.current[knock.id] = el; }} />
                    </div>
                  )}

                  {/* Chat input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInputs[knock.id] || ""}
                      onChange={(e) => setChatInputs((prev) => ({ ...prev, [knock.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && sendChat(knock.id)}
                      placeholder="Mesaj yazın... (örn: 5dk bekle)"
                      className="flex-1 px-3 py-2 bg-slate-700/40 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => sendChat(knock.id)}
                      disabled={!chatInputs[knock.id]?.trim()}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium transition-all hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
