require('dotenv').config();
const { query } = require('./config/db');

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
    console.log("Units table created");

    const commonUnits = ['PCS', 'KG', 'LITERS', 'METERS', 'BOXES', 'ROLLS'];
    for (const unit of commonUnits) {
      await query(`
        INSERT INTO units (name)
        VALUES ($1)
        ON CONFLICT (name) DO NOTHING
      `, [unit]);
    }
    console.log("Common units inserted");

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
