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
  CalendarPlus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import CalendarWidget from "@/components/calendar-widget";
import PixelRoom from "@/components/pixel-room";
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

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

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
  const [calComUrl, setCalComUrl] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [showKnockConfirm, setShowKnockConfirm] = useState(false);

  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizQ, setQuizQ] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([null, null, null, null, null]);
  const [quizRevealed, setQuizRevealed] = useState<boolean[]>([false, false, false, false, false]);
  const [quizDone, setQuizDone] = useState(false);

  const quizData = [
    { q: "Hangi takimlidir?", opts: ["Fenerbahce", "Galatasaray", "Besiktas"], correct: 1 },
    { q: "En sevdigi renk?", opts: ["Mavi", "Siyah", "Yesil"], correct: 1 },
    { q: "Ilk aldigi domain kac tarihindedir?", opts: ["2002", "1998", "2008", "2010"], correct: 0 },
    { q: "Masasi daginik midir? Duzenli mi?", opts: ["Daginik", "Duzenli"], correct: 0 },
    { q: "Gunde kac kahve icer?", opts: ["1-4", "4-8", "8-12"], correct: 1 },
  ];

  const quizScore = quizAnswers.reduce<number>((s, a, i) => s + (a === quizData[i].correct ? 1 : 0), 0);

  const answerQuiz = useCallback((optIdx: number) => {
    if (quizRevealed[quizQ]) return;
    setQuizAnswers(prev => { const n = [...prev]; n[quizQ] = optIdx; return n; });
    setQuizRevealed(prev => { const n = [...prev]; n[quizQ] = true; return n; });
    setTimeout(() => {
      if (quizQ < 4) setQuizQ(q => q + 1);
      else setQuizDone(true);
    }, 1200);
  }, [quizQ, quizRevealed]);

  useEffect(() => {
    fetch(`${basePath}/api/calendar/calcom`)
      .then((r) => r.json())
      .then((data) => { if (data.calComUrl) setCalComUrl(data.calComUrl); })
      .catch(() => {});
  }, []);

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
    if (bossStatus === "in-meeting" && !showKnockConfirm) {
      setShowKnockConfirm(true);
      return;
    }
    setShowKnockConfirm(false);
    setKnockState("knocking");

    const socket = getSocket();
    socket.emit("knock", {
      id: knockId,
      employeeName: name,
      message: message || "Gorusmek istiyorum",
      timestamp: Date.now(),
      estimatedDuration: estimatedDuration ? parseInt(estimatedDuration) : undefined,
    });
  }, [knockId, name, message, bossStatus, estimatedDuration, showKnockConfirm]);

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

  const queueStatusInfo = (() => {
    if (!queueStats) return null;
    const q = queueStats.totalInQueue;
    const wait = queueStats.estimatedWaitForNew || 1;

    if (bossStatus === "away") {
      return {
        bg: "bg-red-50 border-red-200",
        dotColor: "bg-red-400",
        dotPulse: false,
        title: "Yonetici su an uzakta",
        titleColor: "text-red-800",
        sub: q > 0 ? `Sirada ${q} kisi bekliyor` : null,
        subColor: "text-red-600",
      };
    }

    if (bossStatus === "in-meeting") {
      if (q === 0) return {
        bg: "bg-amber-50 border-amber-200",
        dotColor: "bg-amber-500",
        dotPulse: true,
        title: "Su an iceride biri var",
        titleColor: "text-amber-800",
        sub: "Bittiginde iceri girmek icin kapiyi cal'a tiklayin",
        subColor: "text-amber-600",
      };
      return {
        bg: "bg-red-50 border-red-200",
        dotColor: "bg-red-500",
        dotPulse: true,
        title: `Su an iceride biri var, sirada ${q} kisi bekliyor`,
        titleColor: "text-red-900",
        sub: `Tahmini bekleme: ~${wait} dk`,
        subColor: "text-red-700",
      };
    }

    if (bossStatus === "busy") {
      if (q === 0) return {
        bg: "bg-amber-50 border-amber-200",
        dotColor: "bg-amber-500",
        dotPulse: false,
        title: "Yonetici mesgul, sirada kimse yok",
        titleColor: "text-amber-800",
        sub: "Kapiyi calabilirsiniz ama calmamanizi tavsiye ederiz :)",
        subColor: "text-amber-600",
      };
      return {
        bg: "bg-amber-50 border-amber-200",
        dotColor: "bg-amber-600",
        dotPulse: false,
        title: `Yonetici mesgul, sirada ${q} kisi bekliyor`,
        titleColor: "text-amber-900",
        sub: `Tahmini bekleme: ~${wait} dk`,
        subColor: "text-amber-700",
      };
    }

    if (q === 0) return {
      bg: "bg-emerald-50 border-emerald-200",
      dotColor: "bg-emerald-500",
      dotPulse: true,
      title: "Sira bos, kabul ederse hemen gorusebilirsiniz",
      titleColor: "text-emerald-800",
      sub: null,
      subColor: null,
    };
    return {
      bg: "bg-amber-50 border-amber-200",
      dotColor: "bg-amber-500",
      dotPulse: false,
      title: `Sirada ${q} kisi bekliyor`,
      titleColor: "text-amber-900",
      sub: `Simdi siraya girerseniz tahmini bekleme: ~${wait} dk`,
      subColor: "text-amber-700",
    };
  })();

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
        <div className={cn(
          "w-full",
          knockState === "idle" ? "max-w-3xl" : "max-w-md"
        )}>
          {/* Idle - Knock door + Calendar */}
          {knockState === "idle" && (
            <div className="space-y-4">
              {/* Pixel Room - Boss Office */}
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-[#1a1b26] rounded-t-lg">
                    <PixelRoom status={bossStatus} className="mx-auto max-w-md" />
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between border-t">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        statusConfig[bossStatus].dotColor,
                        bossStatus === "available" && "animate-pulse"
                      )} />
                      <span className="text-sm font-medium text-foreground">
                        Yonetici: {statusConfig[bossStatus].label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">Canli</span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <div className="text-center mb-5 sm:mb-6">
                    <h2 className="text-lg font-semibold text-foreground mb-1">Kapiyi Calin</h2>
                    <p className="text-sm text-muted-foreground">
                      Yoneticinizle gorusme talebinde bulunun
                    </p>
                  </div>

                  {/* Queue + boss status indicator */}
                  {queueStatusInfo && (
                    <div className={cn("rounded-lg px-4 py-3 mb-5 sm:mb-6 border transition-all duration-300", queueStatusInfo.bg)}>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          queueStatusInfo.dotColor,
                          queueStatusInfo.dotPulse && "animate-pulse"
                        )} />
                        <span className={cn("text-sm font-medium", queueStatusInfo.titleColor)}>
                          {queueStatusInfo.title}
                        </span>
                      </div>
                      {queueStatusInfo.sub && (
                        <div className={cn("flex items-center gap-1.5 text-xs mt-1 ml-4", queueStatusInfo.subColor)}>
                          <Clock className="w-3 h-3" />
                          {queueStatusInfo.sub}
                        </div>
                      )}
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

                    {/* In-meeting confirmation */}
                    {showKnockConfirm && bossStatus === "in-meeting" && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <p className="text-sm text-amber-800 font-medium">
                          Gorusmede bir kisi var, calmak istediginize emin misiniz?
                        </p>
                        <div className="flex gap-2">
                          <Button onClick={knockDoor} size="sm" className="flex-1 gap-1.5 bg-amber-600 hover:bg-amber-700">
                            <Volume2 className="w-3.5 h-3.5" />
                            Evet, Cal
                          </Button>
                          <Button onClick={() => setShowKnockConfirm(false)} size="sm" variant="outline" className="flex-1">
                            Vazgec
                          </Button>
                        </div>
                      </div>
                    )}

                    {!showKnockConfirm && (
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
                    )}

                    {/* Randevu Al - when busy or away */}
                    {calComUrl && (bossStatus === "busy" || bossStatus === "away") && (
                      <a
                        href={calComUrl.startsWith("http") ? calComUrl : `https://${calComUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="outline" className="w-full gap-2" size="lg">
                          <CalendarPlus className="w-4 h-4" />
                          Randevu Al
                          <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-50" />
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <CalendarWidget />

                {calComUrl && (
                  <Card>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <CalendarPlus className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Randevu Al</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Yoneticiyle ilerisi icin bir gorusme planlayabilirsiniz.
                      </p>
                      <a
                        href={calComUrl.startsWith("http") ? calComUrl : `https://${calComUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                          <CalendarPlus className="w-3.5 h-3.5" />
                          Uygun zamani sec
                          <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                        </Button>
                      </a>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            </div>
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
          {knockState === "waiting" && (<>
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
                  {queueInfo && (
                    <div className="mt-3 inline-flex items-center gap-2 bg-secondary rounded-full px-3 py-1.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">
                        Sirada {queueInfo.position}. siradasiniz
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({queueInfo.totalInQueue} kisi bekliyor)
                      </span>
                    </div>
                  )}
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

            {/* Quiz while waiting */}
            <Card className="mt-3">
              <CardContent className="p-4 sm:p-5">
                {!quizStarted ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground mb-1">Beklerken eglenmek ister misin?</p>
                    <p className="text-xs text-muted-foreground mb-3">Gorusecegn kisiyi ne kadar taniyorsun test et!</p>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setQuizStarted(true)}>
                      <span>🧠</span> Teste Basla
                    </Button>
                  </div>
                ) : quizDone ? (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-foreground mb-1">{quizScore}/5</div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      {quizScore === 5 ? "Mukemmel! Onu cok iyi taniyorsun!" : quizScore >= 3 ? "Fena degil, iyi taniyorsun!" : "Hmm, biraz daha tanisman lazim!"}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {quizData.map((qd, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={quizAnswers[i] === qd.correct ? "text-emerald-600" : "text-red-500"}>
                            {quizAnswers[i] === qd.correct ? "✓" : "✗"}
                          </span>
                          <span className="text-muted-foreground">{qd.q}</span>
                          <span className="font-medium text-foreground ml-auto">{qd.opts[qd.correct]}</span>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" className="mt-3 text-xs" onClick={() => { setQuizStarted(false); setQuizQ(0); setQuizAnswers([null,null,null,null,null]); setQuizRevealed([false,false,false,false,false]); setQuizDone(false); }}>
                      Tekrar Dene
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-muted-foreground font-medium tracking-wider">SORU {quizQ + 1}/5</span>
                      <div className="flex gap-1">
                        {[0,1,2,3,4].map(i => (
                          <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < quizQ ? (quizAnswers[i] === quizData[i].correct ? "bg-emerald-500" : "bg-red-400") : i === quizQ ? "bg-foreground" : "bg-border")} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-3">{quizData[quizQ].q}</p>
                    <div className="space-y-1.5">
                      {quizData[quizQ].opts.map((opt, oi) => {
                        const revealed = quizRevealed[quizQ];
                        const selected = quizAnswers[quizQ] === oi;
                        const isCorrect = oi === quizData[quizQ].correct;
                        return (
                          <button
                            key={oi}
                            onClick={() => answerQuiz(oi)}
                            disabled={revealed}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-lg border text-sm transition-all",
                              revealed && isCorrect && "border-emerald-400 bg-emerald-50 text-emerald-800",
                              revealed && selected && !isCorrect && "border-red-300 bg-red-50 text-red-700",
                              !revealed && "border-border hover:border-foreground/30 hover:bg-secondary text-foreground",
                              revealed && !selected && !isCorrect && "opacity-50"
                            )}
                          >
                            <span className="font-medium mr-2 text-muted-foreground">{String.fromCharCode(65 + oi)})</span>
                            {opt}
                            {revealed && isCorrect && <span className="float-right">✓</span>}
                            {revealed && selected && !isCorrect && <span className="float-right">✗</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>)}

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
