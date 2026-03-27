require('dotenv').config();
const { query } = require('./config/db');

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
    console.log("Redundant columns dropped from items table");

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
