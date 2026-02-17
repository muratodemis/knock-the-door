import { google } from "googleapis";
import fs from "fs";
import path from "path";

const TOKEN_PATH = process.env.NODE_ENV === "production"
  ? "/tmp/.google-tokens.json"
  : path.join(process.cwd(), ".google-tokens.json");

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

// In-memory cache + file backup (both needed for Railway)
let memoryTokens: StoredTokens | null = null;

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
    scope: ["https://www.googleapis.com/auth/calendar.events"],
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

export function clearTokens() {
  deleteTokens();
  oauth2Client.revokeCredentials().catch(() => {});
}

export async function createGoogleMeet(): Promise<string> {
  const storedTokens = readTokens();
  if (!storedTokens) {
    throw new Error("Not authenticated");
  }

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
