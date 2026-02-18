import { google } from "googleapis";
import fs from "fs";
import path from "path";

const TOKEN_PATH = process.env.NODE_ENV === "production"
  ? "/tmp/.google-tokens.json"
  : path.join(process.cwd(), ".google-tokens.json");

const SETTINGS_PATH = process.env.NODE_ENV === "production"
  ? "/tmp/.calendar-settings.json"
  : path.join(process.cwd(), ".calendar-settings.json");

const redirectUri = process.env.NODE_ENV === "production"
  ? "https://murat.org/knock/api/auth/callback"
  : "http://localhost:3012/api/auth/callback";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  redirectUri
);

interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

interface CalendarSettings {
  selectedCalendarId: string;
}

let memoryTokens: StoredTokens | null = null;
let memorySettings: CalendarSettings | null = null;
let bootstrapped = false;

async function bootstrapFromEnv() {
  if (bootstrapped) return;
  bootstrapped = true;

  const envRefresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!envRefresh) return;
  if (memoryTokens) return;

  try {
    if (fs.existsSync(TOKEN_PATH)) return;
  } catch {}

  try {
    oauth2Client.setCredentials({ refresh_token: envRefresh });
    const { credentials } = await oauth2Client.refreshAccessToken();
    const tokens: StoredTokens = {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token ?? envRefresh,
      expiry_date: credentials.expiry_date ?? undefined,
    };
    writeTokens(tokens);
    oauth2Client.setCredentials(tokens);
    console.log("Bootstrapped Google auth from GOOGLE_REFRESH_TOKEN env var");
  } catch (e) {
    console.error("Failed to bootstrap from GOOGLE_REFRESH_TOKEN:", e);
  }
}

function readTokens(): StoredTokens | null {
  if (memoryTokens) return memoryTokens;
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const data = fs.readFileSync(TOKEN_PATH, "utf-8");
      memoryTokens = JSON.parse(data);
      return memoryTokens;
    }
  } catch (e) {
    console.error("readTokens error:", e);
  }
  return null;
}

function writeTokens(tokens: StoredTokens) {
  memoryTokens = tokens;
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  } catch (e) {
    console.error("writeTokens file error (using memory only):", e);
  }
}

function deleteTokens() {
  memoryTokens = null;
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
  } catch {}
}

export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
}

export function getOAuth2Client() {
  const tokens = readTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }
  return oauth2Client;
}

export async function handleCallback(code: string) {
  console.log("handleCallback: exchanging code for tokens...");
  const { tokens } = await oauth2Client.getToken(code);
  console.log("handleCallback: got tokens, access_token:", !!tokens.access_token, "refresh_token:", !!tokens.refresh_token);
  oauth2Client.setCredentials(tokens);

  const existing = readTokens();
  const stored: StoredTokens = {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? existing?.refresh_token,
    expiry_date: tokens.expiry_date ?? undefined,
  };
  writeTokens(stored);
  console.log("handleCallback: tokens saved, isAuthenticated:", isAuthenticated());
  return tokens;
}

export function isAuthenticated(): boolean {
  return readTokens() !== null;
}

export async function ensureBootstrapped() {
  await bootstrapFromEnv();
}

export function getRefreshToken(): string | null {
  const tokens = readTokens();
  return tokens?.refresh_token ?? null;
}

export function clearTokens() {
  deleteTokens();
  oauth2Client.revokeCredentials().catch(() => {});
}

async function ensureFreshAuth() {
  const storedTokens = readTokens();
  if (!storedTokens) throw new Error("Not authenticated");

  oauth2Client.setCredentials(storedTokens);

  if (storedTokens.expiry_date && storedTokens.expiry_date < Date.now()) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const refreshed: StoredTokens = {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token ?? storedTokens.refresh_token,
      expiry_date: credentials.expiry_date ?? undefined,
    };
    writeTokens(refreshed);
    oauth2Client.setCredentials(refreshed);
  }
}

export async function createGoogleMeet(): Promise<string> {
  await ensureFreshAuth();

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: "Knock The Door - Görüşme",
      start: { dateTime: now.toISOString() },
      end: { dateTime: end.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: `ktd-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const meetLink = event.data.conferenceData?.entryPoints?.find(
    (e) => e.entryPointType === "video"
  )?.uri;

  if (!meetLink) {
    throw new Error("Google Meet link could not be created");
  }

  return meetLink;
}

export async function listCalendars() {
  await ensureFreshAuth();

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const res = await calendar.calendarList.list();

  return (res.data.items || []).map((cal) => ({
    id: cal.id!,
    name: cal.summary || cal.id!,
    primary: cal.primary || false,
  }));
}

export interface BusySlot {
  start: string;
  end: string;
}

export async function getTodayBusySlots(calendarId?: string): Promise<BusySlot[]> {
  await ensureFreshAuth();

  const targetCalendar = calendarId || getSelectedCalendarId() || "primary";
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const res = await calendar.events.list({
    calendarId: targetCalendar,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items || [])
    .filter((event) => event.start?.dateTime && event.end?.dateTime)
    .map((event) => ({
      start: event.start!.dateTime!,
      end: event.end!.dateTime!,
    }));
}

export function getSelectedCalendarId(): string | null {
  if (memorySettings) return memorySettings.selectedCalendarId;
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = fs.readFileSync(SETTINGS_PATH, "utf-8");
      memorySettings = JSON.parse(data);
      return memorySettings!.selectedCalendarId;
    }
  } catch {}
  return null;
}

export function setSelectedCalendarId(id: string) {
  memorySettings = { selectedCalendarId: id };
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(memorySettings, null, 2));
  } catch (e) {
    console.error("writeSettings file error (using memory only):", e);
  }
}
