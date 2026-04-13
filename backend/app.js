const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const itemRoutes = require("./routes/itemRoutes");
const movementRoutes = require("./routes/movementRoutes");
const requestRoutes = require("./routes/requestRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const messageRoutes = require("./routes/messageRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const alertRoutes = require("./routes/alertRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const systemRoutes = require("./routes/systemRoutes");
const recipientRoutes = require("./routes/recipientRoutes");
const issueRoutes = require("./routes/issueRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { getAllowedOrigins, isAllowedOrigin } = require("./utils/originPolicy");

const app = express();
const allowedOrigins = getAllowedOrigins();
const staticFileOptions = {
  fallthrough: true,
  index: false,
  dotfiles: "deny"
};

/* =========================
   CORS CONFIG
========================= */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin, allowedOrigins)) {
        return callback(null, true);
      }
      const error = new Error("Origin not allowed by CORS");
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Active-Location-Id"],
    exposedHeaders: ["Content-Disposition"]
  })
);

/* =========================
   SECURITY + LOGGING
========================= */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "upgrade-insecure-requests": null
      }
    }
  })
);
app.disable("x-powered-by");
app.use(morgan("dev"));

/* =========================
   BODY PARSING
========================= */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   RATE LIMITING
========================= */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  message: "Too many login attempts from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/auth/login", authLimiter);

/* =========================
   STATIC FILES (UPLOADS)
========================= */
app.use(
  "/uploads/items",
  express.static(path.join(__dirname, "uploads", "items"), staticFileOptions)
);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads", "items"), staticFileOptions)
);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    ...staticFileOptions,
    fallthrough: false
  })
);

/* =========================
   API ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/movements", movementRoutes);
app.use("/api/stock-movements", movementRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/stock-requests", requestRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/recipients", recipientRoutes);
app.use("/api/issues", issueRoutes);

/* =========================
   🔥 SERVE FRONTEND (FINAL FIX)
========================= */
app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res, next) => {
  // allow API routes to pass through
  if (req.originalUrl.startsWith("/api")) {
    return next();
  }

  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

/* =========================
   ERROR HANDLING (ALWAYS LAST)
========================= */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
