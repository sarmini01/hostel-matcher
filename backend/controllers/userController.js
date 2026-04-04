// ============================================================
// controllers/userController.js
//
// All data returned to frontend is fetched directly from MongoDB.
// No transformations — what's in DB is what you see.
// ============================================================

const User = require("../models/User");

// ════════════════════════════════════════════════════════════
//  MATCHING ALGORITHM
//
//  Compares two users across 4 habit fields + shared interests.
//
//  Scoring per field (max 2 per field):
//    Same value      → +2
//    Adjacent value  → +1  (Low<->Medium, Medium<->High)
//    Opposite value  → +0  (Low<->High, Early<->Late)
//
//  Interests:
//    Each shared interest → +2
//    Max = 2 × max(len(A.interests), len(B.interests))
//
//  Compatibility % = (score / maxScore) × 100
// ════════════════════════════════════════════════════════════

// Ordered scales for ordinal comparison
const SCALE_SLEEP  = { Early: 0, Late: 1 };
const SCALE_LEVEL  = { Low: 0, Medium: 1, High: 2 };   // cleanliness & noise
const SCALE_STUDY  = { Morning: 0, Afternoon: 1, Night: 2 };

function fieldScore(a, b, scale) {
  const va = scale[a];
  const vb = scale[b];
  if (va === undefined || vb === undefined) return 0;
  const diff = Math.abs(va - vb);
  if (diff === 0) return 2;  // Same
  if (diff === 1) return 1;  // Adjacent
  return 0;                  // Opposite (penalty)
}

function computeCompatibility(userA, userB) {
  let score    = 0;
  let maxScore = 0;

  // ── 4 Habit Fields (max 2 each = 8 total) ──────────────
  score    += fieldScore(userA.sleep,       userB.sleep,       SCALE_SLEEP);
  maxScore += 2;
  score    += fieldScore(userA.cleanliness, userB.cleanliness, SCALE_LEVEL);
  maxScore += 2;
  score    += fieldScore(userA.noise,       userB.noise,       SCALE_LEVEL);
  maxScore += 2;
  score    += fieldScore(userA.study,       userB.study,       SCALE_STUDY);
  maxScore += 2;

  // ── Shared Interests ───────────────────────────────────
  const setA        = new Set(userA.interests || []);
  const setB        = new Set(userB.interests || []);
  const maxInterest = Math.max(setA.size, setB.size, 1);
  const common      = [];

  setA.forEach(i => { if (setB.has(i)) common.push(i); });

  score    += common.length * 2;
  maxScore += maxInterest  * 2;

  const percentage = maxScore > 0
    ? Math.round((score / maxScore) * 100)
    : 0;

  return { percentage, common };
}

// ── GET /api/me ────────────────────────────────────────────
// Returns the full logged-in user document from MongoDB
exports.getMe = async (req, res) => {
  try {
    // Select everything except password
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found in database." });
    }
    console.log("[getMe] Returning DB document for:", user.email);
    res.json({ success: true, user });
  } catch (err) {
    console.error("[getMe] Error:", err.message);
    res.status(500).json({ success: false, message: "Could not fetch profile." });
  }
};

// ── GET /api/users ─────────────────────────────────────────
// Returns all users except the logged-in one (passwords excluded)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.user.id } }
    ).select("-password").lean();

    console.log("[getUsers] Found", users.length, "users in MongoDB");
    res.json({ success: true, users, count: users.length });
  } catch (err) {
    console.error("[getUsers] Error:", err.message);
    res.status(500).json({ success: false, message: "Could not fetch users." });
  }
};

// ── GET /api/matches/:id ───────────────────────────────────
// Calculates and returns top 3 matches for user :id
// Supports optional query filters: ?department=CSE&year=2nd&gender=Male
exports.getMatches = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id).select("-password").lean();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Fetch all other users
    let candidates = await User.find(
      { _id: { $ne: req.params.id } }
    ).select("-password").lean();

    console.log("[getMatches] Total candidates:", candidates.length);

    // ── Apply optional filters ──────────────────────────
    const { department, year, gender } = req.query;

    if (department && department !== "all") {
      candidates = candidates.filter(u =>
        u.department && u.department.toLowerCase() === department.toLowerCase()
      );
    }
    if (year && year !== "all") {
      candidates = candidates.filter(u => u.year === year);
    }
    if (gender && gender !== "all") {
      candidates = candidates.filter(u =>
        u.gender && u.gender.toLowerCase() === gender.toLowerCase()
      );
    }

    console.log("[getMatches] After filters:", candidates.length, "candidates");

    // ── Calculate compatibility score for each ──────────
    const results = candidates.map(other => {
      const { percentage, common } = computeCompatibility(targetUser, other);
      return {
        user:             other,       // Full DB document
        compatibility:    percentage,  // 0–100
        commonInterests:  common,      // string[]
      };
    });

    // ── Sort descending, return top 3 ───────────────────
    results.sort((a, b) => b.compatibility - a.compatibility);
    const topMatches = results.slice(0, 3);

    console.log("[getMatches] Top matches:",
      topMatches.map(m => m.user.name + " " + m.compatibility + "%")
    );

    res.json({
      success: true,
      matches: topMatches,
      total:   candidates.length,
    });
  } catch (err) {
    console.error("[getMatches] Error:", err.message);
    res.status(500).json({ success: false, message: "Matching failed." });
  }
};

// ── PUT /api/profile ───────────────────────────────────────
// Updates the logged-in user's profile in MongoDB
exports.updateProfile = async (req, res) => {
  try {
    console.log("[updateProfile] Update payload:", JSON.stringify(req.body, null, 2));

    // Whitelist of fields that can be updated
    const ALLOWED = [
      "name", "age", "gender",
      "sleep", "cleanliness", "noise", "study",
      "interests", "department", "year", "bio",
    ];

    const updates = {};
    ALLOWED.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Run validators so enum constraints are enforced
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    console.log("[updateProfile] MongoDB document updated for:", updatedUser.email);

    res.json({
      success: true,
      message: "Profile updated in MongoDB.",
      user:    updatedUser,
    });
  } catch (err) {
    console.error("[updateProfile] Error:", err.message);

    if (err.name === "ValidationError") {
      const msgs = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: msgs.join(". ") });
    }

    res.status(500).json({ success: false, message: "Profile update failed." });
  }
};

// ── POST /api/connect/:id ──────────────────────────────────
// Toggles a connection between the logged-in user and :id
exports.connect = async (req, res) => {
  try {
    const me     = await User.findById(req.user.id);
    const target = await User.findById(req.params.id);

    if (!me)     return res.status(404).json({ success: false, message: "Your account not found." });
    if (!target) return res.status(404).json({ success: false, message: "Target user not found." });

    const targetIdStr = req.params.id.toString();
    const alreadyConn = me.connections.map(c => c.toString()).includes(targetIdStr);

    if (alreadyConn) {
      // Remove connection (disconnect)
      me.connections = me.connections.filter(c => c.toString() !== targetIdStr);
      await me.save();
      console.log("[connect] Disconnected:", me.email, "from", target.email);
      return res.json({ success: true, connected: false, message: "Disconnected from " + target.name + "." });
    }

    // Add connection
    me.connections.push(target._id);
    await me.save();
    console.log("[connect] Connected:", me.email, "with", target.email);

    res.json({
      success:   true,
      connected: true,
      message:   "Connected with " + target.name + "!",
    });
  } catch (err) {
    console.error("[connect] Error:", err.message);
    res.status(500).json({ success: false, message: "Connection failed." });
  }
};
