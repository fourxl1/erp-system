require("dotenv").config();
const { query } = require("../config/db");

async function run() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS units (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    const commonUnits = ["PCS", "KG", "LITERS", "METERS", "BOXES", "ROLLS"];

    for (const unit of commonUnits) {
      await query(
        `
          INSERT INTO units (name)
          VALUES ($1)
          ON CONFLICT (name) DO NOTHING
        `,
        [unit]
      );
    }
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

run();
