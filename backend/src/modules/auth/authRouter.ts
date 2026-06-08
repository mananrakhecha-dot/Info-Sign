import { Router, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import { query } from "../../db/pool";
import {
  registerUser,
  loginUser,
  verifyEmail,
  refreshAccessToken,
  logoutUser,
  acceptEDisclosure,
  requestPasswordReset,
  validateResetToken,
  resetPassword,
  validatePasswordStrength,
} from "./authService";
import { sendOTP, verifyOTP } from "./otpService";
import { requireAuth } from "../../middleware/auth";
import { authLimiter, otpLimiter } from "../../middleware/rateLimiter";
import { sendVerificationEmail } from "../../jobs/emailService";

const router = Router();

router.post(
  "/register",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, full_name, edisclosure } = req.body;
      if (!email || !password || !full_name) {
        res
          .status(400)
          .json({ error: "email, password, and full_name are required" });
        return;
      }
      const user = (await registerUser(
        email,
        password,
        full_name,
        !!edisclosure,
      )) as any;
      const verifyUrl = await sendVerificationEmail(
        user.email,
        user.full_name,
        user._verifyToken,
      );
      const response: Record<string, any> = {
        message:
          "Registration successful. Please check your email to verify your account.",
      };
      if (process.env.NODE_ENV !== "production") {
        response.verifyUrl = verifyUrl;
      }
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/verify-email",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as { token: string };
      if (!token) {
        res.status(400).json({ error: "Token required" });
        return;
      }
      await verifyEmail(token);
      res.redirect(`${process.env.FRONTEND_URL}/login?verified=1`);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/login",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "email and password required" });
        return;
      }
      const result = await loginUser(email, password);
      res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ user: result.user, accessToken: result.accessToken });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ error: "No refresh token" });
        return;
      }
      const result = await refreshAccessToken(refreshToken);
      // Rotate: issue the new refresh token as a replacement httpOnly cookie.
      // The old token was already deleted from the DB inside refreshAccessToken().
      res.cookie("refreshToken", result.newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.json({ accessToken: result.accessToken });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/logout",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) await logoutUser(refreshToken);
      res.clearCookie("refreshToken");
      res.json({ message: "Logged out" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/edisclosure",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await acceptEDisclosure(req.user!.userId);
      res.json({ message: "eDisclosure accepted" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/otp/send",
  requireAuth,
  otpLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phone_number } = req.body;
      if (!phone_number) {
        res.status(400).json({ error: "phone_number required" });
        return;
      }
      await sendOTP(req.user!.userId, phone_number);
      res.json({ message: "OTP sent" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/otp/verify",
  requireAuth,
  otpLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { otp_code } = req.body;
      if (!otp_code) {
        res.status(400).json({ error: "otp_code required" });
        return;
      }
      await verifyOTP(req.user!.userId, otp_code);
      res.json({ message: "Phone verified" });
    } catch (err) {
      next(err);
    }
  },
);

// ── Password reset endpoints ──────────────────────────────────────────────────

router.post(
  "/forgot-password",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "email required" });
        return;
      }
      await requestPasswordReset(email);
      // Always return success — prevents email enumeration
      res.json({
        message:
          "If this email is registered you will receive a reset link shortly",
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/validate-reset-token",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query as { token: string };
      if (!token) {
        res.status(400).json({ error: "token required" });
        return;
      }
      await validateResetToken(token);
      res.json({ valid: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/reset-password",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        res.status(400).json({ error: "token and password required" });
        return;
      }
      await resetPassword(token, password);
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/profile",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { full_name } = req.body;
      if (!full_name?.trim()) {
        res.status(400).json({ error: "full_name required" });
        return;
      }
      await query(
        "UPDATE users SET full_name=$1, updated_at=now() WHERE id=$2",
        [full_name.trim(), req.user!.userId],
      );
      res.json({ message: "Profile updated" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/change-password",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        res
          .status(400)
          .json({ error: "current_password and new_password required" });
        return;
      }
      validatePasswordStrength(new_password);
      const { rows } = await query<any>(
        "SELECT password_hash FROM users WHERE id=$1",
        [req.user!.userId],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const valid = await bcrypt.compare(
        current_password,
        rows[0].password_hash,
      );
      if (!valid) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
      const hash = await bcrypt.hash(new_password, 12);
      await query(
        "UPDATE users SET password_hash=$1, updated_at=now() WHERE id=$2",
        [hash, req.user!.userId],
      );
      await query("DELETE FROM refresh_tokens WHERE user_id=$1", [
        req.user!.userId,
      ]);
      res.json({ message: "Password changed successfully" });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const { rows } = await (
    await import("../../db/pool")
  ).query(
    "SELECT id, email, full_name, role, identity_level, edisclosure_accepted, phone_verified, phone_number FROM users WHERE id=$1",
    [req.user!.userId],
  );
  res.json(rows[0] || null);
});

export default router;
