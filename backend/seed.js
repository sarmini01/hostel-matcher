// ============================================================
// seed.js — Load sample users into MongoDB
//
// Run once: node seed.js
// Re-running skips existing emails (no duplicates).
//
// After seeding, verify in MongoDB Compass or Mongo Shell:
//   use hostelMatcher
//   db.users.find().pretty()
// ============================================================

require("dotenv").config();
const mongoose = require("mongoose");
const User     = require("./models/User");

const DB = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hostelMatcher";

// Sample users — interests use plain text (no emojis)
const SAMPLE_USERS = [
  {
    name:        "Arjun Sharma",
    email:       "arjun@demo.com",
    password:    "demo1234",
    age:         20,
    gender:      "Male",
    sleep:       "Early",
    cleanliness: "High",
    noise:       "Low",
    study:       "Morning",
    interests:   ["Music", "Reading", "Cricket", "Coding"],
    department:  "CSE",
    year:        "2nd",
    bio:         "Loves clean spaces and early mornings.",
  },
  {
    name:        "Priya Nair",
    email:       "priya@demo.com",
    password:    "demo1234",
    age:         19,
    gender:      "Female",
    sleep:       "Late",
    cleanliness: "Medium",
    noise:       "Medium",
    study:       "Night",
    interests:   ["Movies", "Dancing", "Coding", "Art"],
    department:  "ECE",
    year:        "1st",
    bio:         "Night owl who loves art and movies.",
  },
  {
    name:        "Rahul Verma",
    email:       "rahul@demo.com",
    password:    "demo1234",
    age:         21,
    gender:      "Male",
    sleep:       "Early",
    cleanliness: "High",
    noise:       "Low",
    study:       "Morning",
    interests:   ["Cricket", "Coding", "Reading", "Fitness"],
    department:  "CSE",
    year:        "3rd",
    bio:         "Fitness enthusiast and avid coder.",
  },
  {
    name:        "Sneha Patel",
    email:       "sneha@demo.com",
    password:    "demo1234",
    age:         20,
    gender:      "Female",
    sleep:       "Late",
    cleanliness: "Low",
    noise:       "High",
    study:       "Night",
    interests:   ["Music", "Gaming", "Movies", "Cooking"],
    department:  "MECH",
    year:        "2nd",
    bio:         "Fun-loving gamer who enjoys late nights.",
  },
  {
    name:        "Kiran Reddy",
    email:       "kiran@demo.com",
    password:    "demo1234",
    age:         22,
    gender:      "Male",
    sleep:       "Early",
    cleanliness: "Medium",
    noise:       "Medium",
    study:       "Afternoon",
    interests:   ["Chess", "Reading", "Yoga", "Cooking"],
    department:  "CIVIL",
    year:        "4th",
    bio:         "Calm and organised. Enjoys chess and cooking.",
  },
  {
    name:        "Divya Menon",
    email:       "divya@demo.com",
    password:    "demo1234",
    age:         19,
    gender:      "Female",
    sleep:       "Late",
    cleanliness: "High",
    noise:       "Low",
    study:       "Night",
    interests:   ["Reading", "Art", "Coding", "Yoga"],
    department:  "CSE",
    year:        "1st",
    bio:         "Bookworm who sketches in free time.",
  },
];

async function seed() {
  try {
    console.log("[seed] Connecting to MongoDB:", DB);
    await mongoose.connect(DB, { serverSelectionTimeoutMS: 5000 });
    console.log("[seed] Connected. Database:", mongoose.connection.db.databaseName);

    let created = 0;
    let skipped = 0;

    for (const userData of SAMPLE_USERS) {
      const exists = await User.findOne({ email: userData.email });
      if (exists) {
        console.log("[seed] Skipped (already exists):", userData.email);
        skipped++;
      } else {
        const user = await User.create(userData);
        console.log("[seed] Created:", user.name, "| _id:", user._id.toString());
        created++;
      }
    }

    console.log("\n[seed] Done. Created:", created, "| Skipped:", skipped);
    console.log("[seed] Total users in DB:", await User.countDocuments());
    console.log("\n[seed] Demo login: arjun@demo.com / demo1234");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("[seed] Failed:", err.message);
    if (err.message.includes("ECONNREFUSED")) {
      console.error("[seed] MongoDB is not running. Start it first.");
    }
    process.exit(1);
  }
}

seed();
