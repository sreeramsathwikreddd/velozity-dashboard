import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../utils/tokens";
import { asyncHandler, badRequest, unauthorized } from "../utils/errors";
import { authenticate } from "../middleware/auth";

const router = Router();

const REFRESH_COOKIE = "refresh_token";
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return next(badRequest("Email and password required"));

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(unauthorized("Invalid credentials"));

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return next(unauthorized("Invalid credentials"));

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res, next) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return next(unauthorized("No refresh token"));

    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return next(unauthorized("Refresh token invalid or expired"));
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return next(unauthorized("Refresh token revoked"));
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return next(unauthorized());

    // Rotate: revoke old, issue new. Limits damage from a leaked token.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });
    const newRefreshToken = signRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    res.cookie(REFRESH_COOKIE, newRefreshToken, REFRESH_COOKIE_OPTS);
    res.json({ accessToken });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(token) },
        data: { revoked: true },
      });
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).send();
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(user);
  })
);

export default router;
