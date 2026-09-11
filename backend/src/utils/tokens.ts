import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Role } from "@prisma/client";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in .env");
}

export interface AccessPayload {
  sub: string; // user id
  role: Role;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessPayload;
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}

// Refresh tokens are stored hashed (like passwords) so a DB leak doesn't
// hand out usable tokens. Lets us revoke on logout/refresh-rotation too.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
