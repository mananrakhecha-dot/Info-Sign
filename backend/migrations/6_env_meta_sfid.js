/* eslint-disable camelcase */
exports.shorthands = undefined;

/**
 * Adds signature_field_id to env_meta so each env_meta row can be linked
 * back to its source signature_fields row during the dual-write transition
 * period. This column is the key used by the signing flow to UPDATE
 * env_meta.value when a recipient fills a field.
 *
 * ON DELETE SET NULL: if a signature_fields row is deleted (e.g. sender
 * removes a field in DRAFT), the env_meta row keeps its data but loses
 * the link — downstream code should clean up orphaned env_meta rows on
 * the next saveFields call.
 */
exports.up = (pgm) => {
  pgm.addColumn('env_meta', {
    signature_field_id: {
      type: 'uuid',
      references: '"signature_fields"',
      onDelete: 'SET NULL',
    },
  });

  // Lookup by signature_field_id is the hot path during signing
  pgm.createIndex('env_meta', 'signature_field_id');
};

exports.down = (pgm) => {
  pgm.dropIndex('env_meta', 'signature_field_id');
  pgm.dropColumn('env_meta', 'signature_field_id');
};