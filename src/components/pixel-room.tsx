"use client";

import { useEffect, useRef, useCallback } from "react";

type RoomStatus = "available" | "busy" | "in-meeting" | "away";
interface PixelRoomProps { status: RoomStatus; className?: string; }

const LW = 192, LH = 136, S = 3;
const CW = LW * S, CH = LH * S;
type CTX = CanvasRenderingContext2D;

function r(c: CTX, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h);
}
function spr(c: CTX, ox: number, oy: number, rows: string[], pal: Record<string, string>) {
  for (let ry = 0; ry < rows.length; ry++)
    for (let rx = 0; rx < rows[ry].length; rx++) {
      const ch = rows[ry][rx];
      if (ch !== "." && pal[ch]) { c.fillStyle = pal[ch]; c.fillRect(ox + rx, oy + ry, 1, 1); }
    }
}

const O = "#141218";
const C = {
  wallTop: "#2A2836", wallMid: "#333146", wallBot: "#3D3A50",
  floor: "#2E3A52", floorD: "#283248",
  desk: "#8B6B44", deskD: "#6B5030", deskL: "#A07850", deskE: "#5A3E22",
  monF: "#1E1E24", monS: "#111318", monB: "#2A2A34",
  mugW: "#E8E4DC", mugD: "#C8C0B0", mugC: "#6B4228",
  skin: "#FDBCB4", skinD: "#E5A090",
  hair: "#3D2B1F", hairL: "#6B4A35",
  shirt: "#5B8ED9", shirtD: "#4070B8", shirtL: "#80B0F0",
  hp: "#E74C4C", hpD: "#C03030", hpBand: "#D04040",
  gHair: "#78350F", gHairL: "#A0622B",
  gShirt: "#E96D2B", gShirtD: "#C85A1E",
  plant: "#2EAA4A", plantD: "#1A7A30", plantL: "#50D468",
  pot: "#8B5E3C",
  frame: "#6B5030",
  shelf: "#5A4030", shelfL: "#7A5A42",
  bk: ["#D04040", "#3070C0", "#30A050", "#D0A020", "#8040B0"],
  stG: "#30D060", stR: "#F04040", stY: "#F0C030", stOff: "#555",
  chBack: "#3A4250", chSeat: "#454E5E", chLeg: "#555E6E", chW: "#444",
};

// ── Boss character (18 wide × 22 tall) ──
const BP: Record<string, string> = {
  o: O, h: C.hair, H: C.hairL, s: C.skin, S: C.skinD,
  e: O, w: "#FFF", m: "#D08878",
  b: C.shirt, B: C.shirtD, c: C.shirtL,
};

const BOSS_IDLE = [
  "......oooooo......",
  ".....ohhhhhho.....",
  "....ohhHHHhhho....",
  "....ohhhhhhhho....",
  "....ohhhhhhhho....",
  "....ohhhhhhhho....",
  "....osssssssso....",
  "....oSwwsswwSo....",
  "....oSeesseeSo....",
  "....oSssssssSo....",
  ".....ossmmsso.....",
  "......ossso.......",
  ".......oso........",
  "......obbbo.......",
  ".....obbBBbo......",
  "....obcBBBBbo.....",
  "...obbBBBBBBbo....",
  "..obbBBBBBBBBbo...",
  ".os.bBBBBBBBb.so..",
  ".os.bBBBBBBBb.so..",
  "..obbBBBBBBBBbo...",
  "...oooooooooooo...",
];

const BOSS_BLINK = BOSS_IDLE.map((row, i) =>
  i === 7 ? "....oSsssssssSo...." :
  i === 8 ? "....oSoossoooSo...." : row
);

const BOSS_BUSY = [
  "..xx..oooooo..xx..",
  "..xx.ohhhhhho.xx..",
  "....ohhHHHhhho....",
  ".XX.ohhhhhhhho.XX.",
  ".XX.ohhhhhhhho.XX.",
  ".XX.ohhhhhhhho.XX.",
  "....osssssssso....",
  "....oSwwsswwSo....",
  "....oSeesseeSo....",
  "....oSssssssSo....",
  ".....ossmmsso.....",
  "......ossso.......",
  ".......oso........",
  "......obbbo.......",
  ".....obbBBbo......",
  "....obcBBBBbo.....",
  "...obbBBBBBBbo....",
  "..obbBBBBBBBBbo...",
  "..obbBBBBBBBBbos..",
  "..obbBBBBBBBBbos..",
  "..obbBBBBBBBBbo...",
  "...oooooooooooo...",
];
const BPB: Record<string, string> = {
  ...BP, x: C.hpBand, X: C.hp,
};

