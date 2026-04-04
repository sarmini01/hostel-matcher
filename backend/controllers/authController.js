// ============================================================
// controllers/authController.js
//
// register — saves ALL form data exactly to MongoDB
// login    — authenticates and returns JWT
// ============================================================

const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET  = process.env.JWT_SECRET  || "hostel_secret_change_in_production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

// Helper: create a signed JWT token
function createToken(user) {
  return jwt.sign(
    { id: user._id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ── POST /api/register ─────────────────────────────────────
exports.register = async (req, res) => {
  try {
    // Log incoming request body so you can verify what's being saved
    console.log("[register] Incoming data:", JSON.stringify(req.body, null, 2));

    const {
      name, email, password, age, gender,
      sleep, cleanliness, noise, study,
      interests, department, year, bio,
    } = req.body;

    // ── Validate required fields ──────────────────────────
    const missing = [];
    if (!name)        missing.push("name");
    if (!email)       missing.push("email");
    if (!password)    missing.push("password");
    if (!age)         missing.push("age");
    if (!gender)      missing.push("gender");
    if (!sleep)       missing.push("sleep");
    if (!cleanliness) missing.push("cleanliness");
    if (!noise)       missing.push("noise");
    if (!study)       missing.push("study");

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: " + missing.join(", "),
      });
    }

    // ── Check duplicate email ─────────────────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // ── Create user document in MongoDB ───────────────────
    // These fields map EXACTLY to the schema — nothing is omitted
    const newUser = await User.create({
      name:        name.trim(),
      email:       email.toLowerCase().trim(),
      password:    password,           // will be hashed by pre-save hook
      age:         Number(age),
      gender:      gender,
      sleep:       sleep,
      cleanliness: cleanliness,
      noise:       noise,
      study:       study,
      interests:   Array.isArray(interests) ? interests : [],
      department:  department ? department.trim() : "",
      year:        year || "",
      bio:         bio  ? bio.trim()  : "",
    });

    console.log("[register] Saved to MongoDB with _id:", newUser._id.toString());
    console.log("[register] Document stored:", {
      _id:         newUser._id,
      name:        newUser.name,
      email:       newUser.email,
      age:         newUser.age,
      gender:      newUser.gender,
      sleep:       newUser.sleep,
      cleanliness: newUser.cleanliness,
      noise:       newUser.noise,
      study:       newUser.study,
      interests:   newUser.interests,
      department:  newUser.department,
      year:        newUser.year,
      bio:         newUser.bio,
      createdAt:   newUser.createdAt,
    });

    const token = createToken(newUser);

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: {
        id:         newUser._id,
        name:       newUser.name,
        email:      newUser.email,
        department: newUser.department,
      },
    });
  } catch (err) {
    console.error("[register] Error:", err.message);

    // Mongoose validation error — send friendly message
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(". "),
      });
    }

    // Duplicate key error (race condition on email unique index)
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    res.status(500).json({ success: false, message: "Registration failed. Please try again." });
  }
};

// ── POST /api/login ────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    console.log("[login] Attempt for:", req.body.email);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // Find user in DB
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "No account found with this email address.",
      });
    }

    // Compare password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Incorrect password.",
      });
    }

    console.log("[login] Successful for:", user.email, "| _id:", user._id.toString());

    const token = createToken(user);

    res.json({
      success: true,
      message: "Logged in successfully.",
      token,
      user: {
        id:         user._id,
        name:       user.name,
        email:      user.email,
        department: user.department,
      },
    });
  } catch (err) {
    console.error("[login] Error:", err.message);
    res.status(500).json({ success: false, message: "Login failed. Please try again." });
  }
};
