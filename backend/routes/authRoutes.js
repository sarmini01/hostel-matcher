// routes/authRoutes.js
const express = require("express");
const router  = express.Router();
const { register, login } = require("../controllers/authController");

// POST /api/register — create a new account
router.post("/register", register);

// POST /api/login — authenticate and receive JWT
router.post("/login", login);

module.exports = router;
