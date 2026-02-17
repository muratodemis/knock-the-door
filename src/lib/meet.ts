import { v4 as uuidv4 } from "uuid";

export function generateMeetLink(): string {
  // Generate a random meeting code in Google Meet format (xxx-xxxx-xxx)
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const randomChars = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  const code = `${randomChars(3)}-${randomChars(4)}-${randomChars(3)}`;
  return `https://meet.google.com/new`;
}

export function generateRoomId(): string {
  return uuidv4().split("-")[0];
}
