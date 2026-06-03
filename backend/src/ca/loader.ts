import forge from "node-forge";
import {
  loadEncryptedPem,
  loadPlainPem,
  saveEncryptedPem,
  savePlainPem,
  setIntermediateCA,
  setPlatformSigningKeys,
  caExists,
  platformSigningKeysExist,
} from "./caStore";
import { bootstrapCA } from "./bootstrap";

export async function loadCA(): Promise<void> {
  if (!caExists()) {
    console.log("[CA] No CA found, bootstrapping...");
    await bootstrapCA();
  }

  // ── Load Intermediate CA ──────────────────────────────────────────────────
  const intKeyPem = loadEncryptedPem(
    "intermediate-ca.enc",
    process.env.INTERMEDIATE_CA_PASSPHRASE!,
  );
  const intCertPem = loadPlainPem("intermediate-ca-cert.pem");

  if (!intKeyPem || !intCertPem) {
    throw new Error("[CA] Failed to load Intermediate CA files");
  }

  const intCert = forge.pki.certificateFromPem(intCertPem);
  const intPrivateKey = forge.pki.privateKeyFromPem(
    intKeyPem,
  ) as forge.pki.rsa.PrivateKey;

  setIntermediateCA({
    cert: intCert,
    privateKey: intPrivateKey,
    certPem: intCertPem,
    keyPem: intKeyPem,
  });
  console.log(
    "[CA] Intermediate CA loaded. Subject:",
    intCert.subject.getField("CN")?.value,
  );

  // ── Load or generate Platform Signing Certificate ─────────────────────────
  //
  // The Platform Signing Certificate is a leaf certificate issued by the
  // Intermediate CA with keyUsage: digitalSignature + nonRepudiation.
  //
  // This is the certificate used to sign completed MULTI-signer envelopes.
  // It is DIFFERENT from the Intermediate CA certificate which has
  // keyUsage: keyCertSign + cRLSign — Adobe Acrobat rejects CA certificates
  // for document signing purposes.
  //
  // If the certificate files do not exist yet (first startup after this
  // feature is deployed), they are generated automatically and saved to
  // ca-store/. On subsequent startups they are simply loaded from disk.
  if (!platformSigningKeysExist()) {
    console.log("[CA] Generating Platform Signing Certificate...");

    const orgName = process.env.CA_ORG_NAME || "MyOrg Digital Signing CA";
    const country = process.env.CA_COUNTRY || "IN";

    const signingKeys = forge.pki.rsa.generateKeyPair({
      bits: 2048,
      e: 0x10001,
    });

    const cert = forge.pki.createCertificate();
    cert.publicKey = signingKeys.publicKey;
    cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 5,
    );

    cert.setSubject([
      { name: "commonName", value: `${orgName} Platform Signer` },
      { name: "organizationName", value: orgName },
      { name: "countryName", value: country },
    ]);

    // Issuer = Intermediate CA
    cert.setIssuer(intCert.subject.attributes);

    cert.setExtensions([
      // basicConstraints: cA=false — this is a leaf cert, NOT a CA cert
      { name: "basicConstraints", cA: false, critical: true },
      // keyUsage: digitalSignature + nonRepudiation
      // These are the flags Adobe Acrobat requires for document signing
      {
        name: "keyUsage",
        digitalSignature: true,
        nonRepudiation: true,
        critical: true,
      },
      // extKeyUsage: emailProtection is standard for S/MIME and document signing
      { name: "extKeyUsage", emailProtection: true },
      { name: "subjectKeyIdentifier" },
      { name: "authorityKeyIdentifier", keyIdentifier: true },
    ]);

    // Sign with Intermediate CA private key — establishes the chain:
    // Root CA → Intermediate CA → Platform Signing Cert
    cert.sign(intPrivateKey, forge.md.sha256.create());

    const signingCertPem = forge.pki.certificateToPem(cert);
    const signingKeyPem = forge.pki.privateKeyToPem(signingKeys.privateKey);

    // Save to disk — encrypted key uses INTERMEDIATE_CA_PASSPHRASE
    // (no new env variable needed — same passphrase, different filename)
    saveEncryptedPem(
      "platform-signing.enc",
      signingKeyPem,
      process.env.INTERMEDIATE_CA_PASSPHRASE!,
    );
    savePlainPem("platform-signing-cert.pem", signingCertPem);

    const loadedKey = forge.pki.privateKeyFromPem(
      signingKeyPem,
    ) as forge.pki.rsa.PrivateKey;
    setPlatformSigningKeys({
      cert,
      privateKey: loadedKey,
      certPem: signingCertPem,
      keyPem: signingKeyPem,
    });
    console.log("[CA] Platform Signing Certificate generated and saved.");
  } else {
    // Load existing Platform Signing Certificate from disk
    const signingKeyPem = loadEncryptedPem(
      "platform-signing.enc",
      process.env.INTERMEDIATE_CA_PASSPHRASE!,
    );
    const signingCertPem = loadPlainPem("platform-signing-cert.pem");

    if (!signingKeyPem || !signingCertPem) {
      throw new Error("[CA] Failed to load Platform Signing Certificate files");
    }

    const signingCert = forge.pki.certificateFromPem(signingCertPem);
    const signingKey = forge.pki.privateKeyFromPem(
      signingKeyPem,
    ) as forge.pki.rsa.PrivateKey;

    setPlatformSigningKeys({
      cert: signingCert,
      privateKey: signingKey,
      certPem: signingCertPem,
      keyPem: signingKeyPem,
    });
    console.log(
      "[CA] Platform Signing Certificate loaded. Subject:",
      signingCert.subject.getField("CN")?.value,
    );
  }
}
