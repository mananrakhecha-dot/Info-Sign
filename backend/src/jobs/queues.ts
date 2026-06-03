import { Queue, Worker } from "bullmq";
import { sendSigningInvitation, sendCompletionEmail } from "./emailService";
import { generateCRL } from "../ca/crl";
import { checkAndRenewCertificates } from "../ca/certIssuer";
import { query } from "../db/pool";
import { getPlatformSigningKeys } from "../ca/caStore";

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

  // Email worker — handles signing invitations only.
  // Completion emails are handled inside the cocQueue worker (below)
  // so they can carry the certificate PDF as an attachment.
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

  // Certificate of Completion worker — single source of truth for
  // post-completion actions. Generates the CoC PDF, then sends one
  // professional email to every party (sender + all recipients) with
  // both the signed PDF and the certificate attached.
  new Worker(
    "certificate-of-completion",
    async (job) => {
      const { envelopeId } = job.data;

      // ── Step 0: Platform CA PKCS#7 signing for MULTI envelopes ─────────────
      // For MULTI envelopes: all recipients have signed with visual stamps only.
      // The Platform Signing Certificate now applies ONE final PKCS#7 signature
      // covering the complete document with all visual stamps present.
      //
      // The Platform Signing Certificate is a leaf cert issued by the
      // Intermediate CA with keyUsage: digitalSignature + nonRepudiation.
      // This is what Adobe Acrobat requires — CA certs (keyCertSign) are
      // rejected for document signing.
      //
      // For SINGLE envelopes: the recipient's own PKCS#7 was already applied
      // at signing ceremony time — skip this step entirely.
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
            const { SignPdf, Signer } = await import("@signpdf/signpdf");
            const forge = (await import("node-forge")).default;
            const { promises: fsPromises } = await import("fs");

            // a. Decrypt the visual-only PDF from disk
            const visualPdfBuffer = readFile(docRows[0].file_path, true);

            // b. Get Platform Signing Certificate + key
            //    Loaded at server startup via loader.ts → loadCA()
            //    keyUsage: digitalSignature + nonRepudiation ✓
            const platformKeys = getPlatformSigningKeys();
            const signerName =
              platformKeys.cert.subject.getField("CN")?.value ||
              process.env.CA_ORG_NAME ||
              "DocuSign Platform Signer";

            // c. Load PDF and add AcroForm /Sig placeholder
            const pdfDoc = await PDFDocument.load(visualPdfBuffer);
            pdfDoc.setProducer("DocuSign Internal CA");
            pdfDoc.setModificationDate(new Date());
            await pdflibAddPlaceholder({
              pdfDoc,
              reason: "All parties have signed — Platform CA seal",
              contactInfo: `ca@${process.env.APP_BASE_URL?.replace(/https?:\/\//, "") || "digsign.app"}`,
              name: signerName,
              location: "DocuSign App",
            });

            // d. Serialize PDF with placeholder
            const pdfWithPlaceholder = await pdfDoc.save({
              useObjectStreams: false,
            });

            // e. Build a custom Signer that uses forge.pkcs7 directly.
            //
            // We extend the Signer base class from @signpdf/signpdf.
            // SignPdf.sign() handles all ByteRange calculation and /Contents
            // injection. It calls our signer.sign(bytesToSign) where bytesToSign
            // is the concatenated byte ranges (all PDF bytes except /Contents).
            // We build the CMS SignedData from those bytes and return raw DER.
            //
            // The Platform Signing Certificate has the correct keyUsage flags
            // (digitalSignature + nonRepudiation) so Adobe accepts it.
            const platformKeysRef = platformKeys;
            const caSigner = new (class extends Signer {
              async sign(
                pdfBuffer: Buffer,
                signingTime?: Date,
              ): Promise<Buffer> {
                const p7 = forge.pkcs7.createSignedData();
                p7.content = forge.util.createBuffer(
                  pdfBuffer.toString("binary"),
                );
                p7.addCertificate(platformKeysRef.cert);
                p7.addSigner({
                  key: platformKeysRef.privateKey,
                  certificate: platformKeysRef.cert,
                  digestAlgorithm: forge.pki.oids.sha256,
                  authenticatedAttributes: [
                    {
                      type: forge.pki.oids.contentType,
                      value: forge.pki.oids.data,
                    },
                    {
                      type: forge.pki.oids.signingTime,
                      value: (signingTime ?? new Date()) as any,
                    },
                    {
                      type: forge.pki.oids.messageDigest,
                    },
                  ],
                });
                p7.sign({ detached: true });
                return Buffer.from(
                  forge.asn1.toDer(p7.toAsn1()).getBytes(),
                  "binary",
                );
              }
            })();

            // f. Inject PKCS#7 into the PDF via SignPdf
            const signpdf = new SignPdf();
            const caSignedPdf = await signpdf.sign(
              Buffer.from(pdfWithPlaceholder),
              caSigner,
            );

            // g. Write signed PDF back to disk (encrypted)
            await fsPromises.writeFile(
              docRows[0].file_path,
              encryptFile(caSignedPdf),
            );

            // h. Update sha256_hash to reflect the final signed PDF
            const finalHash = computeSHA256(caSignedPdf);
            await query(
              "UPDATE envelope_documents SET sha256_hash=$1 WHERE id=$2",
              [finalHash, docRows[0].id],
            );

            console.log(
              `[CoC] Platform signing certificate PKCS#7 applied for MULTI envelope ${envelopeId}`,
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

      // ── Step 4: Send one email per person with both attachments ─────────────
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
