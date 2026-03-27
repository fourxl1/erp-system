const path = require("path");
const http = require("http");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const app = require("./app");
const { healthcheck, pool } = require("./config/db");
const { initializeSocketServer } = require("./sockets");

const PORT = Number(process.env.PORT || 5000);
let server = null;
let shuttingDown = false;

async function shutdown(signal, error = null) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (error) {
    console.error(`Fatal error during ${signal}:`, error);
  } else {
    console.log(`${signal} received. Shutting down gracefully...`);
  }

  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out. Forcing process exit.");
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    await new Promise((resolve) => {
      if (!server) {
        resolve();
        return;
      }

      server.close(() => resolve());
    });

    await pool.end();
    clearTimeout(forceExitTimer);
    process.exit(error ? 1 : 0);
  } catch (shutdownError) {
    clearTimeout(forceExitTimer);
    console.error("Failed to shut down cleanly:", shutdownError);
    process.exit(1);
  }
}

async function startServer() {
  try {
    const result = await healthcheck();
    console.log(`Database connected successfully at: ${result.rows[0].server_time}`);

    server = http.createServer(app);
    const io = initializeSocketServer(server);
    app.set("io", io);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  void shutdown("unhandledRejection", reason);
});

process.on("uncaughtException", (error) => {
  void shutdown("uncaughtException", error);
});

startServer();
