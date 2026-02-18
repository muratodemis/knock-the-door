"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import {
  Video,
  X,
  Send,
  AlertTriangle,
  Check,
  Loader2,
  ArrowLeft,
  PhoneOff,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import CalendarWidget from "@/components/calendar-widget";
import Link from "next/link";

interface KnockRequest {
  id: string;
  employeeName: string;
  message: string;
  timestamp: number;
  estimatedDuration?: number;
  queuePosition?: number;
}

interface ChatMessage {
  from: "boss" | "employee";
  text: string;
  timestamp: number;
}

interface CurrentMeetingInfo {
  employeeName: string;
  knockId?: string;
  startedAt?: number;
  estimatedDuration?: number;
}

type BossStatus = "available" | "busy" | "away" | "in-meeting";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function BossPage() {
  const [status, setStatus] = useState<BossStatus>("available");
  const [knocks, setKnocks] = useState<KnockRequest[]>([]);
  const [connected, setConnected] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<CurrentMeetingInfo | null>(null);

  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleChecking, setGoogleChecking] = useState(true);
  const [processingKnockId, setProcessingKnockId] = useState<string | null>(null);
  const [meetError, setMeetError] = useState<string | null>(null);

  const [calendars, setCalendars] = useState<{ id: string; name: string; primary: boolean }[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [calComUrl, setCalComUrl] = useState("cal.com/muratodemis");
  const [calComSaved, setCalComSaved] = useState(false);

  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const chatEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetch(`${basePath}/api/auth/status`)
      .then((res) => res.json())
      .then((data) => {
        setGoogleConnected(data.authenticated);
        setGoogleChecking(false);
      })
      .catch(() => setGoogleChecking(false));

    fetch(`${basePath}/api/calendar/calcom`)
      .then((r) => r.json())
      .then((data) => { if (data.calComUrl) setCalComUrl(data.calComUrl); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      fetch(`${basePath}/api/auth/status`)
        .then((res) => res.json())
        .then((data) => {
          setGoogleConnected(data.authenticated);
          setGoogleChecking(false);
        })
        .catch(() => {
          setGoogleChecking(false);
        });
      window.history.replaceState({}, "", `${basePath}/boss`);
    }
    const errParam = params.get("error");
    if (errParam) {
      setMeetError(`Google baglanti hatasi: ${decodeURIComponent(errParam)}`);
      window.history.replaceState({}, "", `${basePath}/boss`);
    }
  }, []);

  useEffect(() => {
    if (!googleConnected || googleChecking) return;
    setCalendarLoading(true);
    Promise.all([
      fetch(`${basePath}/api/calendar/list`).then((r) => r.json()),
      fetch(`${basePath}/api/calendar/settings`).then((r) => r.json()),
      fetch(`${basePath}/api/auth/token-info`).then((r) => r.json()).catch(() => null),
    ])
      .then(([listData, settingsData, tokenData]) => {
        if (listData.calendars) setCalendars(listData.calendars);
        if (settingsData.selectedCalendarId) {
          setSelectedCalendar(settingsData.selectedCalendarId);
        } else if (listData.calendars?.length) {
          const primary = listData.calendars.find((c: any) => c.primary);
          setSelectedCalendar(primary?.id || listData.calendars[0].id);
        }
        if (tokenData?.refreshToken) setRefreshToken(tokenData.refreshToken);
        setCalendarLoading(false);
      })
      .catch(() => setCalendarLoading(false));
  }, [googleConnected, googleChecking]);

  const saveCalendarSelection = useCallback((calendarId: string) => {
    setSelectedCalendar(calendarId);
    fetch(`${basePath}/api/calendar/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId }),
    }).catch(() => {});
  }, []);

  const saveCalComUrl = useCallback(() => {
    fetch(`${basePath}/api/calendar/calcom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calComUrl }),
    })
      .then(() => {
        setCalComSaved(true);
        setTimeout(() => setCalComSaved(false), 2000);
      })
      .catch(() => {});
  }, [calComUrl]);

  useEffect(() => {
    const socket = getSocket();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("boss-join");
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("boss-status", (s: BossStatus) => {
      setStatus(s);
    });

    socket.on("knock-received", (knock: KnockRequest) => {
      setKnocks((prev) => {
        if (prev.find((k) => k.id === knock.id)) return prev;
        return [...prev, knock];
      });
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
      setCurrentMeeting({
        employeeName: data.employeeName,
        knockId: data.knockId,
        startedAt: Date.now(),
      });
      window.open(data.meetLink, "_blank");
    });

    socket.on("current-meeting-info", (data: CurrentMeetingInfo | null) => {
      setCurrentMeeting(data);
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
      socket.off("boss-status");
      socket.off("knock-received");
      socket.off("door-opened-confirm");
      socket.off("current-meeting-info");
      socket.off("chat-message");
    };
  }, []);

  const changeStatus = useCallback((newStatus: BossStatus) => {
    setStatus(newStatus);
    getSocket().emit("boss-status-change", newStatus);
  }, []);

  const endMeeting = useCallback(() => {
    getSocket().emit("meeting-ended");
    setCurrentMeeting(null);
    setStatus("available");
  }, []);

  const openDoor = useCallback(async (knockId: string) => {
    setProcessingKnockId(knockId);
    setMeetError(null);
    try {
      const res = await fetch(`${basePath}/api/create-meet`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Toplanti olusturulamadi");
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

  const statusConfig: Record<BossStatus, { label: string; variant: "success" | "destructive" | "warning"; dotColor: string }> = {
    available: { label: "Musait", variant: "success", dotColor: "bg-emerald-500" },
    busy: { label: "Mesgul", variant: "destructive", dotColor: "bg-red-500" },
    "in-meeting": { label: "Gorusmede", variant: "destructive", dotColor: "bg-red-500" },
    away: { label: "Uzakta", variant: "warning", dotColor: "bg-amber-500" },
  };

  const meetingElapsedMinutes = currentMeeting?.startedAt
    ? Math.floor((Date.now() - currentMeeting.startedAt) / 60000)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <nav className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="h-5 w-px bg-border flex-shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span className="font-semibold text-sm text-foreground truncate">Yonetici</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {!googleChecking && (
              googleConnected ? (
                <Badge variant="success" className="gap-1 text-[11px] px-2 py-0.5 hidden sm:inline-flex">
                  <Check className="w-3 h-3" />
                  Google
                </Badge>
              ) : (
                <a href={`${basePath}/api/auth/google`}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-2.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span className="hidden sm:inline">Baglan</span>
                  </Button>
                </a>
              )
            )}
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", connected ? "bg-emerald-500" : "bg-red-500")} />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {connected ? "Bagli" : "Kesildi"}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Google not connected warning */}
        {!googleChecking && !googleConnected && (
          <Card className="mb-4 sm:mb-6 border-amber-200 bg-amber-50/50">
            <CardContent className="p-3 sm:p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900">Google Hesabi Bagli Degil</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Otomatik Google Meet olusturmak icin hesabinizi baglayin.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meet error */}
        {meetError && (
          <Card className="mb-4 sm:mb-6 border-red-200 bg-red-50/50">
            <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-red-700 min-w-0">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm truncate">{meetError}</span>
              </div>
              <button onClick={() => setMeetError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Active Meeting Banner */}
        {status === "in-meeting" && currentMeeting && (
          <Card className="mb-4 sm:mb-6 border-red-200 bg-red-50/50">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-red-900">
                      Aktif Gorusme
                    </p>
                    <p className="text-xs text-red-700 mt-0.5">
                      <span className="font-medium">{currentMeeting.employeeName}</span> ile gorusme devam ediyor
                      {meetingElapsedMinutes > 0 && (
                        <span className="ml-1.5 text-red-500">({meetingElapsedMinutes} dk)</span>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 flex-shrink-0"
                  onClick={endMeeting}
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gorusmeyi Bitir</span>
                  <span className="sm:hidden">Bitir</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Control */}
        {status !== "in-meeting" && (
          <Card className="mb-4 sm:mb-6">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-sm font-medium text-foreground">Kapi Durumu</h2>
                <Badge variant={statusConfig[status].variant}>
                  <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusConfig[status].dotColor)} />
                  {statusConfig[status].label}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["available", "busy", "away"] as BossStatus[]).map((s) => (
                  <Button
                    key={s}
                    variant={status === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => changeStatus(s)}
                    className={cn(
                      "text-xs sm:text-sm",
                      status === s && s === "available" && "bg-emerald-600 hover:bg-emerald-700",
                      status === s && s === "busy" && "bg-red-500 hover:bg-red-600",
                      status === s && s === "away" && "bg-amber-500 hover:bg-amber-600",
                    )}
                  >
                    {statusConfig[s].label}
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {status === "available" && "Calisanlar kapinizi calabilir."}
                {status === "busy" && "Mesgul gorunuyorsunuz, acil durumlar icin kapi acik."}
                {status === "away" && "Uzaktasiniz. Kapi calma devre disi."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main content: Knocks (left) + Calendar (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Left: Knock Requests / Queue (8 cols) */}
          <div className="lg:col-span-8">
            {knocks.length === 0 ? (
              <Card>
                <CardContent className="p-8 sm:p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Henuz kimse kapiyi calmadi</p>
                  <p className="text-xs text-muted-foreground">Yeni bildirimler burada gorunecek</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-foreground">
                    Siradaki Talepler
                  </h2>
                  <Badge variant="secondary">{knocks.length} kisi bekliyor</Badge>
                </div>

                {knocks.map((knock, index) => (
              <Card key={knock.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Knock header */}
                  <div className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-secondary text-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 relative">
                        <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
                          {index + 1}
                        </span>
                        {knock.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-foreground truncate">{knock.employeeName}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{formatTime(knock.timestamp)}</span>
                          {knock.estimatedDuration && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                              <Clock className="w-3 h-3" />
                              {knock.estimatedDuration} dk
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {knock.message && (
                      <p className="text-sm text-muted-foreground bg-secondary rounded-lg px-3 py-2 mb-3">
                        {knock.message}
                      </p>
                    )}

                    <div className="flex gap-2">
                      {processingKnockId === knock.id ? (
                        <Button size="sm" disabled className="gap-1.5 flex-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Olusturuluyor...
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            className="gap-1.5 flex-1"
                            onClick={() => openDoor(knock.id)}
                            disabled={!googleConnected || processingKnockId !== null}
                          >
                            <Video className="w-3.5 h-3.5" />
                            {index === 0 ? "Kapiyi Ac" : `Kapiyi Ac (#${index + 1})`}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-muted-foreground hover:text-destructive flex-shrink-0"
                            onClick={() => declineKnock(knock.id)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chat area */}
                  <div className="border-t border-border">
                    {(chatMessages[knock.id]?.length ?? 0) > 0 && (
                      <div className="max-h-48 overflow-y-auto p-3 space-y-2 chat-scroll">
                        {chatMessages[knock.id].map((msg, i) => (
                          <div
                            key={i}
                            className={cn("flex", msg.from === "boss" ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] px-3 py-2 rounded-lg text-sm",
                                msg.from === "boss"
                                  ? "bg-foreground text-background rounded-br-sm"
                                  : "bg-secondary text-secondary-foreground rounded-bl-sm"
                              )}
                            >
                              <p>{msg.text}</p>
                              <p className={cn(
                                "text-[10px] mt-1",
                                msg.from === "boss" ? "text-background/60" : "text-muted-foreground"
                              )}>
                                {formatTime(msg.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={(el) => { chatEndRefs.current[knock.id] = el; }} />
                      </div>
                    )}

                    <div className="p-3 flex gap-2">
                      <Input
                        value={chatInputs[knock.id] || ""}
                        onChange={(e) => setChatInputs((prev) => ({ ...prev, [knock.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && sendChat(knock.id)}
                        placeholder="Mesaj yazin..."
                        className="h-9 text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => sendChat(knock.id)}
                        disabled={!chatInputs[knock.id]?.trim()}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
              </div>
            )}
          </div>

          {/* Right: Calendar (4 cols) */}
          {!googleChecking && googleConnected && (
            <div className="lg:col-span-4 lg:sticky lg:top-20">
              {calendars.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-foreground">Takvim</h2>
                  <select
                    value={selectedCalendar || ""}
                    onChange={(e) => saveCalendarSelection(e.target.value)}
                    className="text-xs border border-input rounded-md px-2 py-1 bg-background text-foreground max-w-[140px] truncate"
                  >
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>
                        {cal.name}{cal.primary ? " (Ana)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <CalendarWidget />

              {refreshToken && !process.env.NEXT_PUBLIC_HAS_REFRESH_ENV && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowToken((v) => !v)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showToken ? "Token'i gizle" : "Kalici baglanti icin token'i goster"}
                  </button>
                  {showToken && (
                    <div className="mt-2 p-2.5 bg-secondary rounded-md">
                      <p className="text-[10px] text-muted-foreground mb-1.5">
                        Bu refresh token'i Railway'de <code className="text-foreground">GOOGLE_REFRESH_TOKEN</code> ortam degiskeni olarak kaydedin. Boylece deploy sonrasi tekrar giris gerekmez.
                      </p>
                      <div className="flex gap-1.5">
                        <code className="text-[10px] bg-background border border-input rounded px-2 py-1 flex-1 break-all select-all max-h-20 overflow-y-auto">
                          {refreshToken}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(refreshToken);
                            setTokenCopied(true);
                            setTimeout(() => setTokenCopied(false), 2000);
                          }}
                          className="text-[10px] px-2 py-1 bg-foreground text-background rounded hover:opacity-90 flex-shrink-0 self-start"
                        >
                          {tokenCopied ? "Kopyalandi!" : "Kopyala"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cal.com booking config */}
              <Card className="mt-3">
                <CardContent className="p-4 sm:p-5">
                  <h3 className="text-sm font-medium text-foreground mb-2">Randevu Linki (Cal.com)</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Calisanlar bu link uzerinden sizinle gorusme planlayabilir.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={calComUrl}
                      onChange={(e) => setCalComUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveCalComUrl()}
                      placeholder="cal.com/kullaniciadi"
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-3 flex-shrink-0"
                      onClick={saveCalComUrl}
                    >
                      {calComSaved ? "Kaydedildi!" : "Kaydet"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cal.com config when Google not connected */}
          {!googleChecking && !googleConnected && (
            <div className="lg:col-span-4">
              <Card>
                <CardContent className="p-4 sm:p-5">
                  <h3 className="text-sm font-medium text-foreground mb-2">Randevu Linki (Cal.com)</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Calisanlar bu link uzerinden sizinle gorusme planlayabilir.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={calComUrl}
                      onChange={(e) => setCalComUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveCalComUrl()}
                      placeholder="cal.com/kullaniciadi"
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-3 flex-shrink-0"
                      onClick={saveCalComUrl}
                    >
                      {calComSaved ? "Kaydedildi!" : "Kaydet"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
