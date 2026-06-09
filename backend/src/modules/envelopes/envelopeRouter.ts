import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth";
import { selfSignLimiter } from "../../middleware/rateLimiter";
import {
  createEnvelope,
  updateRecipients,
  saveFields,
  sendEnvelope,
  voidEnvelope,
  listEnvelopes,
  getEnvelopeDetail,
  getEnvelopeOrThrow,
  sendReminder,
  selfSignDocument,
} from "./envelopeService";
import { query } from "../../db/pool";
import { readFile } from "../storage";
import { AppError } from "../../middleware/errorHandler";
import path from "path";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB for the PDF
    fieldSize: 10 * 1024 * 1024, // 10 MB for non-file fields (covers base64 PNG in fields JSON)
  },
  fileFilter: (_, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const envelopes = await listEnvelopes(req.user!.userId);
      res.json(envelopes);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/",
  requireAuth,
  upload.single("document"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "PDF file required" });
        return;
      }
      const { subject, message } = req.body;
      if (!subject) {
        res.status(400).json({ error: "subject required" });
        return;
      }
      const result = await createEnvelope(
        req.user!.userId,
        subject,
        message || "",
        req.file.buffer,
        req.file.originalname,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await getEnvelopeDetail(req.params.id, req.user!.userId);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { subject, message } = req.body;
      if (!subject?.trim()) {
        res.status(400).json({ error: "subject required" });
        return;
      }
      const { rows } = await query(
        "UPDATE envelopes SET subject=$1, message=COALESCE($2, message), updated_at=now() WHERE id=$3 AND sender_id=$4 RETURNING id",
        [subject.trim(), message, id, req.user!.userId],
      );
      if (rows.length === 0) {
        res.status(404).json({ error: "Envelope not found" });
        return;
      }
      res.json({ message: "Envelope updated" });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/recipients",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recipients } = req.body;
      if (!Array.isArray(recipients)) {
        res.status(400).json({ error: "recipients array required" });
        return;
      }
      await updateRecipients(req.params.id, req.user!.userId, recipients);
      res.json({ message: "Recipients updated" });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/fields",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fields } = req.body;
      if (!Array.isArray(fields)) {
        res.status(400).json({ error: "fields array required" });
        return;
      }
      await saveFields(req.params.id, req.user!.userId, fields);
      res.json({ message: "Fields saved" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:id/send",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await sendEnvelope(req.params.id, req.user!.userId);
      res.json({ message: "Envelope sent" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:id/void",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;
      if (!reason) {
        res.status(400).json({ error: "reason required" });
        return;
      }
      await voidEnvelope(req.params.id, req.user!.userId, reason);
      res.json({ message: "Envelope voided" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:id/recipients/:recipientId/remind",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await sendReminder(
        req.params.id,
        req.params.recipientId,
        req.user!.userId,
      );
      res.json({ message: "Reminder sent" });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      // Only allow deleting DRAFT envelopes — sent/completed envelopes must be voided
      const { rows } = await query<any>(
        "SELECT status, sender_id FROM envelopes WHERE id=$1",
        [id],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Envelope not found" });
        return;
      }
      if (rows[0].sender_id !== req.user!.userId) {
        res.status(403).json({ error: "Not authorised" });
        return;
      }
      // Only allow deleting envelopes that have never been sent — once an
      // envelope is SENT or beyond, it is part of a legal signing workflow and
      // must be voided (not permanently deleted) to preserve the audit trail.
      if (rows[0].status !== "DRAFT") {
        res.status(400).json({
          error:
            "Only DRAFT envelopes can be deleted. Use void to cancel a sent envelope.",
        });
        return;
      }
      // Delete cascades to envelope_documents, envelope_recipients, audit_events via FK
      await query("DELETE FROM envelopes WHERE id=$1", [id]);
      res.json({ message: "Envelope deleted" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:id/history",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ownership check — only sender or a recipient of this envelope may read the audit trail
      await getEnvelopeOrThrow(req.params.id, req.user!.userId);
      const { rows } = await query(
        "SELECT * FROM audit_events WHERE envelope_id=$1 ORDER BY created_at DESC",
        [req.params.id],
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:id/status",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ownership check — prevents any authenticated user reading any envelope's status by UUID
      await getEnvelopeOrThrow(req.params.id, req.user!.userId);
      const { rows: env } = await query<any>(
        "SELECT status, completed_at FROM envelopes WHERE id=$1",
        [req.params.id],
      );
      const { rows: recipients } = await query<any>(
        "SELECT user_email, full_name, status, signed_at, viewed_at, auth_required FROM envelope_recipients WHERE envelope_id=$1 ORDER BY order_index",
        [req.params.id],
      );
      res.json({
        status: env[0]?.status,
        completed_at: env[0]?.completed_at,
        recipients,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Download signed PDF
router.get(
  "/:id/download",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ownership check — prevents horizontal privilege escalation where any
      // authenticated user could download any envelope's decrypted PDF by UUID.
      await getEnvelopeOrThrow(req.params.id, req.user!.userId);
      const { rows } = await query<any>(
        `SELECT ed.* FROM envelope_documents ed
       JOIN envelopes e ON ed.envelope_id=e.id
       WHERE ed.envelope_id=$1
         AND (ed.document_type = 'original' OR ed.document_type IS NULL)
       ORDER BY ed.upload_time ASC
       LIMIT 1`,
        [req.params.id],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Document not found" });
        return;
      }
      const buf = readFile(rows[0].file_path, true);
      const safeName = path
        .basename(rows[0].file_name || "document.pdf")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}"`,
      );
      res.send(buf);
    } catch (err) {
      next(err);
    }
  },
);

// Download Certificate of Completion
router.get(
  "/:id/certificate",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ownership check — Certificate of Completion contains signer PII and audit data
      await getEnvelopeOrThrow(req.params.id, req.user!.userId);
      // Try new envelope_documents-based cert first, fall back to legacy completion_cert_path
      const { rows: certDocs } = await query<any>(
        `SELECT file_path FROM envelope_documents WHERE envelope_id=$1 AND document_type='certificate' LIMIT 1`,
        [req.params.id],
      );

      let filePath: string | undefined = certDocs[0]?.file_path;

      if (!filePath) {
        const { rows: env } = await query<any>(
          "SELECT completion_cert_path FROM envelopes WHERE id=$1",
          [req.params.id],
        );
        filePath = env[0]?.completion_cert_path;
      }

      if (!filePath) {
        res.status(404).json({ error: "Certificate not available yet" });
        return;
      }

      const buf = readFile(filePath, true);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="certificate-${req.params.id}.pdf"`,
      );
      res.send(buf);
    } catch (err) {
      next(err);
    }
  },
);

const ALLOWED_FIELD_TYPES = new Set(["signature", "initials", "date", "text"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  "/self-sign",
  requireAuth,
  selfSignLimiter, // per-user limit (10/15min) — must come after requireAuth so userId is available
  upload.single("document"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError("No document uploaded", 400);

      const { subject, fields, recipientEmails } = req.body;

      // Validate and cap fields array
      let parsedFields: any[];
      try {
        parsedFields = JSON.parse(fields || "[]");
      } catch {
        throw new AppError("fields must be valid JSON", 400);
      }
      if (!Array.isArray(parsedFields) || parsedFields.length > 50) {
        throw new AppError(
          "fields must be an array of at most 50 entries",
          400,
        );
      }

      // Parse the separately-sent signatureData map (index -> base64 PNG)
      // This avoids embedding large base64 strings inside the fields JSON
      let parsedSignatureData: Record<string, string> = {};
      try {
        if (req.body.signatureData) {
          parsedSignatureData = JSON.parse(req.body.signatureData);
        }
      } catch {
        /* ignore malformed */
      }

      // Merge signatureData back into each field by index
      parsedFields = parsedFields.map((f: any, idx: number) => ({
        ...f,
        signatureData: parsedSignatureData[String(idx)] ?? f.signatureData,
      }));

      for (const f of parsedFields) {
        if (!ALLOWED_FIELD_TYPES.has(f.fieldType)) {
          throw new AppError(`Invalid fieldType: ${f.fieldType}`, 400);
        }
        if (typeof f.x !== "number" || f.x < 0 || f.x > 100)
          throw new AppError("field x must be 0–100", 400);
        if (typeof f.y !== "number" || f.y < 0 || f.y > 100)
          throw new AppError("field y must be 0–100", 400);
        if (typeof f.width !== "number" || f.width <= 0 || f.width > 100)
          throw new AppError("field width must be 0–100", 400);
        if (typeof f.height !== "number" || f.height <= 0 || f.height > 100)
          throw new AppError("field height must be 0–100", 400);
        if (
          f.signatureData &&
          typeof f.signatureData === "string" &&
          f.signatureData.length > 2_000_000
        ) {
          throw new AppError("signatureData too large (max 2 MB base64)", 400);
        }
        if (f.value && typeof f.value === "string" && f.value.length > 500) {
          throw new AppError("field value too long (max 500 chars)", 400);
        }
      }

      // Validate and cap recipientEmails (max 10 — prevents SMTP relay abuse)
      let parsedEmails: string[];
      try {
        parsedEmails = JSON.parse(recipientEmails || "[]");
      } catch {
        throw new AppError("recipientEmails must be valid JSON", 400);
      }
      if (!Array.isArray(parsedEmails) || parsedEmails.length > 10) {
        throw new AppError(
          "recipientEmails must be an array of at most 10 addresses",
          400,
        );
      }
      for (const e of parsedEmails) {
        if (typeof e !== "string" || !EMAIL_RE.test(e) || e.length > 254) {
          throw new AppError(`Invalid email address: ${e}`, 400);
        }
      }

      // Sanitize originalname before storing in DB and echoing in Content-Disposition
      const safeOriginalName = path
        .basename(req.file.originalname)
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      const result = await selfSignDocument(
        req.user!.userId,
        subject || safeOriginalName,
        req.file.buffer,
        safeOriginalName,
        parsedFields,
        parsedEmails,
        req.ip || "unknown",
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
