import nodemailer from "nodemailer";

// Derive the attachment type directly from nodemailer's own SendMailOptions
// so we never depend on an internal namespace path.
type MailAttachment = NonNullable<
  nodemailer.SendMailOptions["attachments"]
>[number];

let transporter: nodemailer.Transporter;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "localhost",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });
  }
  return transporter;
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
): Promise<string> {
  const verifyUrl = `${process.env.APP_BASE_URL}/api/auth/verify-email?token=${token}`;
  const html = `
    <h2>Welcome to DocuSign, ${name}!</h2>
    <p>Please verify your email address by clicking the button below:</p>
    <a href="${verifyUrl}" style="background:#2563eb;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Verify Email</a>
    <p>This link expires in 24 hours.</p>
  `;

  if (process.env.NODE_ENV === "development") {
    console.log(`[EMAIL] Verification email to ${email}: ${verifyUrl}`);
    return verifyUrl;
  }

  await getTransporter().sendMail({
    from: `"DocuSign" <noreply@${process.env.APP_BASE_URL?.replace(/https?:\/\//, "") || "digsign.app"}>`,
    to: email,
    subject: "Verify your email address",
    html,
  });
  return verifyUrl;
}

export async function sendSigningInvitation(
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  subject: string,
  message: string,
  signingToken: string,
): Promise<void> {
  const signingUrl = `${process.env.FRONTEND_URL}/sign/${signingToken}`;
  const html = `
    <h2>You have a document to sign</h2>
    <p><strong>${senderName}</strong> has sent you a document for your signature.</p>
    <h3>${subject}</h3>
    ${message ? `<p>${message}</p>` : ""}
    <p>Click the button below to review and sign the document:</p>
    <a href="${signingUrl}" style="background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Review & Sign</a>
    <p>This link expires in 7 days.</p>
  `;

  // Always log the signing URL so it is accessible in dev without SMTP
  console.log(`[EMAIL] Signing invitation to ${recipientEmail}: ${signingUrl}`);

  if (process.env.NODE_ENV === "development" && !process.env.SMTP_USER) {
    // No SMTP configured — console log is sufficient for local testing
    return;
  }

  await getTransporter().sendMail({
    from: `"DocuSign via ${senderName}" <noreply@digsign.app>`,
    to: recipientEmail,
    subject: `Please sign: ${subject}`,
    html,
  });
}

