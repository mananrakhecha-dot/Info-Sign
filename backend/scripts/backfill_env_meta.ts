/**
 * Backfill script: copy existing signature_fields rows into env_meta.
 *
 * Any envelope created before migration 6 has rows in signature_fields but
 * none in env_meta.  This script creates the missing env_meta rows so the
 * download endpoint can render those envelopes correctly.
 *
 * Idempotency: the script checks for an existing env_meta row with the same
 * signature_field_id before inserting.  Re-running it is safe.
 *
 * Limitations for already-signed envelopes:
 *   Signature/initials images were baked directly into the PDF by the old
 *   signing flow and were never saved as separate files.  The backfilled
 *   env_meta rows for signed signature/initials fields will have value = NULL
 *   (same as unfilled fields), which means their images will NOT appear in
 *   newly downloaded PDFs for those envelopes.  Text/date values are also
 *   unknown at backfill time (they were baked into the PDF, not stored in the
 *   database).  There is no way to recover this data without modifying the PDF.
 *   The cert generator is unaffected because it reads from envelope_recipients
 *   and signature_fields (not env_meta).
 *
 * How to run:
 *   cd backend
 *   npx tsx scripts/backfill_env_meta.ts
 *
 * The DATABASE_URL environment variable must be set (or a .env file must be
 * present in the backend directory).
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// pool must be imported after dotenv.config so DATABASE_URL is available
import { pool } from "../src/db/pool";

interface SignatureFieldRow {
  id: string;
  envelope_document_id: string;
  recipient_id: string;
  page_number: number;
  x: string; // stored as numeric/real in pg, arrives as string
  y: string;
  width: string;
  height: string;
  field_type: string;
}

interface DocumentRow {
  id: string;
  envelope_id: string;
}

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log("[Backfill] Starting env_meta backfill …");

    // Fetch all signature_fields along with their envelope_id (via envelope_documents)
    const { rows: sfRows } = await client.query<
      SignatureFieldRow & { envelope_id: string }
    >(
      `SELECT sf.id, sf.envelope_document_id, sf.recipient_id,
              sf.page_number, sf.x, sf.y, sf.width, sf.height, sf.field_type,
              ed.envelope_id
       FROM signature_fields sf
       JOIN envelope_documents ed ON sf.envelope_document_id = ed.id
       ORDER BY ed.envelope_id, sf.page_number, sf.id`,
    );

    console.log(
      `[Backfill] Found ${sfRows.length} signature_fields rows to evaluate.`,
    );

    let inserted = 0;
    let skipped = 0;

    await client.query("BEGIN");
    try {
      for (const sf of sfRows) {
        // Check whether an env_meta row already exists for this signature_field_id
        const { rows: existing } = await client.query<{ id: string }>(
          "SELECT id FROM env_meta WHERE signature_field_id = $1 LIMIT 1",
          [sf.id],
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Insert with fraction-based coordinates.
        // signature_fields stores percentages (0–100); env_meta uses fractions (0.0–1.0).
        await client.query(
          `INSERT INTO env_meta
             (envelope_id, recipient_id, type, page,
              x, y, width, height,
              value, font_size, required, signature_field_id)
           VALUES ($1, $2, $3, $4,
                   $5, $6, $7, $8,
                   NULL, 12, true, $9)`,
          [
            sf.envelope_id,
            sf.recipient_id,
            sf.field_type,
            sf.page_number,
            parseFloat(sf.x) / 100, // percentage → fraction
            parseFloat(sf.y) / 100,
            parseFloat(sf.width) / 100,
            parseFloat(sf.height) / 100,
            sf.id,
          ],
        );
        inserted++;
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    console.log(
      `[Backfill] Done. Inserted: ${inserted}  |  Already present (skipped): ${skipped}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[Backfill] Fatal error:", err);
  process.exit(1);
});
