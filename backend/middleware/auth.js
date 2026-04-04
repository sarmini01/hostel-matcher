// ============================================================
// middleware/auth.js — JWT Authentication Guard
// Attach this to any route that needs a logged-in user
// ============================================================

const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "hostel_secret_2024";

module.exports = function authMiddleware(req, res, next) {
  // Look for token in Authorization header: "Bearer <token>"
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "No token — please log in." });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;   // { id, name, email }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};
