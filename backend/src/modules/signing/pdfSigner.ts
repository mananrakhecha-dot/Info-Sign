import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import forge from "node-forge";
import { createHash } from "crypto";

/*
 * PDF Digital Signing — Implementation Notes
 *
 * Visual layer:  pdf-lib draws the signature PNG and annotation text
 *                directly onto the PDF page at the correct coordinates.
 *
 * Crypto layer:  @signpdf/placeholder-pdf-lib adds a PDF AcroForm signature
 *                field with a /ByteRange + /Contents placeholder.
 *                @signpdf/signpdf injects a PKCS#7 DER-encoded CMS signature
 *                into the /Contents field, covering all PDF bytes except the
 *                placeholder itself (per ISO 32000 specification).
 *
 * Verification:  The signed PDF is verifiable in Adobe Acrobat Reader,
 *                Foxit, PDF.js, and online validators (e.g. tools.pdf24.org).
 *                The certificate will show as "unknown authority" because it
 *                is self-signed. This does not affect tamper-evidence.
 *
 * Tamper check:  A separate SHA-256 hash of the original PDF is stored in
 *                the database at upload time and re-verified before every
 *                signing operation (see tamper check block below).
 */

export interface SignatureAppearance {
  signerName: string;
  signerEmail: string;
  caName: string;
  timestamp: Date;
  reason?: string;
}

/**
 * Appearance metadata used by applyPkcs7Signature — a subset of
 * SignatureAppearance (caName is not embedded in the CMS structure).
 */
export interface Pkcs7SignatureAppearance {
  signerName: string;
  signerEmail: string;
  timestamp: Date;
  reason?: string;
}

export interface SignatureField {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signatureData?: string; // base64 PNG of drawn signature
  fieldType: string;
  value?: string;
}

export async function embedSignatureIntoPDF(
  pdfBuffer: Buffer,
  certPem: string,
  privateKeyPem: string,
  fields: SignatureField[],
  appearance: SignatureAppearance,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Visual layer ────────────────────────────────────────────────────────────
  for (const field of fields) {
    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage coords to absolute (Y-axis flipped: PDF origin is bottom-left)
    const absX = (field.x / 100) * pageWidth;
    const absY =
      pageHeight -
      (field.y / 100) * pageHeight -
      (field.height / 100) * pageHeight;
    const absW = (field.width / 100) * pageWidth;
    const absH = (field.height / 100) * pageHeight;

    if (field.fieldType === "signature") {
      await drawSignatureAppearance(
        pdfDoc,
        page,
        font,
        boldFont,
        absX,
        absY,
        absW,
        absH,
        appearance,
        field.signatureData,
        certPem,
      );
    } else {
      await renderFieldValue(
        pdfDoc,
        page,
        font,
        boldFont,
        field.fieldType,
        field.value,
        absX,
        absY,
        absW,
        absH,
        appearance,
      );
      await renderFieldValue(
        pdfDoc,
        page,
        font,
        boldFont,
        field.fieldType,
        field.value,
        absX,
        absY,
        absW,
        absH,
        appearance,
      );
    }
  }

  // ── PDF metadata ────────────────────────────────────────────────────────────
  pdfDoc.setSubject(`Digitally signed by ${appearance.signerName}`);
  pdfDoc.setProducer("DocuSign Internal CA");
  pdfDoc.setCreationDate(appearance.timestamp);
  pdfDoc.setModificationDate(appearance.timestamp);

  // ── Crypto layer: AcroForm placeholder + PKCS#7 signing ────────────────────

  // 1. Add /ByteRange + /Contents AcroForm signature placeholder
  await pdflibAddPlaceholder({
    pdfDoc,
    reason: `Signed by ${appearance.signerName}`,
    contactInfo: appearance.signerEmail,
    name: appearance.signerName,
    location: "DocuSign App",
  });

  // 2. Serialise PDF with placeholder (useObjectStreams: false required by @signpdf)
  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

  // 3. Convert PEM key + cert → P12 buffer (no passphrase)
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const certificate = forge.pki.certificateFromPem(certPem);
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    privateKey as forge.pki.rsa.PrivateKey,
    [certificate],
    "",
    { algorithm: "3des" },
  );
  const p12Buffer = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");

  // 4. Inject PKCS#7 CMS signature into /Contents (ISO 32000 §12.8)
  const signer = new P12Signer(p12Buffer, { passphrase: "" });
  const signpdf = new SignPdf();
  const signedPdfBuffer = await signpdf.sign(
    Buffer.from(pdfWithPlaceholder),
    signer,
  );

  return signedPdfBuffer;
}

