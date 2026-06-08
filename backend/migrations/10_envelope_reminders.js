exports.up = (pgm) => {
  pgm.addColumns('envelope_recipients', {
    last_reminded_at: { type: 'timestamptz', notNull: false },
    reminder_count:   { type: 'integer', default: 0, notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('envelope_recipients', ['last_reminded_at', 'reminder_count']);
};
