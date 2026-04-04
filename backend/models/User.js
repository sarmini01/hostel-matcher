// ============================================================
// models/User.js
//
// MongoDB schema — every field here maps EXACTLY to what the
// frontend sends and what gets stored in the database.
// ============================================================

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    // ── Basic Info (Step 1 of registration form) ────────────
    name: {
      type:     String,
      required: [true, "Name is required"],
      trim:     true,
    },
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    password: {
      type:     String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    age: {
      type:     Number,
      required: [true, "Age is required"],
      min:      [14, "Minimum age is 14"],
      max:      [80, "Maximum age is 80"],
    },
    gender: {
      type:     String,
      required: [true, "Gender is required"],
      enum:     ["Male", "Female", "Other"],
    },

    // ── Hostel Habits (Step 2 of registration form) ─────────
    sleep: {
      type:     String,
      required: [true, "Sleep preference is required"],
      enum:     ["Early", "Late"],
    },
    cleanliness: {
      type:     String,
      required: [true, "Cleanliness level is required"],
      enum:     ["Low", "Medium", "High"],
    },
    noise: {
      type:     String,
      required: [true, "Noise tolerance is required"],
      enum:     ["Low", "Medium", "High"],
    },
    study: {
      type:     String,
      required: [true, "Study time is required"],
      enum:     ["Morning", "Afternoon", "Night"],
    },

    // ── Interests (Step 3 of registration form) ─────────────
    // Stored as array of plain strings, e.g. ["Music", "Coding"]
    interests: {
      type:    [String],
      default: [],
    },

    // ── Optional Profile Fields ──────────────────────────────
    department: {
      type:    String,
      default: "",
      trim:    true,
    },
    year: {
      type:    String,
      default: "",
      enum:    ["", "1st", "2nd", "3rd", "4th"],
    },
    bio: {
      type:      String,
      default:   "",
      maxlength: [300, "Bio cannot exceed 300 characters"],
      trim:      true,
    },

    // ── Social: array of connected user IDs ─────────────────
    connections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref:  "User",
      },
    ],
  },
  {
    // Automatically adds createdAt and updatedAt timestamps
    timestamps: true,
    // Keep version key visible in DB for debugging
    versionKey: "__v",
  }
);

// ── Hash password before saving ─────────────────────────────
// Only runs when password field is modified (not on every save)
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt    = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Compare plain-text password against stored hash ─────────
UserSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// ── Index on email for fast login lookups ───────────────────
UserSchema.index({ email: 1 });

module.exports = mongoose.model("User", UserSchema);