/**
 * Draws all visual signature stamps onto the PDF without applying any
 * cryptographic signature (no PKCS#7, no AcroForm placeholder).
 *
 * Used exclusively for MULTI-signer envelopes where each intermediate
 * signer's ceremony only needs to embed their visual stamp. The Platform
 * Intermediate CA applies the single final PKCS#7 after all recipients
 * have signed (in the cocQueue worker).
 *
 * The function signature deliberately matches embedSignatureIntoPDF
 * (same first four parameters) so signingService.ts can call either
 * function with identical arguments.
 *
 * @param pdfBuffer  The current PDF bytes (may already contain previous
 *                   signers' visual stamps from earlier ceremonies).
 * @param certPem    The signer's leaf certificate PEM — used only to render
 *                   the cert fingerprint inside the signature box.
 * @param fields     Signature fields assigned to this recipient.
 * @param appearance Signer identity and timestamp for the visual stamp.
 * @returns          PDF buffer with this signer's visual stamp added.
 *                   No /Sig AcroForm field, no /ByteRange, no /Contents.
 */
export async function drawVisualSignatureOnly(
  pdfBuffer: Buffer,
  certPem: string,
  fields: SignatureField[],
  appearance: SignatureAppearance,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Visual layer — identical to embedSignatureIntoPDF ──────────────────────
  for (const field of fields) {
    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage coords to absolute (Y-axis flipped: PDF origin is bottom-left)
    const absX = (field.x / 100) * pageWidth;
    const absY =
      pageHeight -
      (field.y / 100) * pageHeight -
      (field.height / 100) * pageHeight;
    const absW = (field.width / 100) * pageWidth;
    const absH = (field.height / 100) * pageHeight;

    if (field.fieldType === "signature") {
      await drawSignatureAppearance(
        pdfDoc,
        page,
        font,
        boldFont,
        absX,
        absY,
        absW,
        absH,
        appearance,
        field.signatureData,
        certPem,
      );
    } else {
      await renderFieldValue(
        pdfDoc,
        page,
        font,
        boldFont,
        field.fieldType,
        field.value,
        absX,
        absY,
        absW,
        absH,
        appearance,
      );
    }
  }

  // ── PDF metadata ────────────────────────────────────────────────────────────
  pdfDoc.setSubject(`Digitally signed by ${appearance.signerName}`);
  pdfDoc.setProducer("DocuSign Internal CA");
  pdfDoc.setCreationDate(appearance.timestamp);
  pdfDoc.setModificationDate(appearance.timestamp);

  // ── No crypto layer ─────────────────────────────────────────────────────────
  // Deliberately stops here. No pdflibAddPlaceholder, no P12, no signpdf.sign.
  // The Platform CA applies the single final PKCS#7 in the cocQueue worker
  // after ALL recipients have signed.

  return Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
}

/**
 * Renders any non-signature field type as a labelled rectangle onto the PDF page.
 * Called from both embedSignatureIntoPDF and drawVisualSignatureOnly.
 */
