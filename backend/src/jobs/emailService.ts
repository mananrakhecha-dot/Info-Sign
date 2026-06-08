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

  if (process.env.NODE_ENV === "development" && !process.env.SMTP_USER) {
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
  const downloadUrl = `${process.env.FRONTEND_URL}/envelopes/${envelopeId}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
        <tr><td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#16a34a;padding:24px 32px;border-radius:12px 12px 0 0;">
                <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">DocuSign</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 12px;color:#111827;font-size:18px;">Document Signing Complete</h2>
                <p style="margin:0 0 8px;color:#374151;font-size:14px;">Hello ${name},</p>
                <p style="margin:0 0 20px;color:#6b7280;font-size:14px;line-height:1.6;">
                  All parties have signed: <strong>${subject}</strong>
                </p>
                <p style="margin:0 0 24px;color:#6b7280;font-size:13px;">
                  The signed document${certBuffer ? " and Certificate of Completion are" : " is"} attached to this email.
                </p>
                <a href="${downloadUrl}"
                   style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 28px;
                          border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
                  View Envelope
                </a>
              </td>
            </tr>
            <tr>
              <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #f3f4f6;border-radius:0 0 12px 12px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} DocuSign. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  if (process.env.NODE_ENV === "development" && !process.env.SMTP_USER) {
    console.log(
      `[EMAIL] Completion email to ${email} for envelope ${envelopeId}`,
    );
    return;
  }

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
      filename: `certificate-of-completion-${envelopeId}.pdf`,
      content: certBuffer,
      contentType: "application/pdf",
    });
  }

  await getTransporter().sendMail({
    from: `"DocuSign" <noreply@${process.env.APP_BASE_URL?.replace(/https?:\/\//, "") || "digsign.app"}>`,
    to: email,
    subject: `Signing complete: ${subject}`,
    html,
    attachments,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
        <tr><td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="background:#16a34a;padding:28px 32px;text-align:center;">
                <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="background:rgba(255,255,255,0.2);border-radius:10px;padding:8px 12px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">DocuSign</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:36px 40px;">
                <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#111827;">
                  Reset your password
                </h1>
                <p style="margin:0 0 20px 0;font-size:15px;color:#6b7280;line-height:1.6;">
                  Hi ${name},
                </p>
                <p style="margin:0 0 28px 0;font-size:15px;color:#374151;line-height:1.7;">
                  We received a request to reset the password for your DocuSign account associated with
                  <strong>${email}</strong>. Click the button below to set a new password.
                </p>
                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                  <tr>
                    <td style="background:#16a34a;border-radius:8px;">
                      <a href="${resetUrl}"
                         style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                        Reset My Password
                      </a>
                    </td>
                  </tr>
                </table>
                <!-- Fallback URL -->
                <p style="margin:0 0 8px 0;font-size:13px;color:#9ca3af;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 28px 0;font-size:12px;color:#6366f1;word-break:break-all;">
                  ${resetUrl}
                </p>
                <!-- Warning -->
                <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0;font-size:13px;color:#854d0e;line-height:1.6;">
                    ⏱ This link expires in <strong>30 minutes</strong>. It can only be used once.
                    If you did not request a password reset, you can safely ignore this email.
                  </p>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">
                  © ${new Date().getFullYear()} DocuSign Digital Signing Platform. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  if (process.env.NODE_ENV === "development" && !process.env.SMTP_USER) {
    console.log(`[EMAIL] Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  await getTransporter().sendMail({
    from: `"DocuSign" <noreply@${process.env.APP_BASE_URL?.replace(/https?:\/\//, "") || "digsign.app"}>`,
    to: email,
    subject: "Reset your DocuSign password",
    html,
  });
}

export async function sendReminderEmail(
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  subject: string,
  signingToken: string,
): Promise<void> {
  const signingUrl = `${process.env.FRONTEND_URL}/sign/${signingToken}`;
  const html = `
    <h2>Reminder: Document awaiting your signature</h2>
    <p>Hi ${recipientName},</p>
    <p>This is a friendly reminder that <strong>${senderName}</strong> is waiting for your signature on:</p>
    <h3>${subject}</h3>
    <p>Please review and sign the document by clicking the button below:</p>
    <a href="${signingUrl}" style="background:#16a34a;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Review & Sign</a>
    <p>This link expires in 7 days.</p>
  `;

  // Always log the signing URL so it is accessible in dev without SMTP
  console.log(`[EMAIL] Reminder email to ${recipientEmail}: ${signingUrl}`);

  if (process.env.NODE_ENV === "development" && !process.env.SMTP_USER) {
    // No SMTP configured — console log is sufficient for local testing
    return;
  }

  await getTransporter().sendMail({
    from: `"DocuSign via ${senderName}" <noreply@digsign.app>`,
    to: recipientEmail,
    subject: `Reminder: Please sign ${subject}`,
    html,
  });
}
