// routes/userRoutes.js
const express  = require("express");
const router   = express.Router();
const auth     = require("../middleware/auth");
const {
  getUsers, getMe, getMatches, updateProfile, connect,
} = require("../controllers/userController");

// All routes below require a valid JWT (logged-in user)
router.use(auth);

router.get("/me",            getMe);           // GET  /api/me
router.get("/users",         getUsers);        // GET  /api/users
router.get("/matches/:id",   getMatches);      // GET  /api/matches/:id
router.put("/profile",       updateProfile);   // PUT  /api/profile
router.post("/connect/:id",  connect);         // POST /api/connect/:id

module.exports = router;
