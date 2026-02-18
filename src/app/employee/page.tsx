"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";
import {
  Send,
  Video,
  ArrowLeft,
  RotateCcw,
  Volume2,
  X,
  Clock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ChatMessage {
  from: "boss" | "employee";
  text: string;
  timestamp: number;
}

interface QueueInfo {
  position: number;
  totalInQueue: number;
  estimatedWaitMinutes: number;
}

interface QueueStats {
  totalInQueue: number;
  estimatedWaitForNew: number;
}

type BossStatus = "available" | "busy" | "away" | "in-meeting";
type KnockState = "idle" | "knocking" | "waiting" | "accepted" | "declined";

export default function EmployeePage() {
  const [name, setName] = useState("");
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [bossStatus, setBossStatus] = useState<BossStatus>("available");
  const [knockState, setKnockState] = useState<KnockState>("idle");
  const [meetLink, setMeetLink] = useState("");
  const [declineMessage, setDeclineMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [knockId, setKnockId] = useState("");
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [meetingWith, setMeetingWith] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("boss-status", (status: BossStatus) => setBossStatus(status));
    socket.on("knock-sent", () => setKnockState("waiting"));

    socket.on("door-opened", (data: { meetLink: string }) => {
      setKnockState("accepted");
      setMeetLink(data.meetLink);
      setQueueInfo(null);
    });

    socket.on("knock-declined", (data: { message: string }) => {
      setKnockState("declined");
      setDeclineMessage(data.message);
      setQueueInfo(null);
    });

    socket.on("queue-update", (data: QueueInfo) => {
      setQueueInfo(data);
    });

    socket.on("queue-stats", (data: QueueStats) => {
      setQueueStats(data);
    });

    socket.on("current-meeting-info", (data: { employeeName: string } | null) => {
      setMeetingWith(data?.employeeName || null);
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
      socket.off("queue-update");
      socket.off("queue-stats");
      socket.off("current-meeting-info");
      socket.off("chat-message");
    };
  }, []);

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
      message: message || "Gorusmek istiyorum",
      timestamp: Date.now(),
      estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
    });
  }, [knockId, name, message, bossStatus, estimatedDuration]);

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
    setEstimatedDuration("");
    setChatMessages([]);
    setChatInput("");
    setQueueInfo(null);
    const id = uuidv4().split("-")[0];
    setKnockId(id);
    getSocket().emit("employee-join", id);
  }, []);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusConfig: Record<BossStatus, { label: string; variant: "success" | "destructive" | "warning"; dotColor: string }> = {
    available: { label: "Musait", variant: "success", dotColor: "bg-emerald-500" },
    busy: { label: "Mesgul", variant: "destructive", dotColor: "bg-red-500" },
    "in-meeting": { label: "Gorusmede", variant: "destructive", dotColor: "bg-red-500" },
    away: { label: "Uzakta", variant: "warning", dotColor: "bg-amber-500" },
  };

  if (!nameSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="border-b border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span className="font-semibold text-sm text-foreground">Knock</span>
            </div>
          </div>
        </nav>

        <div className="flex-1 flex items-center justify-center px-4 sm:px-6">
          <Card className="max-w-sm w-full">
            <CardContent className="p-5 sm:p-6">
              <div className="text-center mb-5 sm:mb-6">
                <div className="w-11 h-11 rounded-xl bg-secondary text-foreground flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h1 className="text-lg font-semibold text-foreground">Hosgeldiniz</h1>
                <p className="text-sm text-muted-foreground mt-1">Devam etmek icin adinizi girin</p>
              </div>
              <div className="space-y-3">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitName()}
                  placeholder="Adiniz Soyadiniz"
                  autoFocus
                />
                <Button
                  onClick={submitName}
                  disabled={!name.trim()}
                  className="w-full"
                >
                  Devam Et
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="h-5 w-px bg-border flex-shrink-0" />
            <span className="font-medium text-sm text-foreground truncate">{name}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Badge variant={statusConfig[bossStatus].variant} className="text-[11px] px-2 py-0.5">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full mr-1.5",
                statusConfig[bossStatus].dotColor,
                bossStatus === "available" && "animate-pulse"
              )} />
              <span className="hidden sm:inline">Yonetici: </span>
              {statusConfig[bossStatus].label}
            </Badge>
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", connected ? "bg-emerald-500" : "bg-red-500")} />
            </div>
          </div>
        </div>
      </nav>

      {/* In-meeting banner */}
      {bossStatus === "in-meeting" && meetingWith && knockState !== "accepted" && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-2 text-sm text-red-700">
            <Video className="w-3.5 h-3.5" />
            <span>Yonetici su an <strong>{meetingWith}</strong> ile gorusmede</span>
          </div>
        </div>
      )}

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-md w-full">
          {/* Idle - Knock door */}
          {knockState === "idle" && (
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="text-center mb-5 sm:mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-secondary text-foreground flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Kapiyi Calin</h2>
                  <p className="text-sm text-muted-foreground">
                    Yoneticinizle gorusme talebinde bulunun
                  </p>
                </div>

                {/* Queue status info */}
                {queueStats && queueStats.totalInQueue > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 sm:mb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-900">
                        Sirada {queueStats.totalInQueue} kisi bekliyor
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-700">
                      <Clock className="w-3 h-3" />
                      Simdi siraya girerseniz tahmini bekleme: ~{queueStats.estimatedWaitForNew || 1} dk
                    </div>
                  </div>
                )}

                {queueStats && queueStats.totalInQueue === 0 && bossStatus !== "away" && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-5 sm:mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-medium text-emerald-800">
                        Sira bos, hemen gorusebilirsiniz
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Mesajiniz (opsiyonel)..."
                    rows={2}
                    className="text-sm"
                  />

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Tahmini gorusme suresi (opsiyonel)
                    </label>
                    <select
                      value={estimatedDuration}
                      onChange={(e) => setEstimatedDuration(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Belirtilmemis</option>
                      <option value="5">5 dakika</option>
                      <option value="10">10 dakika</option>
                      <option value="15">15 dakika</option>
                      <option value="30">30 dakika</option>
                      <option value="45">45 dakika</option>
                      <option value="60">1 saat</option>
                    </select>
                  </div>

                  <Button
                    onClick={knockDoor}
                    disabled={bossStatus === "away"}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {bossStatus === "away" ? (
                      "Yonetici Uzakta"
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4" />
                        Kapiyi Cal
                      </>
                    )}
                  </Button>
                  {bossStatus === "busy" && (
                    <p className="text-center text-xs text-amber-600">
                      Yonetici mesgul, ancak kapiyi calabilirsiniz.
                    </p>
                  )}
                  {bossStatus === "in-meeting" && (
                    <p className="text-center text-xs text-amber-600">
                      Yonetici gorusmede, ancak siraya girebilirsiniz.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Knocking */}
          {knockState === "knocking" && (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  <div className="w-2 h-2 rounded-full bg-foreground animate-pulse-dot" />
                  <div className="w-2 h-2 rounded-full bg-foreground animate-pulse-dot [animation-delay:200ms]" />
                  <div className="w-2 h-2 rounded-full bg-foreground animate-pulse-dot [animation-delay:400ms]" />
                </div>
                <p className="text-sm font-medium text-foreground">Kapi caliniyor...</p>
              </CardContent>
            </Card>
          )}

          {/* Waiting - With queue info and chat */}
          {knockState === "waiting" && (
            <Card>
              <CardContent className="p-0">
                <div className="p-5 sm:p-6 text-center border-b border-border">
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse-dot" />
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse-dot [animation-delay:200ms]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse-dot [animation-delay:400ms]" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Kapi calindi</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Yoneticinin yanit vermesi bekleniyor...
                  </p>
                </div>

                {/* Chat */}
                <div>
                  {chatMessages.length > 0 && (
                    <div className="max-h-52 overflow-y-auto p-3 sm:p-4 space-y-2 chat-scroll">
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={cn("flex", msg.from === "employee" ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] px-3 py-2 rounded-lg text-sm",
                              msg.from === "employee"
                                ? "bg-foreground text-background rounded-br-sm"
                                : "bg-secondary text-secondary-foreground rounded-bl-sm"
                            )}
                          >
                            <p className={cn(
                              "text-[10px] font-medium mb-0.5",
                              msg.from === "employee" ? "text-background/70" : "text-muted-foreground"
                            )}>
                              {msg.from === "boss" ? "Yonetici" : "Siz"}
                            </p>
                            <p>{msg.text}</p>
                            <p className={cn(
                              "text-[10px] mt-1",
                              msg.from === "employee" ? "text-background/50" : "text-muted-foreground/70"
                            )}>
                              {formatTime(msg.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  <div className="p-3 border-t border-border flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      placeholder="Mesaj yazin..."
                      className="h-9 text-sm"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={sendChat}
                      disabled={!chatInput.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accepted */}
          {knockState === "accepted" && (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <Video className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Kapi Acildi!</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Yonetici sizi gorusmeye davet ediyor.
                </p>
                <a href={meetLink} target="_blank" rel="noopener noreferrer" className="block">
                  <Button size="lg" className="gap-2 w-full bg-emerald-600 hover:bg-emerald-700">
                    <Video className="w-4 h-4" />
                    Toplantiya Katil
                  </Button>
                </a>
                <button
                  onClick={resetState}
                  className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Geri Don
                </button>
              </CardContent>
            </Card>
          )}

          {/* Declined */}
          {knockState === "declined" && (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
                  <X className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Talep Reddedildi</h3>
                <p className="text-sm text-muted-foreground mb-6">{declineMessage}</p>
                <Button onClick={resetState} variant="outline" className="gap-2">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Tekrar Dene
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