// Guest side profile (facing left, sitting, 16w × 18h)
const GP: Record<string, string> = {
  o: O, h: C.gHair, H: C.gHairL, s: C.skin, S: C.skinD,
  e: O, w: "#FFF", m: "#D08878", n: C.skin,
  b: C.gShirt, B: C.gShirtD, c: "#E08040",
};
const GUEST = [
  "....ooooooo.",
  "...ohhhhhhho",
  "..ohhhHHhhho",
  "..ohhhhhhho.",
  "..osssssho..",
  "..oSwwsSho..",
  "..oSeesSo...",
  "..oSssmo....",
  "...ossso....",
  "....oso.....",
  "...obbbo....",
  "..obbBBbo...",
  ".obBBBBBbo..",
  "os.BBBBBbo..",
  "os.BBBBBbo..",
  "..obBBBBbo..",
];

// ── Drawing ──

function drawRoom(c: CTX) {
  r(c, 0, 0, LW, 36, C.wallTop);
  r(c, 0, 36, LW, 4, C.wallMid);
  r(c, 0, 40, LW, LH - 40, C.floor);
  for (let x = 0; x < LW; x += 16) {
    if ((x / 16) % 2 === 0) r(c, x, 40, 16, LH - 40, C.floorD);
  }
  r(c, 0, 40, LW, 1, C.wallBot);
}

function drawPicture(c: CTX) {
  const px = 80, py = 6, pw = 32, ph = 22;
  r(c, px - 1, py - 1, pw + 2, ph + 2, C.frame);
  r(c, px, py, pw, ph, "#C8E0F0");
  r(c, px, py + 12, pw, 6, "#4CAF50");
  r(c, px, py + 18, pw, 4, "#388E3C");
  r(c, px + 8, py + 4, 6, 6, "#FDD835");
  r(c, px + 16, py + 5, 4, 3, "#FFF");
  r(c, px + 22, py + 7, 3, 2, "#FFF8");
}

function drawShelf(c: CTX, sx: number) {
  r(c, sx, 6, 24, 24, C.shelf);
  r(c, sx + 1, 7, 22, 1, C.shelfL);
  r(c, sx + 1, 17, 22, 1, C.shelfL);
  for (let i = 0; i < 4; i++) {
    const bh = 5 + (i * 3) % 3;
    r(c, sx + 2 + i * 5, 8 + (8 - bh), 4, bh, C.bk[i]);
  }
  for (let i = 0; i < 4; i++) {
    const bh = 4 + (i * 5) % 4;
    r(c, sx + 2 + i * 5, 18 + (8 - bh), 4, bh, C.bk[(i + 2) % 5]);
  }
}

function drawPlant(c: CTX, px: number, py: number, f: number) {
  r(c, px, py + 8, 10, 8, C.pot);
  r(c, px + 1, py + 8, 8, 1, "#A07050");
  const sw = Math.sin(f * 0.04) * 0.6;
  r(c, px + 4, py + 4, 2, 4, C.plantD);
  r(c, px + 1 + Math.round(sw), py + 1, 4, 4, C.plant);
  r(c, px + 6 - Math.round(sw), py + 1, 4, 4, C.plantD);
  r(c, px + 3, py - 2, 4, 4, C.plant);
  r(c, px + 4, py - 3, 2, 2, C.plantL);
}

function drawDesk(c: CTX) {
  r(c, 54, 60, 84, 30, C.desk);
  r(c, 54, 60, 84, 2, C.deskL);
  r(c, 54, 88, 84, 2, C.deskD);
  r(c, 54, 60, 2, 30, C.deskD);
  r(c, 136, 60, 2, 30, C.deskE);
}

