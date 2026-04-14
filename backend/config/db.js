const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { Pool } = require("pg");

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL
    }
  : {
      host: process.env.DB_HOST || undefined,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      user: process.env.DB_USER || undefined,
      password: process.env.DB_PASSWORD || undefined,
      database: process.env.DB_NAME || undefined
    };

if (String(process.env.DB_SSL || "").toLowerCase() === "true") {
  const allowSelfSigned = String(process.env.DB_SSL_ALLOW_SELF_SIGNED || "").toLowerCase() === "true";
  poolConfig.ssl = allowSelfSigned ? { rejectUnauthorized: false } : true;
}

const pool = new Pool({
  ...poolConfig,
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function withSavepoint(client, work) {
  const savepoint = `sp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  try {
    await client.query(`SAVEPOINT ${savepoint}`);
    const result = await work();
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    throw error;
  }
}

async function withTransaction(work) {
  const client = await getClient();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to rollback PostgreSQL transaction:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

async function healthcheck() {
  return query("SELECT NOW() AS server_time");
}

module.exports = {
  pool,
  query,
  getClient,
  withSavepoint,
  withTransaction,
  healthcheck
};
