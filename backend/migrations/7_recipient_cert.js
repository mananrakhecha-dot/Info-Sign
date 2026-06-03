exports.up = (pgm) => {
  pgm.addColumns('envelope_recipients', {
    cert_pem: { type: 'text' },
    encrypted_private_key: { type: 'text' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('envelope_recipients', ['cert_pem', 'encrypted_private_key']);
};