export async function sendCompletionEmail(
  email: string,
  name: string,
  subject: string,
  envelopeId: string,
  signedPdfBuffer: Buffer | null,
  signedPdfName: string,
  certBuffer?: Buffer,
): Promise<void> {
  const appName = process.env.APP_NAME || "DocuSign";
  const fromDomain =
    process.env.APP_BASE_URL?.replace(/https?:\/\//, "") || "digsign.app";
  const envelopeUrl = `${process.env.FRONTEND_URL}/envelopes/${envelopeId}`;
  const completedDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Professional HTML email (table-based, email-client safe) ──────────────
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Signing Complete</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:#1B3A6B;padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;
                               letter-spacing:0.5px;">${appName}</p>
                    <p style="margin:6px 0 0;font-size:13px;color:#a8c4e0;">
                      Secure Digital Signing Platform
                    </p>
                  </td>
                  <td align="right">
                    <!-- Green verified badge -->
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#16a34a;border-radius:50%;
                                   width:48px;height:48px;text-align:center;
                                   vertical-align:middle;">
                          <span style="font-size:24px;color:#ffffff;line-height:48px;">&#10003;</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Status banner -->
          <tr>
            <td style="background:#f0fdf4;border-bottom:2px solid #bbf7d0;
                       padding:16px 40px;">
              <p style="margin:0;font-size:15px;font-weight:bold;color:#15803d;">
                &#10003;&nbsp;&nbsp;All parties have completed signing
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">

              <p style="margin:0 0 8px;font-size:15px;color:#374151;">
                Dear <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                We are pleased to inform you that all required parties have successfully
                signed the document listed below. This email serves as your official
                notification of completion.
              </p>

              <!-- Document details box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#f8fafc;border:1px solid #e2e8f0;
                            border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:11px;font-weight:bold;
                               color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
                      Document Details
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;font-size:13px;
                                   color:#6b7280;width:140px;">Document</td>
                        <td style="padding:5px 0;font-size:13px;
                                   color:#111827;font-weight:bold;">${subject}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6b7280;">
                          Envelope ID</td>
                        <td style="padding:5px 0;font-size:12px;
                                   color:#4b5563;font-family:monospace;">${envelopeId}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6b7280;">
                          Completed On</td>
                        <td style="padding:5px 0;font-size:13px;color:#111827;">
                          ${completedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6b7280;">
                          Status</td>
                        <td style="padding:5px 0;">
                          <span style="display:inline-block;background:#dcfce7;
                                       color:#15803d;font-size:12px;font-weight:bold;
                                       padding:2px 10px;border-radius:12px;">
                            COMPLETED
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Attachments notice -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#eff6ff;border:1px solid #bfdbfe;
                            border-radius:6px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 24px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:bold;
                               color:#1d4ed8;">
                      &#128206;&nbsp; Attached Documents
                    </p>
                    ${
                      signedPdfBuffer
                        ? `
                    <p style="margin:0 0 6px;font-size:13px;color:#1e40af;">
                      &#10003;&nbsp; <strong>${signedPdfName}</strong>
                      &nbsp;<span style="color:#6b7280;font-size:12px;">
                        — Signed document with embedded digital signatures
                      </span>
                    </p>`
                        : ""
                    }
                    ${
                      certBuffer
                        ? `
                    <p style="margin:0;font-size:13px;color:#1e40af;">
                      &#10003;&nbsp; <strong>certificate-${envelopeId}.pdf</strong>
                      &nbsp;<span style="color:#6b7280;font-size:12px;">
                        — Certificate of Completion with full audit trail
                      </span>
                    </p>`
                        : ""
                    }
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#1B3A6B;border-radius:6px;">
                    <a href="${envelopeUrl}"
                       style="display:inline-block;padding:13px 28px;
                              font-size:14px;font-weight:bold;color:#ffffff;
                              text-decoration:none;">
                      View Envelope Details &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                The signed document contains cryptographically embedded digital
                signatures that are independently verifiable in any PDF reader
                (e.g. Adobe Acrobat). The Certificate of Completion provides a
                full audit trail including signer identities, timestamps, IP
                addresses, and the SHA-256 document integrity hash.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e5e7eb;
                       padding:24px 40px;">
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">
                This is an automated notification from <strong>${appName}</strong>.
                Please do not reply to this email.
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                The documents attached to this email are legally binding.
                Retain them for your records.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  // Build attachments array — only include what was actually generated
  const attachments: MailAttachment[] = [];
  if (signedPdfBuffer) {
    attachments.push({
      filename: signedPdfName,
      content: signedPdfBuffer,
      contentType: "application/pdf",
    });
  }
  if (certBuffer) {
    attachments.push({
      filename: `certificate-${envelopeId}.pdf`,
      content: certBuffer,
      contentType: "application/pdf",
    });
  }

  // In development: log what would have been sent (don't skip — so attachment
  // logic is exercised) but skip the actual SMTP call if no SMTP configured
  if (process.env.NODE_ENV === "development" && !process.env.SMTP_USER) {
    console.log(
      `[EMAIL] Completion email → ${email} | attachments: ${attachments.map((a) => a.filename ?? "unnamed").join(", ") || "none"}`,
    );
    return;
  }

  await getTransporter().sendMail({
    from: `"${appName}" <noreply@${fromDomain}>`,
    to: email,
    subject: `Signing complete: ${subject}`,
    html,
    attachments,
  });
}
