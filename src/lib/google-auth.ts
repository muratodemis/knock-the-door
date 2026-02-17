import { google } from "googleapis";
import fs from "fs";
import path from "path";

const TOKEN_PATH = path.join(process.cwd(), ".google-tokens.json");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

function readTokens(): StoredTokens | null {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const data = fs.readFileSync(TOKEN_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch {}
  return null;
}

function writeTokens(tokens: StoredTokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

function deleteTokens() {
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
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const existing = readTokens();
  const stored: StoredTokens = {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? existing?.refresh_token,
    expiry_date: tokens.expiry_date ?? undefined,
  };
  writeTokens(stored);
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

  // Refresh token if expired
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
