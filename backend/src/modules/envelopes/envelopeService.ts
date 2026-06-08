import { PDFDocument } from "pdf-lib";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import { query, withTransaction } from "../../db/pool";
import { saveFile, computeSHA256, encryptFile } from "../storage";
import { emailQueue } from "../../jobs/queues";
import { AppError } from "../../middleware/errorHandler";
import { logEvent } from "../audit/auditService";
import { decryptPrivateKey } from "../../ca/certIssuer";
import { getIntermediateCA } from "../../ca/caStore";
import { embedSignatureIntoPDF } from "../signing/pdfSigner";
import { promises as fsPromises } from "fs";

export async function createEnvelope(
  senderId: string,
  subject: string,
  message: string,
  fileBuffer: Buffer,
  originalName: string,
): Promise<{ envelopeId: string; documentId: string; pageCount: number }> {
  // Compute hash of original PDF
  const sha256 = computeSHA256(fileBuffer);

  // Get page count from PDF
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const pageCount = pdfDoc.getPageCount();

  // Save encrypted
  const filename = `${crypto.randomUUID()}.pdf.enc`;
  const filePath = saveFile("documents", filename, fileBuffer, true);

  // Create envelope
  const envResult = await query<{ id: string }>(
    `INSERT INTO envelopes (sender_id, subject, message) VALUES ($1, $2, $3) RETURNING id`,
    [senderId, subject, message],
  );
  const envelopeId = envResult.rows[0].id;

  // Create document record.
  // original_sha256_hash is set once at upload and never overwritten — it
  // always holds the hash of the original unsigned PDF so the tamper check
  // in signingService works correctly across multiple signers.
  const docResult = await query<{ id: string }>(
    `INSERT INTO envelope_documents (envelope_id, file_name, file_path, sha256_hash, original_sha256_hash, page_count)
     VALUES ($1, $2, $3, $4, $4, $5) RETURNING id`,
    [envelopeId, originalName, filePath, sha256, pageCount],
  );

  await logEvent({
    envelopeId,
    eventType: "envelope_created",
    metadata: { subject, senderId },
  });

  return { envelopeId, documentId: docResult.rows[0].id, pageCount };
}

export async function addRecipient(
  envelopeId: string,
  userEmail: string,
  fullName: string,
  orderIndex: number,
  authRequired: "SES" | "AES",
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO envelope_recipients (envelope_id, user_email, full_name, order_index, auth_required)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [envelopeId, userEmail.toLowerCase(), fullName, orderIndex, authRequired],
  );
  return rows[0].id;
}

export async function updateRecipients(
  envelopeId: string,
  senderId: string,
  recipients: Array<{
    email: string;
    full_name: string;
    order_index: number;
    auth_required: "SES" | "AES";
  }>,
): Promise<void> {
  const env = await getEnvelopeOrThrow(envelopeId, senderId);
  if (env.status !== "DRAFT")
    throw new AppError("Can only edit DRAFT envelopes", 400);

  await query("DELETE FROM envelope_recipients WHERE envelope_id=$1", [
    envelopeId,
  ]);
  for (const r of recipients) {
    await addRecipient(
      envelopeId,
      r.email,
      r.full_name,
      r.order_index,
      r.auth_required,
    );
  }
}

