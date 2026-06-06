import { Queue, Worker } from "bullmq";
import { sendSigningInvitation, sendCompletionEmail } from "./emailService";
import { generateCRL } from "../ca/crl";
import { checkAndRenewCertificates } from "../ca/certIssuer";
import { query } from "../db/pool";
import { getIntermediateCA, getPlatformSigningKeys } from "../ca/caStore";

const connection = {
  host:
    process.env.REDIS_URL?.replace("redis://", "").split(":")[0] || "localhost",
  port: parseInt(process.env.REDIS_URL?.split(":").pop() || "6379"),
};

export const emailQueue = new Queue("email", { connection });
export const crlQueue = new Queue("crl-refresh", { connection });
export const cocQueue = new Queue("certificate-of-completion", { connection });

let workersInitialized = false;

export function initWorkers(): void {
  if (workersInitialized) return;
  workersInitialized = true;

  // Email worker
  new Worker(
    "email",
    async (job) => {
      const { type, data } = job.data;
      if (type === "signing-invitation") {
        await sendSigningInvitation(
          data.recipientEmail,
          data.recipientName,
          data.senderName,
          data.subject,
          data.message,
          data.signingToken,
        );
      }
    },
    { connection },
  );

  // CRL refresh worker
  new Worker(
    "crl-refresh",
    async () => {
      console.log("[CRL] Refreshing CRL...");
      await generateCRL();
      await checkAndRenewCertificates();
      console.log("[CRL] Refresh complete");
    },
    { connection },
  );

  // Certificate of Completion worker
  new Worker(
    "certificate-of-completion",
    async (job) => {
      const { envelopeId } = job.data;

      // ── Step 0: Platform CA PKCS#7 signing for MULTI envelopes ─────────────
      const { rows: modeRows } = await query<any>(
        "SELECT signing_mode FROM envelopes WHERE id=$1",
        [envelopeId],
      );
      const signingMode: string = modeRows[0]?.signing_mode ?? "SINGLE";

      if (signingMode === "MULTI") {
        try {
          const { rows: docRows } = await query<any>(
            `SELECT file_path, id FROM envelope_documents
             WHERE envelope_id=$1
               AND (document_type='original' OR document_type IS NULL)
             ORDER BY upload_time ASC LIMIT 1`,
            [envelopeId],
          );

          if (docRows[0]) {
            const { readFile, encryptFile, computeSHA256 } =
              await import("../modules/storage");
            const { PDFDocument } = await import("pdf-lib");
            const { pdflibAddPlaceholder } =
              await import("@signpdf/placeholder-pdf-lib");
            const { SignPdf } = await import("@signpdf/signpdf");
            const { P12Signer } = await import("@signpdf/signer-p12");
            const forge = (await import("node-forge")).default;
            const { promises: fsPromises } = await import("fs");

            const visualPdfBuffer = readFile(docRows[0].file_path, true);

            // ── FIX 2: Use pre-built Platform Signing Keys from caStore ─────────
            // getPlatformSigningKeys() returns the leaf cert + key pair that was
            // loaded/generated at startup in loader.ts — keyUsage: digitalSignature
            // + nonRepudiation. This avoids the P12 rebuild bug where forge loses
            // internal BigInteger references when packaging intCA objects together.
            const platformKeys = getPlatformSigningKeys();

            if (!platformKeys) {
              throw new Error(
                "[CoC] Platform Signing Keys not loaded — check loader.ts startup",
              );
            }

            const caName =
              platformKeys.cert.subject.getField("CN")?.value ||
              process.env.CA_ORG_NAME ||
              "DocuSign Platform Signer";

            const pdfDoc = await PDFDocument.load(visualPdfBuffer);
            pdfDoc.setProducer("DocuSign Platform Signer");
            pdfDoc.setModificationDate(new Date());
            await pdflibAddPlaceholder({
              pdfDoc,
              reason: "All parties have signed — Platform CA seal",
              contactInfo: `ca@${process.env.APP_BASE_URL?.replace(/https?:\/\//, "") || "digsign.app"}`,
              name: caName,
              location: "DocuSign App",
            });

            const pdfWithPlaceholder = await pdfDoc.save({
              useObjectStreams: false,
            });

            // ── FIX 2: Build P12 from platformKeys (leaf cert + leaf key) ──────
            // Previously used intCA.privateKey + intCA.cert (CA cert) which caused
            // "Failed to find a certificate that matches the private key" because
            // the CA cert has keyUsage: keyCertSign, not digitalSignature.
            // Now we use the dedicated Platform Signing Certificate (leaf cert)
            // which has keyUsage: digitalSignature + nonRepudiation — correct for
            // document signing. The P12 is built fresh from the already-loaded
            // forge objects, so no BigInteger reference loss.
            const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
              platformKeys.privateKey as any,
              [platformKeys.cert],
              "",
              { algorithm: "3des" },
            );
            const p12Buffer = Buffer.from(
              forge.asn1.toDer(p12Asn1).getBytes(),
              "binary",
            );

            const signer = new P12Signer(p12Buffer, { passphrase: "" });
            const signpdf = new SignPdf();
            const caSignedPdf = await signpdf.sign(
              Buffer.from(pdfWithPlaceholder),
              signer,
            );

            await fsPromises.writeFile(
              docRows[0].file_path,
              encryptFile(caSignedPdf),
            );

            const finalHash = computeSHA256(caSignedPdf);
            await query(
              "UPDATE envelope_documents SET sha256_hash=$1 WHERE id=$2",
              [finalHash, docRows[0].id],
            );

            console.log(
              `[CoC] Platform CA PKCS#7 applied for MULTI envelope ${envelopeId}`,
            );
          }
        } catch (err) {
          console.error(
            `[CoC] Platform CA signing failed for ${envelopeId}:`,
            err,
          );
        }
      }

      // ── Step 1: Generate Certificate of Completion ──────────────────────────
      const { generateCertificateOfCompletion } =
        await import("../modules/completion/completionService");
      const certBuffer = await generateCertificateOfCompletion(envelopeId);

      // ── Step 1b: Save certificate to disk + record in DB ────────────────────
      if (certBuffer) {
        try {
          const { saveFile } = await import("../modules/storage");
          const certFileName = `certificate-${envelopeId}.pdf`;
          const certPath = saveFile(
            "documents",
            certFileName,
            certBuffer,
            true,
          );

          const { rows: existingCert } = await query<any>(
            `SELECT id FROM envelope_documents
             WHERE envelope_id=$1 AND document_type='certificate' LIMIT 1`,
            [envelopeId],
          );
          if (existingCert.length === 0) {
            await query(
              `INSERT INTO envelope_documents
               (envelope_id, file_name, file_path, sha256_hash, document_type, page_count)
               VALUES ($1, $2, $3, $4, 'certificate', 1)`,
              [envelopeId, certFileName, certPath, certFileName],
            );
          } else {
            await query(
              `UPDATE envelope_documents
               SET file_path=$1, file_name=$2
               WHERE envelope_id=$3 AND document_type='certificate'`,
              [certPath, certFileName, envelopeId],
            );
          }

          await query(
            `UPDATE envelopes SET completion_cert_path=$1 WHERE id=$2`,
            [certPath, envelopeId],
          );

          console.log(`[CoC] Certificate saved to disk: ${certPath}`);
        } catch (certSaveErr) {
          console.error(
            `[CoC] Failed to save certificate to disk:`,
            certSaveErr,
          );
        }
      }

      // ── Step 2: Load the signed PDF from disk ───────────────────────────────
      const { readFile } = await import("../modules/storage");
      const { rows: docRows } = await query<any>(
        `SELECT file_path, file_name FROM envelope_documents
         WHERE envelope_id=$1 AND (document_type='original' OR document_type IS NULL)
         ORDER BY upload_time ASC LIMIT 1`,
        [envelopeId],
      );
      const signedPdfBuffer: Buffer | null = docRows[0]
        ? readFile(docRows[0].file_path, true)
        : null;
      const signedPdfName: string =
        docRows[0]?.file_name ?? `signed-${envelopeId}.pdf`;

      // ── Step 3: Collect everyone who should receive the email ───────────────
      const { rows: allRecipients } = await query<any>(
        "SELECT user_email, full_name FROM envelope_recipients WHERE envelope_id=$1",
        [envelopeId],
      );
      const { rows: envRows } = await query<any>(
        `SELECT e.subject, u.full_name as sender_name, u.email as sender_email
         FROM envelopes e JOIN users u ON e.sender_id=u.id WHERE e.id=$1`,
        [envelopeId],
      );
      const envelopeSubject: string = envRows[0]?.subject ?? "Document";
      const senderEntry = envRows[0]
        ? {
            user_email: envRows[0].sender_email,
            full_name: envRows[0].sender_name,
          }
        : null;

      const everyone = [...allRecipients];
      if (
        senderEntry &&
        !everyone.some((r: any) => r.user_email === senderEntry.user_email)
      ) {
        everyone.push(senderEntry);
      }

      // ── Step 4: Send completion email to everyone ────────────────────────────
      for (const person of everyone) {
        if (!person.user_email) continue;
        try {
          await sendCompletionEmail(
            person.user_email,
            person.full_name,
            envelopeSubject,
            envelopeId,
            signedPdfBuffer,
            signedPdfName,
            certBuffer ?? undefined,
          );
        } catch (err) {
          console.error(`[CoC] Failed to email ${person.user_email}`, err);
        }
      }

      console.log(`[CoC] Completion emails sent for envelope ${envelopeId}`);
    },
    { connection },
  );

  console.log("[Jobs] Workers initialized");
}

export async function scheduleRecurringJobs(): Promise<void> {
  await crlQueue.add(
    "refresh",
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: "crl-daily-refresh",
    },
  );
  console.log("[Jobs] CRL refresh scheduled (24h)");
}