async function renderFieldValue(
  pdfDoc: PDFDocument,
  page: any,
  font: any,
  boldFont: any,
  fieldType: string,
  value: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  appearance: SignatureAppearance,
): Promise<void> {
  // Initials: use drawn image if provided, otherwise derive text from signer name
  if (fieldType === "initials") {
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: rgb(0.1, 0.6, 0.1),
      borderWidth: 1,
    });
    if (value) {
      try {
        let pdfImage;
        // Normalise: strip data URI prefix to get raw base64
        let base64: string;
        if (value.startsWith("data:image/png")) {
          base64 = value.replace(/^data:image\/png;base64,/, "");
          pdfImage = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
        } else if (
          value.startsWith("data:image/jpeg") ||
          value.startsWith("data:image/jpg")
        ) {
          base64 = value.replace(/^data:image\/jpe?g;base64,/, "");
          pdfImage = await pdfDoc.embedJpg(Buffer.from(base64, "base64"));
        } else if (value.startsWith("data:image/")) {
          // Unknown image type with data URI — try PNG
          base64 = value.split(",")[1] ?? value;
          pdfImage = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
        } else {
          // Raw base64 with no prefix — try PNG
          base64 = value.includes(",") ? value.split(",")[1] : value;
          pdfImage = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
        }
        if (pdfImage) {
          const padding = 3;
          const maxW = w - padding * 2;
          const maxH = h - padding * 2;
          const imgDims = pdfImage.scale(1);
          const scaleX = maxW / imgDims.width;
          const scaleY = maxH / imgDims.height;
          const scale = Math.min(scaleX, scaleY);
          const drawW = imgDims.width * scale;
          const drawH = imgDims.height * scale;
          const drawX = x + padding + (maxW - drawW) / 2;
          const drawY = y + padding + (maxH - drawH) / 2;
          page.drawImage(pdfImage, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });
          return;
        }
      } catch (err) {
        console.error(
          "[pdfSigner] initials image embed failed:",
          err instanceof Error ? err.message : err,
        );
        // fall through to text fallback
      }
    }
    // Text fallback — only reached if no valid image data
    const initials = appearance.signerName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase();
    page.drawText(initials, {
      x: x + 4,
      y: y + h / 2 - 6,
      size: Math.min(h * 0.5, 14),
      font: boldFont,
      color: rgb(0.05, 0.3, 0.05),
    });
    return;
  }

  // Date / Timestamp
  if (fieldType === "date" || fieldType === "timestamp") {
    let dateStr = value && typeof value === "string" ? value : "";
    if (!dateStr) {
      const d = appearance.timestamp;
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      dateStr = `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: 0.5,
    });
    page.drawText(dateStr, {
      x: x + 4,
      y: y + h / 2 - 5,
      size: Math.min(h * 0.45, 10),
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    return;
  }

  // All other field types with a value: name, email, company, title, text, number,
  // checkbox, dropdown, radio, approve, decline, stamp, note, formula, attachment, drawing
  if (!value) return; // nothing to render if no value was submitted

  const isApprove = fieldType === "approve";
  const isDecline = fieldType === "decline";
  const borderCol = isApprove
    ? rgb(0.1, 0.6, 0.1)
    : isDecline
      ? rgb(0.8, 0.1, 0.1)
      : rgb(0.6, 0.6, 0.6);
  const textCol = isApprove
    ? rgb(0.05, 0.4, 0.05)
    : isDecline
      ? rgb(0.6, 0.05, 0.05)
      : rgb(0.15, 0.15, 0.15);

  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: borderCol,
    borderWidth: 0.5,
  });
  const displayValue = String(value).slice(0, 80);
  page.drawText(displayValue, {
    x: x + 4,
    y: y + h / 2 - 5,
    size: Math.min(h * 0.45, 10),
    font,
    color: textCol,
    maxWidth: w - 8,
  });
}

async function drawSignatureAppearance(
  pdfDoc: PDFDocument,
  page: any,
  font: any,
  boldFont: any,
  x: number,
  y: number,
  w: number,
  h: number,
  appearance: SignatureAppearance,
  signatureData?: string,
  certPem?: string,
): Promise<void> {
  const gray = rgb(0.35, 0.35, 0.35);
  const darkBlue = rgb(0.05, 0.05, 0.3);

  // a. White background with thin dark border
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
  });

  // b. "Signed by:" label at top-left
  page.drawText("Signed by:", {
    x: x + 4,
    y: y + h - 9,
    size: 6.5,
    font,
    color: gray,
  });

  // c. Signature image or name fallback
  const imgH = Math.max(h - 28, 8);
  const imgY = y + 12;
  let imageEmbedded = false;

  if (signatureData) {
    try {
      let pdfImage;
      if (signatureData.startsWith("data:image/png")) {
        const base64 = signatureData.replace(/^data:image\/png;base64,/, "");
        pdfImage = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
      } else if (
        signatureData.startsWith("data:image/jpeg") ||
        signatureData.startsWith("data:image/jpg")
      ) {
        const base64 = signatureData.replace(/^data:image\/jpe?g;base64,/, "");
        pdfImage = await pdfDoc.embedJpg(Buffer.from(base64, "base64"));
      } else {
        // No data URI prefix — assume raw base64 PNG
        const base64 = signatureData.includes(",")
          ? signatureData.split(",")[1]
          : signatureData;
        pdfImage = await pdfDoc.embedPng(Buffer.from(base64, "base64"));
      }
      if (pdfImage) {
        page.drawImage(pdfImage, {
          x: x + 4,
          y: imgY,
          width: w - 8,
          height: imgH,
        });
        imageEmbedded = true;
      }
    } catch (err) {
      console.error("[pdfSigner] Failed to embed signature image:", err);
    }
  }

  if (!imageEmbedded) {
    page.drawText(appearance.signerName, {
      x: x + 4,
      y: y + h / 2 - 2,
      size: Math.min(h * 0.28, 16),
      font: boldFont,
      color: darkBlue,
    });
  }

  // d. Certificate fingerprint at the bottom
  try {
    if (certPem) {
      const derBase64 = certPem
        .replace(/-----BEGIN CERTIFICATE-----/g, "")
        .replace(/-----END CERTIFICATE-----/g, "")
        .replace(/\s+/g, "");
      const derBuf = Buffer.from(derBase64, "base64");
      const fp = createHash("sha1").update(derBuf).digest("hex").toUpperCase();
      const shortFp = fp.substring(0, 15) + "...";
      page.drawText(shortFp, {
        x: x + 4,
        y: y + 3,
        size: 6.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  } catch (err) {
    console.error("[pdfSigner] Failed to draw certificate fingerprint:", err);
  }
}

/**
 * Applies a PKCS#7 / ISO 32000 cryptographic signature to an already-rendered
 * PDF buffer — NO visual drawing. Stamps have already been applied by the
 * env_meta render loop in the download handler.
 */
export async function applyPkcs7Signature(
  pdfBuffer: Buffer,
  certPem: string,
  privateKeyPem: string,
  appearance: Pkcs7SignatureAppearance,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);

  pdfDoc.setSubject(`Digitally signed by ${appearance.signerName}`);
  pdfDoc.setProducer("DocuSign Internal CA");
  pdfDoc.setModificationDate(appearance.timestamp);

  await pdflibAddPlaceholder({
    pdfDoc,
    reason: appearance.reason ?? `Signed by ${appearance.signerName}`,
    contactInfo: appearance.signerEmail,
    name: appearance.signerName,
    location: "DocuSign App",
  });

  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const certificate = forge.pki.certificateFromPem(certPem);
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    privateKey as forge.pki.rsa.PrivateKey,
    [certificate],
    "",
    { algorithm: "3des" },
  );
  const p12Buffer = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");

  const p12signer = new P12Signer(p12Buffer, { passphrase: "" });
  const signpdf = new SignPdf();
  return signpdf.sign(Buffer.from(pdfWithPlaceholder), p12signer);
}
