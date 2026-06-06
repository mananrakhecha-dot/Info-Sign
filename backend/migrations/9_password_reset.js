exports.up = (pgm) => {
  pgm.createTable('password_reset_tokens', {
    id:          { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id:     { type: 'uuid', notNull: true, references: '"users"', onDelete: 'CASCADE' },
    token_hash:  { type: 'text', notNull: true },
    expires_at:  { type: 'timestamptz', notNull: true },
    used:        { type: 'boolean', default: false, notNull: true },
    created_at:  { type: 'timestamptz', default: pgm.func('now()'), notNull: true },
  });
  pgm.createIndex('password_reset_tokens', 'token_hash');
  pgm.createIndex('password_reset_tokens', 'user_id');
};
 
exports.down = (pgm) => {
  pgm.dropTable('password_reset_tokens');
};