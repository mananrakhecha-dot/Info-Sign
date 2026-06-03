/* eslint-disable camelcase */
exports.shorthands = undefined;

/**
 * env_meta — per-envelope field metadata.
 *
 * Each row represents one placed field (signature box, initials, text, or date)
 * on a specific page of an envelope's document.
 *
 * Coordinate convention
 * ─────────────────────
 * x, y, width, height are FRACTIONS of the page dimension (0.0 – 1.0),
 * measured from the top-left corner of the page.
 * Conversion to PDF points happens only at render time:
 *
 *   absX = field.x      * pageW
 *   absY = pageH - (field.y * pageH) - (field.height * pageH)   ← Y flip
 *   absW = field.width  * pageW
 *   absH = field.height * pageH
 *
 * Write paths
 * ───────────
 * Placement (sender):  INSERT with value = NULL.
 * Filling (recipient): UPDATE value = '<image path>' | '<string>'.
 *
 * Read path
 * ─────────
 * At download time: SELECT WHERE envelope_id = ? — skip rows where value IS NULL.
 */
exports.up = (pgm) => {
  pgm.createTable('env_meta', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    envelope_id: {
      type: 'uuid',
      notNull: true,
      references: '"envelopes"',
      onDelete: 'CASCADE',
    },
    recipient_id: {
      type: 'uuid',
      references: '"envelope_recipients"',
      onDelete: 'SET NULL',
    },
    type: {
      type: 'varchar(20)',
      notNull: true,
      check: "type IN ('signature', 'initials', 'text', 'date')",
    },
    page: {
      type: 'integer',
      notNull: true,
      check: 'page >= 1',
    },
    x:      { type: 'real', notNull: true, check: 'x >= 0 AND x <= 1' },
    y:      { type: 'real', notNull: true, check: 'y >= 0 AND y <= 1' },
    width:  { type: 'real', notNull: true, check: 'width  > 0 AND width  <= 1' },
    height: { type: 'real', notNull: true, check: 'height > 0 AND height <= 1' },
    value: { type: 'text' },
    font_size: { type: 'integer', notNull: true, default: 12 },
    required:  { type: 'boolean', notNull: true, default: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Primary lookup: "give me all fields for this envelope"
  pgm.createIndex('env_meta', 'envelope_id');
};

exports.down = (pgm) => {
  pgm.dropTable('env_meta');
};