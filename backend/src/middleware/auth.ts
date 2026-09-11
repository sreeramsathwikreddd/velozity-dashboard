import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { verifyAccessToken } from "../utils/tokens";
import { unauthorized, forbidden } from "../utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

// Reads the Bearer access token, verifies it, attaches req.user.
// This runs on EVERY protected route — there is no route that trusts
// a client-supplied role or id instead of this.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(unauthorized("Missing access token"));

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(unauthorized("Invalid or expired access token"));
  }
}

// Coarse role gate: does this role even have this endpoint at all.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
