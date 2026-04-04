// ============================================================
// server.js
// ============================================================
require("dotenv").config();

const express  = require("express");
const mongoose = require("mongoose");
const path     = require("path");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const app  = express();
const PORT = process.env.PORT      || 5000;
const DB   = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelMatcher";

// ── 1. CORS headers — very first, before everything ─────────
app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// ── 2. Body parsers ─────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 3. Request logger ───────────────────────────────────────
app.use(function(req, res, next) {
  if (req.path.startsWith("/api")) {
    var ts = new Date().toTimeString().slice(0, 8);
    console.log("[" + ts + "] " + req.method + " " + req.path);
  }
  next();
});

// ── 4. Serve frontend static files ──────────────────────────
app.use(express.static(path.join(__dirname, "../frontend")));

// ── 5. Health check ─────────────────────────────────────────
app.get("/api/health", function(req, res) {
  var s = mongoose.connection.readyState;
  var states = { 0:"disconnected", 1:"connected", 2:"connecting", 3:"disconnecting" };
  res.json({ status: s === 1 ? "ok" : "error", db: states[s], time: new Date().toISOString() });
});

// ── 6. Auth routes (register + login) ───────────────────────
app.use("/api", authRoutes);

// ── 7. Protected user routes ─────────────────────────────────
app.use("/api", userRoutes);

// ── 8. 404 for unknown API routes (LAST) ────────────────────
app.use("/api", function(req, res) {
  res.status(404).json({ success: false, message: "Not found: " + req.method + " " + req.originalUrl });
});

// ── 9. Global error handler ─────────────────────────────────
app.use(function(err, req, res, next) {
  console.error("[ERROR]", err.message);
  res.status(500).json({ success: false, message: "Internal server error." });
});

// ── MongoDB options ──────────────────────────────────────────
var MONGO_OPTS = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS:          45000,
  maxPoolSize:              10,
};

// ── Startup ──────────────────────────────────────────────────
async function start() {
  try {
    console.log("Connecting to MongoDB: " + DB);
    await mongoose.connect(DB, MONGO_OPTS);
    console.log("MongoDB connected. Database: " + mongoose.connection.db.databaseName);

    app.listen(PORT, function() {
      console.log("----------------------------------------------");
      console.log("Server running at: http://localhost:" + PORT);
      console.log("Open this URL in browser: http://localhost:" + PORT);
      console.log("API health check:  http://localhost:" + PORT + "/api/health");
      console.log("----------------------------------------------");
      console.log("Registered API routes:");
      console.log("  POST   /api/register");
      console.log("  POST   /api/login");
      console.log("  GET    /api/health");
      console.log("  GET    /api/me");
      console.log("  GET    /api/users");
      console.log("  GET    /api/matches/:id");
      console.log("  PUT    /api/profile");
      console.log("  POST   /api/connect/:id");
      console.log("----------------------------------------------");
    });
  } catch (err) {
    console.error("FATAL: Cannot connect to MongoDB: " + err.message);
    console.error("Start MongoDB first:");
    console.error("  Windows: net start MongoDB");
    console.error("  Mac:     brew services start mongodb-community");
    console.error("  Linux:   sudo systemctl start mongod");
    process.exit(1);
  }
}

mongoose.connection.on("error",        function(e) { console.error("MongoDB error:", e.message); });
mongoose.connection.on("disconnected", function()  { console.warn("MongoDB disconnected."); });

process.on("SIGINT", async function() {
  await mongoose.connection.close();
  console.log("MongoDB connection closed.");
  process.exit(0);
});

start();
