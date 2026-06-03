import forge from 'node-forge';
import dotenv from 'dotenv';
import { saveEncryptedPem, savePlainPem, caExists } from './caStore';

dotenv.config();
//Generates a random 16-byte hex serial number for each certificate.
function generateSerial(): string {
  return forge.util.bytesToHex(forge.random.getBytesSync(16));
}
//A reusable helper that takes all the parameters (who owns it, who signed it, how long it's valid, what it's allowed to do) 
// and stamps out a signed X.509 certificate. Think of it as a certificate assembly line.

function buildCert(options: {
  subject: forge.pki.CertificateField[];
  issuer: forge.pki.CertificateField[];
  publicKey: forge.pki.PublicKey;
  signingKey: forge.pki.PrivateKey;
  serialHex: string;
  validityYears: number;
  extensions: any[];
}): forge.pki.Certificate {
  //Creates a blank certificate object in memory 
  const cert = forge.pki.createCertificate();
  cert.publicKey = options.publicKey;           //Links the public key
  cert.serialNumber = options.serialHex;      //Assigns the serial
  cert.validity.notBefore = new Date();       //Sets start time
  cert.validity.notAfter = new Date();        //Sets end time
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + options.validityYears); //Adds validity period
  cert.setSubject(options.subject);          //Identifies the owner (Subject).
  cert.setIssuer(options.issuer);            //Identifies the signer (Issuer).
  cert.setExtensions(options.extensions);
  //Stamps the digital signature using the provided private key (which is the authority that vouches for this cert).
  cert.sign(options.signingKey as any, forge.md.sha256.create());
  return cert;
}

export async function bootstrapCA(): Promise<void> {
  const rootPassphrase = process.env.ROOT_CA_PASSPHRASE!;//Passphrases — used to encrypt private keys before saving to disk
  const intermediatePassphrase = process.env.INTERMEDIATE_CA_PASSPHRASE!;
  //The || fallback means if CA_ORG_NAME isn't set in .env, it defaults to 'MyOrg Digital Signing CA'
  const orgName = process.env.CA_ORG_NAME || 'MyOrg Digital Signing CA';
  const country = process.env.CA_COUNTRY || 'IN';

  console.log('[CA] Generating Root CA (RSA-4096, ~30s)...');//Generates a 4096-bit RSA keypair
  const rootKeysRaw = forge.pki.rsa.generateKeyPair({ bits: 4096, e: 0x10001 });
  const rootKeys = { publicKey: rootKeysRaw.publicKey as forge.pki.rsa.PublicKey, privateKey: rootKeysRaw.privateKey as forge.pki.rsa.PrivateKey };

  //Creates the identifying information for the Root CA, similar to a name tag
  const rootSubject: forge.pki.CertificateField[] = [
    { name: 'commonName', value: `${orgName} Root CA` },
    { name: 'organizationName', value: orgName },
    { name: 'countryName', value: country },
  ];
  //Creates the actual Root CA certificate by packaging the subject, public key, and issuer information together and signing it.
  const rootCert = buildCert({
    subject: rootSubject,
    issuer: rootSubject,
    publicKey: rootKeys.publicKey,
    signingKey: rootKeys.privateKey,
    serialHex: generateSerial(),
    validityYears: 20,
    extensions: [
      { name: 'basicConstraints', cA: true, pathLenConstraint: 2, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      { name: 'subjectKeyIdentifier' },
    ],
  });

  const rootCertPem = forge.pki.certificateToPem(rootCert);
  const rootKeyPem = forge.pki.privateKeyToPem(rootKeys.privateKey);

  saveEncryptedPem('root-ca.enc', rootKeyPem, rootPassphrase);
  savePlainPem('root-ca-cert.pem', rootCertPem);
  console.log('[CA] Root CA generated and stored.');

  console.log('[CA] Generating Intermediate CA (RSA-2048)...');
  const intKeysRaw = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const intKeys = { publicKey: intKeysRaw.publicKey as forge.pki.rsa.PublicKey, privateKey: intKeysRaw.privateKey as forge.pki.rsa.PrivateKey };

  const intSubject: forge.pki.CertificateField[] = [
    { name: 'commonName', value: `${orgName} Intermediate CA` },
    { name: 'organizationName', value: orgName },
    { name: 'countryName', value: country },
  ];

  const intCert = buildCert({
    subject: intSubject,
    issuer: rootSubject,
    publicKey: intKeys.publicKey,
    signingKey: rootKeys.privateKey,
    serialHex: generateSerial(),
    validityYears: 5,
    extensions: [
      { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
      { name: 'subjectKeyIdentifier' },
      { name: 'authorityKeyIdentifier', keyIdentifier: true },
    ],
  });

  const intCertPem = forge.pki.certificateToPem(intCert);
  const intKeyPem = forge.pki.privateKeyToPem(intKeys.privateKey);

  saveEncryptedPem('intermediate-ca.enc', intKeyPem, intermediatePassphrase);
  savePlainPem('intermediate-ca-cert.pem', intCertPem);
  console.log('[CA] Intermediate CA generated and stored.');
  console.log('[CA] Bootstrap complete.');
}

if (require.main === module) {
  if (caExists()) {
    console.log('[CA] CA already exists. Delete ca-store/ to regenerate.');
    process.exit(0);
  }
  bootstrapCA().catch((err) => {
    console.error('[CA] Bootstrap failed:', err);
    process.exit(1);
  });
}
