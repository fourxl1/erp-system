require("dotenv").config();
const { query } = require("../config/db");

async function run() {
  try {
    await query(`
      ALTER TABLE items
      DROP COLUMN IF EXISTS current_quantity,
      DROP COLUMN IF EXISTS minimum_quantity,
      DROP COLUMN IF EXISTS cost_usd,
      DROP COLUMN IF EXISTS cost_ghs,
      DROP COLUMN IF EXISTS cost_euro,
      DROP COLUMN IF EXISTS image_url
    `);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

run();
