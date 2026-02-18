"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BusySlot {
  start: string;
  end: string;
}

interface CalendarWidgetProps {
  className?: string;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const WORK_START = 9;
const WORK_END = 18;

const DAY_NAMES_SHORT = ["PAZ", "PZT", "SAL", "CAR", "PER", "CUM", "CMT"];
const MONTH_NAMES = [
  "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
  "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik",
];

function getWeekDays(baseDate: Date) {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatHour(h: number, m: number = 0) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface TimeBlock {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  busy: boolean;
}

function buildTimeBlocks(slots: BusySlot[]): TimeBlock[] {
  const busyRanges = slots
    .map((s) => {
      const start = new Date(s.start);
      const end = new Date(s.end);
      return {
        startMin: start.getHours() * 60 + start.getMinutes(),
        endMin: end.getHours() * 60 + end.getMinutes(),
      };
    })
    .filter((r) => r.endMin > WORK_START * 60 && r.startMin < WORK_END * 60)
    .map((r) => ({
      startMin: Math.max(r.startMin, WORK_START * 60),
      endMin: Math.min(r.endMin, WORK_END * 60),
    }))
    .sort((a, b) => a.startMin - b.startMin);

  const merged: { startMin: number; endMin: number }[] = [];
  for (const r of busyRanges) {
    if (merged.length > 0 && r.startMin <= merged[merged.length - 1].endMin) {
      merged[merged.length - 1].endMin = Math.max(merged[merged.length - 1].endMin, r.endMin);
    } else {
      merged.push({ ...r });
    }
  }

  const blocks: TimeBlock[] = [];
  let cursor = WORK_START * 60;

  for (const busy of merged) {
    if (busy.startMin > cursor) {
      blocks.push({
        startHour: Math.floor(cursor / 60),
        startMin: cursor % 60,
        endHour: Math.floor(busy.startMin / 60),
        endMin: busy.startMin % 60,
        busy: false,
      });
    }
    blocks.push({
      startHour: Math.floor(busy.startMin / 60),
      startMin: busy.startMin % 60,
      endHour: Math.floor(busy.endMin / 60),
      endMin: busy.endMin % 60,
      busy: true,
    });
    cursor = busy.endMin;
  }

  if (cursor < WORK_END * 60) {
    blocks.push({
      startHour: Math.floor(cursor / 60),
      startMin: cursor % 60,
      endHour: WORK_END,
      endMin: 0,
      busy: false,
    });
  }

  return blocks;
}

export default function CalendarWidget({ className }: CalendarWidgetProps) {
  const [slots, setSlots] = useState<BusySlot[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const baseDate = new Date(today);
  baseDate.setDate(today.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    fetch(`${basePath}/api/calendar/events`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots || []);
        setConnected(data.connected ?? null);
        setLoading(false);
      })
      .catch(() => {
        setConnected(false);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const timeBlocks = buildTimeBlocks(slots);
  const isCurrentWeek = weekOffset === 0;

  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Bugun</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}
          </span>
        </div>

        {/* Week strip */}
        <div className="flex items-center gap-1 mb-4">
          <button
            onClick={() => setWeekOffset((p) => p - 1)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 grid grid-cols-7 gap-0.5">
            {weekDays.map((d, i) => {
              const isToday = isSameDay(d, today);
              return (
                <div key={i} className="flex flex-col items-center">
                  <span className={cn(
                    "text-[10px] font-medium mb-1",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {DAY_NAMES_SHORT[d.getDay()]}
                  </span>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold transition-colors",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setWeekOffset((p) => p + 1)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-3" />

        {/* Schedule */}
        {loading ? (
          <div className="py-6 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:200ms]" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:400ms]" />
            </div>
            <p className="text-xs text-muted-foreground">Takvim yukleniyor...</p>
          </div>
        ) : connected === false ? (
          <div className="py-6 text-center">
            <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Takvim bagli degil</p>
          </div>
        ) : !isCurrentWeek ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">Sadece bugunun takvimi gosterilir</p>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-primary hover:underline mt-1"
            >
              Bugune don
            </button>
          </div>
        ) : timeBlocks.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">Bugun takvimde etkinlik yok</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {timeBlocks.map((block, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs",
                  block.busy
                    ? "bg-red-50 border border-red-100"
                    : "bg-emerald-50 border border-emerald-100"
                )}
              >
                <div className={cn(
                  "w-1.5 h-full min-h-[16px] rounded-full flex-shrink-0",
                  block.busy ? "bg-red-400" : "bg-emerald-400"
                )} />
                <span className="text-muted-foreground font-mono whitespace-nowrap">
                  {formatHour(block.startHour, block.startMin)} - {formatHour(block.endHour, block.endMin)}
                </span>
                <span className={cn(
                  "font-medium ml-auto",
                  block.busy ? "text-red-700" : "text-emerald-700"
                )}>
                  {block.busy ? "Dolu" : "Bos"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