export async function saveFields(
  envelopeId: string,
  senderId: string,
  fields: Array<{
    envelope_document_id: string;
    recipient_id: string;
    page_number: number;
    x: number;
    y: number;
    width: number;
    height: number;
    field_type: string;
    preview_data?: string | null;
  }>,
): Promise<void> {
  const env = await getEnvelopeOrThrow(envelopeId, senderId);
  if (env.status !== "DRAFT")
    throw new AppError("Can only edit DRAFT envelopes", 400);

  // Remove old fields for this envelope's documents
  const { rows: docs } = await query<{ id: string }>(
    "SELECT id FROM envelope_documents WHERE envelope_id=$1",
    [envelopeId],
  );
  for (const doc of docs) {
    await query("DELETE FROM signature_fields WHERE envelope_document_id=$1", [
      doc.id,
    ]);
  }

  for (const field of fields) {
    await query(
      `INSERT INTO signature_fields (envelope_document_id, recipient_id, page_number, x, y, width, height, field_type, preview_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        field.envelope_document_id,
        field.recipient_id,
        field.page_number,
        field.x,
        field.y,
        field.width,
        field.height,
        field.field_type,
        field.preview_data ?? null,
      ],
    );
  }
}

export async function sendEnvelope(
  envelopeId: string,
  senderId: string,
): Promise<void> {
  const env = await getEnvelopeOrThrow(envelopeId, senderId);
  if (env.status !== "DRAFT")
    throw new AppError("Envelope is not in DRAFT status", 400);

  // Validate all recipients have fields
  const { rows: recipients } = await query<any>(
    "SELECT * FROM envelope_recipients WHERE envelope_id=$1",
    [envelopeId],
  );
  if (recipients.length === 0) throw new AppError("No recipients added", 400);

  const { rows: sender } = await query<{ full_name: string; email: string }>(
    "SELECT full_name, email FROM users WHERE id=$1",
    [senderId],
  );

  for (const recipient of recipients) {
    const { rows: fields } = await query(
      `SELECT sf.id FROM signature_fields sf
       JOIN envelope_documents ed ON sf.envelope_document_id=ed.id
       WHERE ed.envelope_id=$1 AND sf.recipient_id=$2`,
      [envelopeId, recipient.id],
    );
    if (fields.length === 0) {
      throw new AppError(
        `Recipient ${recipient.user_email} has no signature fields assigned`,
        400,
      );
    }

    // Generate signing token
    const signingToken = jwt.sign(
      { envelopeId, recipientId: recipient.id, email: recipient.user_email },
      process.env.SIGNING_LINK_SECRET!,
      { expiresIn: "7d" },
    );

    await query("UPDATE envelope_recipients SET signing_token=$1 WHERE id=$2", [
      signingToken,
      recipient.id,
    ]);

    // Queue invitation email
    await emailQueue.add("signing-invitation", {
      type: "signing-invitation",
      data: {
        recipientEmail: recipient.user_email,
        recipientName: recipient.full_name,
        senderName: sender[0]?.full_name || "DocuSign User",
        subject: env.subject,
        message: env.message || "",
        signingToken,
      },
    });

    await logEvent({
      envelopeId,
      recipientEmail: recipient.user_email,
      eventType: "envelope_sent",
      metadata: { recipientName: recipient.full_name },
    });

    // Schedule 24-hour delayed reminder for this recipient.
    // jobId deduplicates: if sendEnvelope() is retried (e.g. after a queue
    // crash), BullMQ will discard the duplicate instead of firing two reminders.
    await emailQueue.add(
      "reminder",
      {
        type: "reminder",
        data: {
          envelopeId,
          recipientId: recipient.id,
          recipientEmail: recipient.user_email,
          recipientName: recipient.full_name,
          senderName: sender[0]?.full_name || "DocuSign User",
          subject: env.subject,
          signingToken,
        },
      },
      {
        delay: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        jobId: `auto-reminder-${envelopeId}-${recipient.id}`,
      },
    );
  }

  // Determine signing mode based on recipient count — set once, never changed.
  // SINGLE (1 recipient):  recipient's own PKCS#7 applied at signing ceremony.
  // MULTI  (2+ recipients): visual stamps only at each ceremony; Platform CA
  //                         applies one final PKCS#7 after all have signed.
  const signingMode = recipients.length === 1 ? "SINGLE" : "MULTI";
  await query(
    `UPDATE envelopes SET status='SENT', signing_mode=$1, updated_at=now() WHERE id=$2`,
    [signingMode, envelopeId],
  );
}

export async function voidEnvelope(
  envelopeId: string,
  senderId: string,
  reason: string,
): Promise<void> {
  const env = await getEnvelopeOrThrow(envelopeId, senderId);
  // These are all terminal states — voiding any of them would destroy
  // legally-significant or forensically-important records.
  // COMPLETED: legally finalised, relied upon by all signatories.
  // VOIDED: already voided — idempotent guard.
  // DECLINED: records a recipient's explicit refusal — must not be overwritten.
  // TAMPERED: forensic evidence of document tampering — must be preserved.
  const TERMINAL_STATUSES = ["COMPLETED", "VOIDED", "DECLINED", "TAMPERED"];
  if (TERMINAL_STATUSES.includes(env.status)) {
    throw new AppError(
      `Cannot void an envelope with status '${env.status}'`,
      400,
    );
  }
  await query(
    `UPDATE envelopes SET status='VOIDED', void_reason=$1, updated_at=now() WHERE id=$2`,
    [reason, envelopeId],
  );
  await logEvent({
    envelopeId,
    eventType: "envelope_voided",
    metadata: { reason },
  });
}

export async function getEnvelopeOrThrow(
  envelopeId: string,
  userId: string,
): Promise<any> {
  const { rows } = await query<any>(
    `SELECT e.* FROM envelopes e
     LEFT JOIN envelope_recipients er ON e.id=er.envelope_id AND er.user_email=(SELECT email FROM users WHERE id=$2)
     WHERE e.id=$1 AND (e.sender_id=$2 OR er.envelope_id IS NOT NULL)`,
    [envelopeId, userId],
  );
  if (!rows[0]) throw new AppError("Envelope not found or access denied", 404);
  return rows[0];
}

export async function listEnvelopes(userId: string): Promise<any[]> {
  const { rows } = await query<any>(
    `SELECT DISTINCT e.*, u.full_name as sender_name,
       (SELECT count(*) FROM envelope_recipients WHERE envelope_id=e.id) as recipient_count,
       (SELECT count(*) FROM envelope_recipients WHERE envelope_id=e.id AND status='SIGNED') as signed_count
     FROM envelopes e
     JOIN users u ON e.sender_id=u.id
     LEFT JOIN envelope_recipients er ON e.id=er.envelope_id AND er.user_email=(SELECT email FROM users WHERE id=$1)
     WHERE e.sender_id=$1 OR er.envelope_id IS NOT NULL
     ORDER BY e.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function getEnvelopeDetail(
  envelopeId: string,
  userId: string,
): Promise<any> {
  const env = await getEnvelopeOrThrow(envelopeId, userId);
  const { rows: documents } = await query<any>(
    "SELECT * FROM envelope_documents WHERE envelope_id=$1",
    [envelopeId],
  );
  const { rows: recipients } = await query<any>(
    // Explicitly exclude signing_token — it is a per-recipient secret that
    // only belongs in the signing link. Returning it in the detail response
    // would let any authenticated user (including other recipients) steal
    // another signer's signing link and sign on their behalf.
    `SELECT id, envelope_id, user_email, full_name, order_index, status,
       auth_required, signed_at, viewed_at, signing_ip, decline_reason,
       last_reminded_at, reminder_count
     FROM envelope_recipients WHERE envelope_id=$1 ORDER BY order_index`,
    [envelopeId],
  );
  const { rows: sender } = await query<any>(
    "SELECT full_name, email FROM users WHERE id=$1",
    [env.sender_id],
  );

  return { ...env, documents, recipients, sender: sender[0] };
}

export async function sendReminder(
  envelopeId: string,
  recipientId: string,
  requesterId: string,
): Promise<void> {
  // Single query: fetch sender_id, status, and subject together to avoid a
  // TOCTOU race between the first and second envelope reads.
  const { rows: envRows } = await query<any>(
    "SELECT sender_id, status, subject FROM envelopes WHERE id=$1",
    [envelopeId],
  );
  if (!envRows[0]) throw new AppError("Envelope not found", 404);
  const envData = envRows[0];

  // Block reminders when the envelope is in a terminal or inactive state.
  const inactiveStatuses = ["VOIDED", "DECLINED", "COMPLETED", "TAMPERED"];
  if (inactiveStatuses.includes(envData.status)) {
    throw new AppError(
      `Cannot send reminder — envelope is ${envData.status}`,
      400,
    );
  }

  // Check if requester is sender or admin — query role from DB, not JWT claim,
  // so a role downgrade takes effect immediately without waiting for token expiry.
  const { rows: requester } = await query<{ role: string }>(
    "SELECT role FROM users WHERE id=$1",
    [requesterId],
  );
  const isAdmin = requester[0]?.role === "admin";
  const isSender = envData.sender_id === requesterId;
  if (!isSender && !isAdmin) {
    throw new AppError("Only sender or admin can send reminders", 403);
  }

  // Get recipient info (include cooldown fields to enforce send rate)
  const { rows: recipientRows } = await query<any>(
    `SELECT id, user_email, full_name, status, signing_token, last_reminded_at, reminder_count
     FROM envelope_recipients WHERE id=$1 AND envelope_id=$2`,
    [recipientId, envelopeId],
  );
  if (!recipientRows[0]) throw new AppError("Recipient not found", 404);

  const recipient = recipientRows[0];

  // Only PENDING recipients need reminders
  if (recipient.status !== "PENDING") {
    throw new AppError(
      "Reminder can only be sent to PENDING recipients",
      400,
    );
  }

  // Enforce a 1-hour cooldown between manual reminders to prevent inbox flooding.
  // Admins bypass the cooldown so they can force-send in support scenarios.
  const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
  if (!isAdmin && recipient.last_reminded_at) {
    const msSinceLast = Date.now() - new Date(recipient.last_reminded_at).getTime();
    if (msSinceLast < COOLDOWN_MS) {
      const minutesLeft = Math.ceil((COOLDOWN_MS - msSinceLast) / 60_000);
      throw new AppError(
        `Reminder already sent recently. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        429,
      );
    }
  }

  // Get sender info
  const { rows: senderRows } = await query<{ full_name: string }>(
    "SELECT full_name FROM users WHERE id=$1",
    [envData.sender_id],
  );
  const senderName = senderRows[0]?.full_name || "DocuSign User";

  // Queue reminder email (no delay — fires immediately)
  await emailQueue.add(
    "reminder",
    {
      type: "reminder",
      data: {
        envelopeId,
        recipientId,
        recipientEmail: recipient.user_email,
        recipientName: recipient.full_name,
        senderName,
        subject: envData.subject,
        signingToken: recipient.signing_token,
      },
    },
  );

  // Update last_reminded_at and increment reminder_count
  await query(
    `UPDATE envelope_recipients
     SET last_reminded_at=now(), reminder_count=(reminder_count + 1)
     WHERE id=$1`,
    [recipientId],
  );

  // Log reminder event
  await logEvent({
    envelopeId,
    recipientEmail: recipient.user_email,
    eventType: "envelope_reminder_sent",
    metadata: { sentBy: requesterId },
  });
}

export async function selfSignDocument(
  senderId: string,
  subject: string,
  pdfBuffer: Buffer,
  originalName: string,
  fields: Array<{
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    fieldType: "signature" | "date" | "text";
    signatureData?: string;
    value?: string;
  }>,
  recipientEmails: string[],
  signingIp: string,
): Promise<{ envelopeId: string }> {
  // 1. Load the user — narrow SELECT to avoid exposing password_hash in memory
  const { rows: userRows } = await query<any>(
    "SELECT id, email, full_name, identity_level, cert_pem, encrypted_private_key FROM users WHERE id=$1",
    [senderId],
  );
  const user = userRows[0];

  // 2. Guard: require SES or AES identity level + a valid certificate.
  // Checking identity_level explicitly prevents edge cases where cert_pem could
  // be set for a NONE-level user (e.g. direct DB manipulation by an admin).
  if (!user || !user.cert_pem || !["SES", "AES"].includes(user.identity_level)) {
    throw new AppError("Identity verification required to sign documents", 403);
  }

  // 3. Decrypt private key
  const privateKeyPem = decryptPrivateKey(user.encrypted_private_key);

  // 4. Compute original hash
  const originalHash = computeSHA256(pdfBuffer);

  // 5. Get page count via pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();

  // 6. Get intermediate CA for appearance — guard against null (startup race)
  const intCA = getIntermediateCA();
  if (!intCA) {
    throw new AppError("CA not initialised — please retry in a moment", 503);
  }
  const appearance = {
    signerName: user.full_name,
    signerEmail: user.email,
    caName:
      (intCA.cert.subject.getField("CN") as any)?.value ||
      (process.env.CA_ORG_NAME || "MyOrg Digital Signing CA"),
    timestamp: new Date(),
    reason: "I approve this document",
  };

  // 7. Map fields to embed format
  const fieldsForEmbed = fields.map((f) => ({
    pageNumber: f.pageNumber,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    fieldType: f.fieldType,
    signatureData: f.signatureData,
    value:
      f.value ??
      (f.fieldType === "date" ? new Date().toLocaleDateString() : undefined),
  }));

  // 8. *** PKCS#7 signing happens BEFORE any DB writes ***
  // This ensures we never commit status='COMPLETED' to the DB if signing fails.
  // If embedSignatureIntoPDF throws, no DB record is created and the caller
  // receives a clean error with no orphaned state.
  const signedPdfBuffer = await embedSignatureIntoPDF(
    pdfBuffer,
    user.cert_pem,
    privateKeyPem,
    fieldsForEmbed,
    appearance,
  );
  const newHash = computeSHA256(signedPdfBuffer);

  // 9. Save the signed+encrypted PDF to disk
  const filename = `self-sign-${Date.now()}.pdf.enc`;
  const filePath = saveFile("documents", filename, pdfBuffer, true);
  // Immediately overwrite with the signed version
  await fsPromises.writeFile(filePath, encryptFile(signedPdfBuffer));

  // 10. Database transaction: create envelope, document, and recipient records
  // Only runs after signing succeeds — prevents COMPLETED envelopes with unsigned PDFs.
  let envelopeId: string;

  ({ envelopeId } = await withTransaction(async (txq) => {
    // a. Insert envelope (already completed)
    const envResult = await txq<{ id: string }>(
      `INSERT INTO envelopes (sender_id, subject, status, signing_mode, completed_at, created_at, updated_at)
       VALUES ($1, $2, 'COMPLETED', 'SINGLE', now(), now(), now()) RETURNING id`,
      [senderId, subject],
    );
    const envelopeId = envResult.rows[0].id;

    // b. Insert document record — sha256_hash is the post-sign hash (the original
    //    hash is preserved in original_sha256_hash for audit trail purposes).
    await txq(
      `INSERT INTO envelope_documents (id, envelope_id, file_name, file_path, sha256_hash, original_sha256_hash, page_count, document_type, upload_time)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'original', now())`,
      [envelopeId, originalName, filePath, newHash, originalHash, pageCount],
    );

    // c. Insert recipient record (sender is the sole signer)
    await txq(
      `INSERT INTO envelope_recipients (id, envelope_id, user_email, full_name, order_index, status, auth_required, signed_at, signing_ip)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, 'SIGNED', 'SES', now(), $4)`,
      [envelopeId, user.email, user.full_name, signingIp],
    );

    return { envelopeId };
  }));

  // 11. Log audit events (best-effort — outside transaction)
  await logEvent({
    envelopeId,
    recipientEmail: user.email,
    eventType: "pre_sign_hash",
    metadata: { hash: originalHash },
  });
  await logEvent({
    envelopeId,
    recipientEmail: user.email,
    eventType: "signed",
    ipAddress: signingIp,
    metadata: { signerName: user.full_name, docHashAfter: newHash },
  });
  await logEvent({
    envelopeId,
    recipientEmail: user.email,
    eventType: "identity_verified",
    metadata: { identityLevel: user.identity_level },
  });
  await logEvent({
    envelopeId,
    eventType: "envelope_completed",
  });

  // 12. Generate Certificate of Completion
  const { generateCertificateOfCompletion } = await import(
    "../completion/completionService"
  );
  const cocBuffer = await generateCertificateOfCompletion(envelopeId);

  // 13. Save CoC to disk
  const certFilename = `cert-${envelopeId}.pdf.enc`;
  const certPath = saveFile("certificates", certFilename, cocBuffer, true);

  // 14. Insert CoC document record and update envelope
  await query(
    `INSERT INTO envelope_documents (id, envelope_id, file_name, file_path, sha256_hash, original_sha256_hash, page_count, document_type, upload_time)
     VALUES (gen_random_uuid(), $1, 'Certificate of Completion', $2, $3, $3, 1, 'certificate', now())`,
    [envelopeId, certPath, computeSHA256(cocBuffer)],
  );
  await query("UPDATE envelopes SET completion_cert_path=$1 WHERE id=$2", [
    certPath,
    envelopeId,
  ]);

  // 15. Send completion emails (capped to 10 addresses, validated in router)
  // recipientEmails contains only addresses (no names) — use the local-part
  // of the address as a display name fallback (e.g. "john.doe" from "john.doe@example.com")
  // rather than showing the full raw address as the greeting.
  const { sendCompletionEmail } = await import("../../jobs/emailService");
  await Promise.all(
    recipientEmails.map((email) => {
      const displayName = email.split("@")[0] || email;
      return sendCompletionEmail(
        email,
        displayName,
        subject,
        envelopeId,
        signedPdfBuffer,
        originalName,
        cocBuffer,
      );
    }),
  );

  // 16. Return envelope ID
  return { envelopeId };
}