function drawMonitor(c: CTX, status: RoomStatus, f: number) {
  const mx = 74, my = 62, mw = 28, mh = 18;
  r(c, mx, my, mw, mh, C.monF);
  r(c, mx + 1, my + 1, mw - 2, mh - 2, status === "away" ? "#1A1A20" : C.monS);
  r(c, mx + mw / 2 - 3, my + mh, 6, 2, C.monB);
  r(c, mx + mw / 2 - 5, my + mh + 2, 10, 2, C.monB);

  if (status === "away") return;

  const sx = mx + 2, sy = my + 2, sw = mw - 4, sh = mh - 4;
  if (status === "available") {
    r(c, sx, sy, 8, 6, "#3B82F6");
    r(c, sx + 10, sy + 1, 12, 2, "#4B5563");
    r(c, sx + 10, sy + 4, 10, 1, "#6B7280");
    r(c, sx + 10, sy + 6, 8, 1, "#4B5563");
    r(c, sx, sy + 8, sw, 1, "#374151");
    r(c, sx, sy + 10, 16, 1, "#4B5563");
    r(c, sx, sy + 12, 12, 1, "#374151");
  } else if (status === "busy") {
    const cols = ["#A78BFA", "#58A6FF", "#4ADE80", "#FB923C", "#38BDF8", "#F472B6"];
    for (let i = 0; i < 6; i++) {
      const indent = (i % 3) * 3;
      const w = 4 + ((i * 5 + 3) % 8);
      r(c, sx + indent, sy + 1 + i * 2, w, 1, cols[i]);
    }
    if (f % 6 < 4) {
      const cx = sx + indent_cursor(f);
      const cy = sy + 1 + (f % 6) * 2;
      if (cy < sy + sh) r(c, cx, cy, 1, 2, "#FFF");
    }
  } else if (status === "in-meeting") {
    r(c, sx, sy, sw / 2 - 1, sh, "#1A2030");
    r(c, sx + sw / 2 + 1, sy, sw / 2 - 1, sh, "#1A2030");
    r(c, sx + 3, sy + 1, 5, 5, C.skin);
    r(c, sx + sw / 2 + 3, sy + 1, 5, 5, C.skin);
    r(c, sx + 2, sy + 7, 7, 4, C.shirt);
    r(c, sx + sw / 2 + 2, sy + 7, 7, 4, C.gShirt);
  }
}
function indent_cursor(f: number) { return 2 + (f % 5) * 3; }

function drawMug(c: CTX, status: RoomStatus, f: number) {
  const mx = 114, my = 66;
  r(c, mx, my, 6, 8, C.mugW);
  r(c, mx, my, 6, 2, C.mugD);
  r(c, mx + 1, my + 2, 4, 2, C.mugC);
  r(c, mx + 6, my + 2, 2, 4, C.mugD);
  if (status !== "away") {
    const t = f * 0.25;
    c.globalAlpha = 0.4; c.fillStyle = "#FFF";
    c.fillRect(mx + 1, my - 2 - Math.floor(t % 5), 1, 1);
    c.fillRect(mx + 3, my - 3 - Math.floor((t + 2) % 5), 1, 1);
    c.globalAlpha = 1;
  }
}

function drawStatusDot(c: CTX, status: RoomStatus, f: number) {
  const sx = 64, sy = 68;
  const col = status === "available" ? C.stG
    : status === "busy" ? C.stR
    : status === "in-meeting" ? (f % 20 < 12 ? C.stR : C.stY)
    : C.stOff;
  r(c, sx, sy, 4, 4, col);
  c.fillStyle = col + "30";
  c.fillRect(sx - 1, sy - 1, 6, 6);
}

function drawBubble(c: CTX, bx: number, by: number, text: string, dotCol: string) {
  c.font = "bold 7px sans-serif";
  const tw = c.measureText(text).width;
  const pw = Math.ceil(tw) + 11;
  const ph = 11;
  const x = Math.round(bx - pw / 2);
  const y = by - ph;

  r(c, x + 1, y, pw - 2, ph, "#FFF");
  r(c, x, y + 1, pw, ph - 2, "#FFF");
  c.fillStyle = "#CCC";
  c.fillRect(x + 1, y, pw - 2, 1);
  c.fillRect(x + 1, y + ph - 1, pw - 2, 1);
  c.fillRect(x, y + 1, 1, ph - 2);
  c.fillRect(x + pw - 1, y + 1, 1, ph - 2);

  r(c, bx, y + ph, 1, 2, "#FFF");
  r(c, bx - 1, y + ph + 1, 1, 1, "#CCC");
  r(c, bx + 1, y + ph + 1, 1, 1, "#CCC");

  r(c, x + 3, y + Math.floor((ph - 4) / 2), 4, 4, dotCol);
  c.fillStyle = "#333";
  c.fillText(text, x + 9, y + ph - 3);
}

