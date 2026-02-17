"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";

interface ChatMessage {
  from: "boss" | "employee";
  text: string;
  timestamp: number;
}

type BossStatus = "available" | "busy" | "away";
type KnockState = "idle" | "knocking" | "waiting" | "accepted" | "declined";

export default function EmployeePage() {
  const [name, setName] = useState("");
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [bossStatus, setBossStatus] = useState<BossStatus>("available");
  const [knockState, setKnockState] = useState<KnockState>("idle");
  const [meetLink, setMeetLink] = useState("");
  const [declineMessage, setDeclineMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [knockId, setKnockId] = useState("");
  const [doorAnimate, setDoorAnimate] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("boss-status", (status: BossStatus) => setBossStatus(status));

    socket.on("knock-sent", () => {
      setKnockState("waiting");
    });

    socket.on("door-opened", (data: { meetLink: string }) => {
      setKnockState("accepted");
      setMeetLink(data.meetLink);
      setDoorAnimate(true);
    });

    socket.on("knock-declined", (data: { message: string }) => {
      setKnockState("declined");
      setDeclineMessage(data.message);
    });

    socket.on("chat-message", (data: { from: "boss" | "employee"; text: string; timestamp: number }) => {
      setChatMessages((prev) => [...prev, { from: data.from, text: data.text, timestamp: data.timestamp }]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("boss-status");
      socket.off("knock-sent");
      socket.off("door-opened");
      socket.off("knock-declined");
      socket.off("chat-message");
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const submitName = useCallback(() => {
    if (!name.trim()) return;
    setNameSubmitted(true);
    const id = uuidv4().split("-")[0];
    setKnockId(id);
    getSocket().emit("employee-join", id);
  }, [name]);

  const knockDoor = useCallback(() => {
    if (bossStatus === "away") return;
    setKnockState("knocking");

    const socket = getSocket();
    socket.emit("knock", {
      id: knockId,
      employeeName: name,
      message: message || "Görüşmek istiyorum",
      timestamp: Date.now(),
    });
  }, [knockId, name, message, bossStatus]);

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    getSocket().emit("employee-chat", { knockId, text });
    setChatInput("");
  }, [chatInput, knockId]);

  const resetState = useCallback(() => {
    setKnockState("idle");
    setMeetLink("");
    setDeclineMessage("");
    setMessage("");
    setDoorAnimate(false);
    setChatMessages([]);
    setChatInput("");
    const id = uuidv4().split("-")[0];
    setKnockId(id);
    getSocket().emit("employee-join", id);
  }, []);

  const statusConfig = {
    available: { label: "Müsait", color: "text-green-400", bg: "bg-green-500", glow: "status-glow-available" },
    busy: { label: "Meşgul", color: "text-red-400", bg: "bg-red-500", glow: "status-glow-busy" },
    away: { label: "Uzakta", color: "text-yellow-400", bg: "bg-yellow-500", glow: "status-glow-away" },
  };

  // Name entry screen
  if (!nameSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-24 bg-gradient-to-b from-amber-700 to-amber-900 rounded-t-lg mx-auto mb-4 relative">
              <div className="absolute right-2 top-1/2 w-3 h-3 bg-yellow-400 rounded-full" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Knock The Door</h1>
            <p className="text-slate-400 mt-2">Yöneticinizle görüşmek için adınızı girin</p>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitName()}
              placeholder="Adınız Soyadınız"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={submitName}
              disabled={!name.trim()}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              Devam Et
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg w-full">
        {/* Connection status */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-slate-400">{connected ? "Bağlı" : "Bağlantı kesildi"}</span>
        </div>

        {/* Main card */}
        <div className={`glass-card rounded-2xl overflow-hidden ${statusConfig[bossStatus].glow} transition-shadow duration-500`}>
          {/* Boss status banner */}
          <div className={`px-6 py-3 flex items-center justify-between ${
            bossStatus === "available" ? "bg-green-500/10" :
            bossStatus === "busy" ? "bg-red-500/10" : "bg-yellow-500/10"
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${statusConfig[bossStatus].bg} ${bossStatus === "available" ? "animate-pulse" : ""}`} />
              <span className={`font-medium ${statusConfig[bossStatus].color}`}>
                Yönetici: {statusConfig[bossStatus].label}
              </span>
            </div>
            <span className="text-sm text-slate-400">Merhaba, {name}</span>
          </div>

          <div className="p-8">
            {/* Door visualization */}
            <div className="flex justify-center mb-8">
              <div className="relative" style={{ perspective: "600px" }}>
                <div
                  className={`w-44 h-60 bg-gradient-to-b from-amber-700 to-amber-950 rounded-t-xl relative shadow-2xl border-4 border-amber-700/50 transition-transform duration-700 origin-left ${
                    doorAnimate ? "animate-door-open" : ""
                  } ${knockState === "knocking" ? "knock-shake" : ""}`}
                >
                  {/* Door panels */}
                  <div className="absolute top-4 left-4 right-4 h-20 border-2 border-amber-600/20 rounded-sm" />
                  <div className="absolute bottom-4 left-4 right-4 h-20 border-2 border-amber-600/20 rounded-sm" />
                  {/* Door knob */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 bg-yellow-400 rounded-full shadow-lg" />
                    <div className="w-3 h-6 bg-yellow-500/80 rounded-b-sm mx-auto -mt-1" />
                  </div>
                  {/* Status sign on door */}
                  <div className={`absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded text-xs font-bold shadow ${
                    bossStatus === "available" ? "bg-green-500 text-white" :
                    bossStatus === "busy" ? "bg-red-500 text-white" :
                    "bg-yellow-500 text-black"
                  }`}>
                    {statusConfig[bossStatus].label}
                  </div>
                </div>
                <div className="w-52 h-2 bg-slate-700 rounded-b-lg -ml-4" />

                {/* Waiting animation overlay */}
                {knockState === "waiting" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute w-16 h-16 rounded-full border-4 border-blue-500/50 animate-pulse-ring" />
                    <div className="absolute w-16 h-16 rounded-full border-4 border-blue-500/30 animate-pulse-ring [animation-delay:0.5s]" />
                  </div>
                )}
              </div>
            </div>

            {/* States */}
            {knockState === "idle" && (
              <div className="space-y-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mesajınız (opsiyonel)... Örn: Proje hakkında konuşmak istiyorum"
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                />
                <button
                  onClick={knockDoor}
                  disabled={bossStatus === "away"}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                    bossStatus === "away"
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/25 active:scale-95"
                  }`}
                >
                  {bossStatus === "away" ? (
                    "Yönetici Uzakta - Kapı Kilitli"
                  ) : (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      Kapıyı Çal
                    </span>
                  )}
                </button>
                {bossStatus === "busy" && (
                  <p className="text-center text-sm text-yellow-400/80">
                    Yönetici meşgul, ancak kapıyı çalabilirsiniz.
                  </p>
                )}
              </div>
            )}

            {knockState === "knocking" && (
              <div className="text-center">
                <div className="inline-block animate-bounce text-4xl mb-4">🤛</div>
                <p className="text-slate-300">Kapı çalınıyor...</p>
              </div>
            )}

            {knockState === "waiting" && (
              <div>
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                  <p className="text-blue-300 font-medium">Kapı çalındı!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Yöneticinin yanıt vermesi bekleniyor...
                  </p>
                </div>

                {/* Chat area */}
                <div className="mt-4 border-t border-slate-700/50 pt-4">
                  {chatMessages.length > 0 && (
                    <div className="max-h-52 overflow-y-auto mb-3 space-y-2 pr-1 chat-scroll">
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.from === "employee" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                              msg.from === "employee"
                                ? "bg-blue-600/30 text-blue-100 rounded-br-sm"
                                : "bg-emerald-600/20 text-emerald-100 rounded-bl-sm"
                            }`}
                          >
                            <p className={`text-[10px] font-medium mb-0.5 ${msg.from === "employee" ? "text-blue-300/70" : "text-emerald-300/70"}`}>
                              {msg.from === "boss" ? "Yönetici" : "Siz"}
                            </p>
                            <p>{msg.text}</p>
                            <p className={`text-[10px] mt-1 ${msg.from === "employee" ? "text-blue-300/50" : "text-emerald-300/50"}`}>
                              {new Date(msg.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      placeholder="Yöneticiye mesaj yazın..."
                      className="flex-1 px-3 py-2.5 bg-slate-700/40 border border-slate-600/40 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={sendChat}
                      disabled={!chatInput.trim()}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium transition-all hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {knockState === "accepted" && (
              <div className="text-center space-y-4">
                <div className="text-5xl mb-2">🎉</div>
                <h3 className="text-xl font-bold text-green-400">Kapı Açıldı!</h3>
                <p className="text-slate-300">
                  Yönetici sizi görüşmeye davet ediyor.
                </p>
                <a
                  href={meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-green-500/25"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Toplantıya Katıl
                </a>
                <button
                  onClick={resetState}
                  className="block mx-auto text-sm text-slate-400 hover:text-white transition-colors mt-4"
                >
                  Geri Dön
                </button>
              </div>
            )}

            {knockState === "declined" && (
              <div className="text-center space-y-4">
                <div className="text-4xl mb-2">😔</div>
                <h3 className="text-lg font-medium text-red-400">Talep Reddedildi</h3>
                <p className="text-slate-400 text-sm">{declineMessage}</p>
                <button
                  onClick={resetState}
                  className="px-6 py-3 bg-slate-700 text-white rounded-xl font-medium transition-all hover:bg-slate-600"
                >
                  Tekrar Dene
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