function drawChairBack(c: CTX, cx: number, cy: number) {
  r(c, cx, cy, 20, 3, C.chBack);
  r(c, cx + 1, cy - 6, 18, 6, C.chBack);
  r(c, cx + 3, cy - 4, 14, 1, "#4A5260");
}
function drawChairSeat(c: CTX, cx: number, cy: number) {
  r(c, cx - 1, cy + 24, 22, 4, C.chSeat);
  r(c, cx + 4, cy + 28, 3, 4, C.chLeg);
  r(c, cx + 13, cy + 28, 3, 4, C.chLeg);
  r(c, cx + 1, cy + 32, 4, 2, C.chW);
  r(c, cx + 7, cy + 32, 6, 2, C.chW);
  r(c, cx + 15, cy + 32, 4, 2, C.chW);
}

function drawGuestChair(c: CTX, cx: number, cy: number) {
  r(c, cx + 1, cy + 16, 18, 3, C.chSeat);
  r(c, cx + 4, cy + 19, 3, 4, C.chLeg);
  r(c, cx + 13, cy + 19, 3, 4, C.chLeg);
  r(c, cx + 1, cy + 23, 4, 2, C.chW);
  r(c, cx + 7, cy + 23, 6, 2, C.chW);
  r(c, cx + 15, cy + 23, 4, 2, C.chW);
}

// ── Render ──

function render(c: CTX, status: RoomStatus, f: number) {
  c.clearRect(0, 0, CW, CH);
  c.save();
  c.scale(S, S);

  drawRoom(c);
  drawPicture(c);
  drawShelf(c, 16);
  drawShelf(c, 152);
  drawPlant(c, 4, 46, f);
  drawPlant(c, 178, 46, f);

  drawDesk(c);
  drawMonitor(c, status, f);
  drawMug(c, status, f);
  drawStatusDot(c, status, f);

  const bx = 87, by = 40;

  if (status !== "away") {
    drawChairBack(c, bx - 1, by);
    const blink = f % 70 > 65;
    if (status === "busy" || status === "in-meeting") {
      spr(c, bx - 3, by - 2, blink ? BOSS_BLINK : BOSS_BUSY, BPB);
    } else {
      spr(c, bx - 3, by - 2, blink ? BOSS_BLINK : BOSS_IDLE, BP);
    }
    drawChairSeat(c, bx - 1, by);

    const bubX = bx + 5;
    const bubY = by - 6;
    if (status === "available") {
      drawBubble(c, bubX, bubY, "Musait", C.stG);
    } else if (status === "busy") {
      if (f % 50 < 38) drawBubble(c, bubX, bubY, "Mesgul", C.stR);
    } else if (status === "in-meeting") {
      drawBubble(c, bubX, bubY, "Mesgul", C.stR);
    }
  } else {
    drawChairBack(c, bx - 7, by + 6);
    drawChairSeat(c, bx - 7, by + 6);
  }

  if (status === "in-meeting") {
    const gx = 82, gy = 92;
    drawGuestChair(c, gx, gy);
    spr(c, gx + 2, gy, GUEST, GP);
  }

  if (status === "away") {
    r(c, 0, 0, LW, LH, "rgba(8,12,24,0.4)");
    c.font = "bold 9px sans-serif";
    c.fillStyle = "rgba(255,255,255,0.6)";
    const t = "Uzakta";
    const tw = c.measureText(t).width;
    c.fillText(t, (LW - tw) / 2, LH / 2);
  }

  c.restore();
}

// ── Component ──

export default function PixelRoom({ status, className }: PixelRoomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  const draw = useCallback((time: number) => {
    rafRef.current = requestAnimationFrame(draw);
    if (time - lastRef.current < 110) return;
    lastRef.current = time;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    frameRef.current++;
    render(ctx, status, frameRef.current);
  }, [status]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className={className}
      style={{ imageRendering: "pixelated", width: "100%", height: "auto" }}
    />
  );
}
